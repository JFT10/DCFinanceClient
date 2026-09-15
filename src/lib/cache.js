/**
 * Memory-safe client-side cache and rate limit coordinator.
 * 
 * Features:
 * - Bounded in-memory map (max 30 items, LRU-like eviction) to prevent memory leaks.
 * - LocalStorage persistence for critical values (balance, account info, update checks).
 * - Centralized 429 rate limit tracking with countdown.
 * - Clean subscriber pattern with unbind handlers to avoid closure leaks.
 */

const MAX_CACHE_ENTRIES = 30;
const memoryCache = new Map();

// Rate limit state
let rateLimitUntil = 0; // timestamp (ms)
const rateLimitListeners = new Set();

/**
 * Register a listener for rate-limit status updates.
 * Returns an unbind function to prevent memory leaks.
 */
export function subscribeRateLimit(callback) {
  rateLimitListeners.add(callback);
  // Send current state immediately
  callback({
    isRateLimited: isCurrentlyRateLimited(),
    remainingSeconds: getRemainingRateLimitSeconds(),
  });

  return () => {
    rateLimitListeners.delete(callback);
  };
}

function notifyRateLimitListeners() {
  const isLimited = isCurrentlyRateLimited();
  const remaining = getRemainingRateLimitSeconds();
  for (const listener of rateLimitListeners) {
    try {
      listener({ isRateLimited: isLimited, remainingSeconds: remaining });
    } catch (err) {
      console.error('Error in rate limit listener:', err);
    }
  }
}

export function isCurrentlyRateLimited() {
  return Date.now() < rateLimitUntil;
}

export function getRemainingRateLimitSeconds() {
  const diff = rateLimitUntil - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

export function setRateLimitActive(seconds = 60) {
  const durationMs = Math.max(seconds, 5) * 1000;
  rateLimitUntil = Math.max(rateLimitUntil, Date.now() + durationMs);
  notifyRateLimitListeners();
}

export function clearRateLimit() {
  rateLimitUntil = 0;
  notifyRateLimitListeners();
}

/**
 * Cache Get: Checks in-memory cache first, then localStorage fallback.
 */
export function getCached(key) {
  // 1. Memory check
  const memEntry = memoryCache.get(key);
  if (memEntry) {
    return memEntry;
  }

  // 2. Storage check
  try {
    const raw = localStorage.getItem(`dc_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Re-populate memory cache (with LRU guard)
      setMemoryEntry(key, parsed);
      return parsed;
    }
  } catch {
    // Ignore JSON/Storage errors
  }

  return null;
}

/**
 * Cache Set: Writes to memory and optionally to localStorage.
 */
export function setCached(key, data, ttlMs = 60000, persistToStorage = true) {
  const entry = {
    data,
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };

  setMemoryEntry(key, entry);

  if (persistToStorage) {
    try {
      localStorage.setItem(`dc_cache_${key}`, JSON.stringify(entry));
    } catch {
      // Storage might be full or blocked
    }
  }

  return data;
}

/**
 * Safe in-memory store with bounded size to prevent memory leaks.
 */
function setMemoryEntry(key, entry) {
  // Evict oldest entries if capacity reached
  if (memoryCache.size >= MAX_CACHE_ENTRIES && !memoryCache.has(key)) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) {
      memoryCache.delete(oldestKey);
    }
  }
  memoryCache.set(key, entry);
}

/**
 * Clear cache for specific key
 */
export function invalidateCache(key) {
  memoryCache.delete(key);
  try {
    localStorage.removeItem(`dc_cache_${key}`);
  } catch {}
}
