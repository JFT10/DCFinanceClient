<script>
  import { onMount } from 'svelte';
  import { getAuthMe, getAccountBalance, getTransactions } from '../lib/api.js';

  export let onNavigate = (tab) => {};

  let loading = true;
  let error = null;
  let authData = null;
  let balance = null;
  let recentTransactions = [];
  let isCachedData = false;

  async function loadDashboardData(force = false) {
    loading = true;
    error = null;
    try {
      // 1. Fetch Auth/Me to determine account ID and key scope
      authData = await getAuthMe(force);

      if (authData && authData.accountId) {
        if (authData._cached) isCachedData = true;

        // 2. Fetch balance and recent transactions
        const [balRes, txRes] = await Promise.allSettled([
          getAccountBalance(authData.accountId, force),
          getTransactions(authData.accountId, 1, 5, force),
        ]);

        if (balRes.status === 'fulfilled') {
          balance = balRes.value?.balance;
          if (balRes.value?._cached) isCachedData = true;
        }

        if (txRes.status === 'fulfilled') {
          recentTransactions = txRes.value?.items || [];
          if (txRes.value?._cached) isCachedData = true;
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      // If we already have a cached balance, keep showing it cleanly
      if (balance !== null) {
        isCachedData = true;
      } else {
        error = err.message || 'Failed to load account data. Is your Treasury API key configured?';
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadDashboardData(false);
  });

  function formatCurrency(val) {
    if (val === null || val === undefined) return '$0.00';
    const num = parseFloat(val);
    if (isNaN(num)) return `$${val}`;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  }
</script>

<div class="dashboard-container">
  <div class="dashboard-header">
    <div>
      <h1 class="page-title">Overview</h1>
      <p class="page-subtitle">DemocracyCraft Treasury Economy Account</p>
    </div>
    <div class="header-actions">
      <button class="btn btn-secondary" on:click={() => loadDashboardData(true)} disabled={loading}>
        <svg class={loading ? 'spin' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
      <button class="btn btn-primary" on:click={() => onNavigate('send')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Send Money
      </button>
    </div>
  </div>

  {#if error}
    <div class="card error-card">
      <div class="error-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Authentication / Connection Notice</span>
      </div>
      <p class="error-body">{error}</p>
      <button class="btn btn-secondary btn-sm" on:click={() => onNavigate('settings')}>
        Go to Settings & Configure Key
      </button>
    </div>
  {/if}

  <div class="stats-grid">
    <!-- Balance Card -->
    <div class="card balance-card">
      <div class="card-label">Current Balance</div>
      <div class="balance-value">
        {loading && balance === null ? 'Loading...' : formatCurrency(balance)}
      </div>
      <div class="card-foot">
        <span class="badge badge-emerald">Active Treasury Account</span>
        {#if isCachedData}
          <span class="badge badge-amber">Cached Snapshot</span>
        {/if}
        {#if authData?.accountId}
          <span class="account-id">Account #{authData.accountId}</span>
        {/if}
      </div>
    </div>

    <!-- Account Details Card -->
    <div class="card info-card">
      <div class="card-label">Account Details</div>
      <div class="info-rows">
        <div class="info-row">
          <span class="info-k">Scope:</span>
          <span class="badge {authData?.keyType === 'BUSINESS' ? 'badge-blue' : 'badge-emerald'}">
            {authData?.keyType || 'PERSONAL'}
          </span>
        </div>
        <div class="info-row">
          <span class="info-k">Owner UUID:</span>
          <span class="info-v mono">{authData?.ownerUuid || 'Not connected'}</span>
        </div>
        {#if authData?.firmId}
          <div class="info-row">
            <span class="info-k">Firm ID:</span>
            <span class="info-v mono">{authData.firmId}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Recent Activity Section -->
  <div class="section-container">
    <div class="section-head">
      <h2 class="section-title">Recent Transactions</h2>
      <button class="btn btn-outline btn-sm" on:click={() => onNavigate('transactions')}>
        View All
      </button>
    </div>

    {#if recentTransactions.length === 0}
      <div class="card empty-state">
        <p>No recent transactions recorded yet for this account.</p>
      </div>
    {:else}
      <div class="card table-card">
        <table class="tx-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description / Memo</th>
              <th>System</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each recentTransactions as tx}
              <tr>
                <td class="date-col">
                  {tx.settledAt ? new Date(tx.settledAt).toLocaleDateString() : 'N/A'}
                </td>
                <td>
                  <div class="memo-title">{tx.memo || tx.message || 'Transfer'}</div>
                  {#if tx.initiatorUuid}
                    <div class="initiator-uuid mono">{tx.initiatorUuid}</div>
                  {/if}
                </td>
                <td>
                  <span class="badge badge-slate">{tx.pluginSystem || 'TREASURY'}</span>
                </td>
                <td class="text-right amount-col">
                  <span class={parseFloat(tx.amount) < 0 ? 'text-red' : 'text-green'}>
                    {formatCurrency(tx.amount)}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .page-title {
    font-size: 1.8rem;
    font-weight: 800;
    color: #f8fafc;
  }

  .page-subtitle {
    font-size: 0.9rem;
    color: #94a3b8;
    margin-top: 0.2rem;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .card-label {
    font-size: 0.8rem;
    text-transform: uppercase;
    color: #94a3b8;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .balance-value {
    font-size: 2.4rem;
    font-weight: 800;
    color: #34d399;
    font-family: var(--font-mono);
    margin: 0.5rem 0 1rem;
  }

  .card-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .account-id {
    font-size: 0.8rem;
    color: #64748b;
    font-family: var(--font-mono);
  }

  .info-rows {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .info-k {
    color: #94a3b8;
  }

  .info-v {
    color: #e2e8f0;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 0.8rem;
  }

  .section-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .table-card {
    padding: 0;
    overflow: hidden;
  }

  .tx-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 0.875rem;
  }

  .tx-table th {
    background: rgba(15, 23, 42, 0.6);
    padding: 0.75rem 1.25rem;
    color: #94a3b8;
    font-weight: 600;
    border-bottom: 1px solid #334155;
  }

  .tx-table td {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    color: #e2e8f0;
  }

  .tx-table tr:last-child td {
    border-bottom: none;
  }

  .memo-title {
    font-weight: 500;
  }

  .initiator-uuid {
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.2rem;
  }

  .text-right {
    text-align: right;
  }

  .amount-col {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.95rem;
  }

  .text-green {
    color: #34d399;
  }

  .text-red {
    color: #f87171;
  }

  .empty-state {
    text-align: center;
    color: #64748b;
    padding: 2.5rem;
  }

  .error-card {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.08);
  }

  .error-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ef4444;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .error-body {
    font-size: 0.875rem;
    color: #fca5a5;
    margin-bottom: 1rem;
  }

  .btn-sm {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }
</style>
