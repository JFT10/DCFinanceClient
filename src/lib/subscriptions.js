/**
 * DemocracyCraft Finance - Subscription & Autopay Engine
 * Handles recurring payment schedules (daily, weekly, monthly),
 * rate-limit pacing, duplicate prevention, and transaction history.
 */

import { getAuthMe, transferToPlayer, transferToFirm } from './api.js';
import { invalidateCache } from './cache.js';

const STORAGE_KEY = 'dc_subscriptions';
const HISTORY_KEY = 'dc_autopay_history';
const SETTING_AUTOPAY_KEY = 'dc_autopay_enabled';

/**
 * Load all user subscriptions from local storage.
 */
export function loadSubscriptions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save subscriptions to local storage.
 */
export function saveSubscriptions(subscriptions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

/**
 * Load execution history.
 */
export function loadAutopayHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Append entry to history (bounded to 100 entries to prevent memory leaks).
 */
export function recordHistoryEntry(entry) {
  const history = loadAutopayHistory();
  const updated = [entry, ...history].slice(0, 100);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

/**
 * Check whether a subscription is currently due for payment.
 */
export function isSubscriptionDue(sub) {
  if (!sub.active) return false;
  if (!sub.lastPaid) return true;

  const last = new Date(sub.lastPaid).getTime();
  const now = Date.now();
  const diffMs = now - last;

  switch (sub.frequency) {
    case 'daily':
      return diffMs >= 24 * 60 * 60 * 1000;
    case 'weekly':
      return diffMs >= 7 * 24 * 60 * 60 * 1000;
    case 'monthly':
      return diffMs >= 30 * 24 * 60 * 60 * 1000;
    default:
      return false;
  }
}

/**
 * Calculate human-readable next due date for a subscription.
 */
export function getNextDueDate(sub) {
  if (!sub.active) return 'Paused';
  if (!sub.lastPaid) return 'Due Now';

  const last = new Date(sub.lastPaid).getTime();
  let intervalMs = 24 * 60 * 60 * 1000;
  if (sub.frequency === 'weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;
  if (sub.frequency === 'monthly') intervalMs = 30 * 24 * 60 * 60 * 1000;

  const nextTime = last + intervalMs;
  const diff = nextTime - Date.now();

  if (diff <= 0) return 'Due Now';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
  return 'in < 1 hour';
}

/**
 * Check if automated startup autopay is enabled by the user.
 */
export function isAutopayEnabled() {
  const val = localStorage.getItem(SETTING_AUTOPAY_KEY);
  return val === null ? true : val === 'true';
}

export function setAutopayEnabled(enabled) {
  localStorage.setItem(SETTING_AUTOPAY_KEY, String(enabled));
}

/**
 * Scans all active subscriptions and executes transfers for any that are due.
 * Paces requests with a 1.5-second delay to comply with the 30 req/min rate limit.
 * 
 * Returns summary: { executed: number, totalAmount: string, items: array, errors: array }
 */
export async function executeDueSubscriptions() {
  const subscriptions = loadSubscriptions();
  const due = subscriptions.filter(isSubscriptionDue);

  if (due.length === 0) {
    return { executed: 0, totalAmount: '0.00', items: [], errors: [] };
  }

  // Get current source account ID
  const auth = await getAuthMe();
  if (!auth?.accountId) {
    throw new Error('No active account ID found. Cannot execute subscriptions.');
  }

  const results = [];
  const errors = [];
  let totalAmount = 0;

  // Process sequentially to prevent burst rate-limiting
  for (const sub of due) {
    try {
      let res;
      const memo = `Autopay: ${sub.name}`;

      if (sub.type === 'firm') {
        res = await transferToFirm({
          fromAccountId: auth.accountId,
          toFirm: sub.recipient,
          amount: sub.amount,
          memo,
        });
      } else {
        res = await transferToPlayer({
          fromAccountId: auth.accountId,
          toPlayerName: sub.recipient,
          amount: sub.amount,
          memo,
        });
      }

      // Update lastPaid timestamp on this subscription
      const settledAt = res?.settledAt || new Date().toISOString();
      sub.lastPaid = settledAt;
      totalAmount += parseFloat(sub.amount) || 0;

      const resultItem = {
        subId: sub.id,
        name: sub.name,
        recipient: sub.recipient,
        type: sub.type,
        amount: sub.amount,
        txnId: res?.txnId || 'Settled',
        timestamp: settledAt,
        status: 'success',
      };

      results.push(resultItem);
      recordHistoryEntry(resultItem);

      // 1.5-second pacing between payments to protect rate limits
      if (due.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (err) {
      const errorItem = {
        subId: sub.id,
        name: sub.name,
        recipient: sub.recipient,
        amount: sub.amount,
        error: err.message || 'Payment failed',
        timestamp: new Date().toISOString(),
        status: 'failed',
      };
      errors.push(errorItem);
      recordHistoryEntry(errorItem);
    }
  }

  // Save updated lastPaid states
  saveSubscriptions(subscriptions);

  // Invalidate balance cache so dashboard reflects new balance immediately
  invalidateCache(`balance_${auth.accountId}`);

  return {
    executed: results.length,
    totalAmount: totalAmount.toFixed(2),
    items: results,
    errors,
  };
}
