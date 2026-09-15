/**
 * DemocracyCraft Finance Client API Bridge
 * Features rate-limit protection (429 detection & Retry-After countdowns),
 * intelligent memory-bounded caching, and seamless fallback between
 * Tauri Rust IPC and browser dev proxy.
 */

import {
  getCached,
  setCached,
  isCurrentlyRateLimited,
  setRateLimitActive,
  invalidateCache,
} from './cache.js';

const BASE_API_URL = 'https://api.democracycraft.net/economy';
const GITHUB_REPO = 'JFT10/DCFinanceClient';
const CURRENT_VERSION = '0.1.0';

// Detect if running inside Tauri
export const isTauri = () => {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);
};

/**
 * Check GitHub repository main branch for updates.
 * Cached for 15 minutes to prevent hitting GitHub's 60 req/hour limit.
 */
export async function checkForUpdates(force = false) {
  const cacheKey = 'github_update';
  const cached = getCached(cacheKey);

  if (!force && cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke('check_for_updates');
      setCached(cacheKey, res, 15 * 60 * 1000); // 15 mins
      return res;
    } catch (err) {
      console.warn('Tauri invoke check_for_updates failed:', err);
      if (cached) return { ...cached.data, _cached: true };
    }
  }

  // Browser / fallback implementation
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    });

    if (res.status === 403 || res.status === 429) {
      setRateLimitActive(60);
      if (cached) return { ...cached.data, _cached: true };
      return { update_available: false, error: 'GitHub rate limit exceeded' };
    }

    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}`);
    }

    const data = await res.json();
    const latestSha = data.sha;
    const shortSha = latestSha.substring(0, 7);
    const commitMessage = data.commit?.message || 'New updates available';
    const commitDate = data.commit?.author?.date || new Date().toISOString();
    const htmlUrl = data.html_url || `https://github.com/${GITHUB_REPO}`;

    const lastAcknowledged = localStorage.getItem('dc_last_seen_commit');
    const hasUpdate = lastAcknowledged !== latestSha;

    const result = {
      update_available: hasUpdate,
      current_version: CURRENT_VERSION,
      latest_commit_sha: shortSha,
      full_commit_sha: latestSha,
      latest_commit_message: commitMessage,
      commit_date: commitDate,
      html_url: htmlUrl,
    };

    setCached(cacheKey, result, 15 * 60 * 1000); // 15 mins
    return result;
  } catch (error) {
    console.error('Failed to check for updates:', error);
    if (cached) return { ...cached.data, _cached: true };
    return {
      update_available: false,
      error: error.message,
    };
  }
}

/**
 * Load the Treasury API key from key.env (Tauri/Vite dev middleware) or localStorage.
 */
export async function loadApiKey() {
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const key = await invoke('load_api_key');
      if (key) return key;
    } catch (err) {
      console.warn('Tauri load_api_key failed, using fallback:', err);
    }
  }

  // Browser dev mode: attempt to read key.env via Vite dev server
  try {
    const res = await fetch('/__api/env-key');
    if (res.ok) {
      const data = await res.json();
      if (data && data.key) {
        localStorage.setItem('dc_treasury_key', data.key);
        return data.key;
      }
    }
  } catch (e) {
    // Ignore in production or offline
  }

  return localStorage.getItem('dc_treasury_key') || '';
}

/**
 * Save the Treasury API key to key.env (Tauri/Vite dev middleware) and localStorage.
 */
export async function saveApiKey(key) {
  const trimmed = key ? key.trim() : '';
  localStorage.setItem('dc_treasury_key', trimmed);

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('save_api_key', { key: trimmed });
      return;
    } catch (err) {
      console.warn('Tauri save_api_key failed:', err);
    }
  }

  // Browser dev mode: persist directly to key.env via Vite dev middleware
  try {
    await fetch('/__api/env-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: trimmed }),
    });
  } catch (e) {
    // Ignore in production or offline
  }
}

/**
 * Execute request to DemocracyCraft Treasury API with rate-limit and error handling.
 */
export async function treasuryRequest(endpoint, options = {}) {
  const key = await loadApiKey();

  if (!key) {
    throw new Error('Treasury API key is not configured. Please paste your key into Settings.');
  }

  const isGet = !options.method || options.method === 'GET';

  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke('treasury_request', {
        endpoint,
        method: options.method || 'GET',
        body: options.body ? JSON.stringify(options.body) : null,
      });
    } catch (err) {
      const errStr = String(err);
      if (errStr.includes('RATE_LIMIT:')) {
        const seconds = parseInt(errStr.split('RATE_LIMIT:')[1], 10) || 60;
        setRateLimitActive(seconds);
        throw new Error(`RATE_LIMIT:${seconds}`);
      }
      console.warn('Tauri treasury_request failed, using direct fetch:', err);
    }
  }

  // Direct fetch fallback in browser (using Vite proxy in dev)
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
  const isDev = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '1420'
  );
  const url = isDev ? cleanEndpoint : `${BASE_API_URL}${cleanEndpoint}`;

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${key}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  // Track rate limit headers
  const remaining = response.headers.get('X-RateLimit-Remaining');
  if (remaining === '0') {
    setRateLimitActive(60);
  }

  // Handle 429 Too Many Requests
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    setRateLimitActive(retryAfter);
    throw new Error(`RATE_LIMIT:${retryAfter}`);
  }

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { message: text };
  }

  if (!response.ok) {
    const errorMsg = json?.message || json?.error || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return json;
}

// Higher-level Treasury API Functions with Automatic Caching

export async function getAuthMe(force = false) {
  const cacheKey = 'auth_me';
  const cached = getCached(cacheKey);

  // Return cached if valid and not forcing
  if (!force && cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // If rate limit is active and we have cached data, use it immediately
  if (isCurrentlyRateLimited() && cached) {
    return { ...cached.data, _cached: true, _cachedAt: cached.timestamp };
  }

  try {
    const data = await treasuryRequest('/api/v1/auth/me');
    setCached(cacheKey, data, 10 * 60 * 1000); // 10 minutes TTL
    return data;
  } catch (err) {
    if (cached) {
      return { ...cached.data, _cached: true, _cachedAt: cached.timestamp };
    }
    throw err;
  }
}

export async function getAccountBalance(accountId, force = false) {
  const cacheKey = `balance_${accountId}`;
  const cached = getCached(cacheKey);

  if (!force && cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  if (isCurrentlyRateLimited() && cached) {
    return { ...cached.data, _cached: true, _cachedAt: cached.timestamp };
  }

  try {
    const data = await treasuryRequest(`/api/v1/accounts/${accountId}/balance`);
    setCached(cacheKey, data, 30 * 1000); // 30s TTL
    return data;
  } catch (err) {
    if (cached) {
      return { ...cached.data, _cached: true, _cachedAt: cached.timestamp };
    }
    throw err;
  }
}

export async function getTransactions(accountId, page = 1, limit = 20, force = false) {
  const cacheKey = `transactions_${accountId}_${page}_${limit}`;
  const cached = getCached(cacheKey);

  if (!force && cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  if (isCurrentlyRateLimited() && cached) {
    return { ...cached.data, _cached: true, _cachedAt: cached.timestamp };
  }

  try {
    const data = await treasuryRequest(`/api/v1/accounts/${accountId}/transactions?page=${page}&limit=${limit}`);
    setCached(cacheKey, data, 60 * 1000); // 1 min TTL
    return data;
  } catch (err) {
    if (cached) {
      return { ...cached.data, _cached: true, _cachedAt: cached.timestamp };
    }
    throw err;
  }
}

export async function transferToPlayer({ fromAccountId, toPlayerName, amount, memo }) {
  const res = await treasuryRequest('/api/v1/transfers/to-player', {
    method: 'POST',
    body: {
      fromAccountId: Number(fromAccountId),
      toPlayerName,
      amount: String(amount),
      memo: memo || '',
    },
  });

  // Invalidate balance cache after transfer
  invalidateCache(`balance_${fromAccountId}`);
  return res;
}

export async function transferToFirm({ fromAccountId, toFirm, amount, memo }) {
  const res = await treasuryRequest('/api/v1/transfers/to-firm', {
    method: 'POST',
    body: {
      fromAccountId: Number(fromAccountId),
      toFirm,
      amount: String(amount),
      memo: memo || '',
    },
  });

  // Invalidate balance cache after transfer
  invalidateCache(`balance_${fromAccountId}`);
  return res;
}

export async function lookupPlayer(nameOrUuid) {
  const isUuid = nameOrUuid.includes('-');
  const query = isUuid ? `uuid=${encodeURIComponent(nameOrUuid)}` : `name=${encodeURIComponent(nameOrUuid)}`;
  return await treasuryRequest(`/api/v1/accounts/by-player?${query}`);
}
