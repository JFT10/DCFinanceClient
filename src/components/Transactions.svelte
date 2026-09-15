<script>
  import { onMount } from 'svelte';
  import { getAuthMe, getTransactions } from '../lib/api.js';

  let loading = true;
  let error = null;
  let accountId = null;
  let currentPage = 1;
  let totalPages = 1;
  let totalItems = 0;
  let transactions = [];
  let searchQuery = '';
  let isCached = false;

  async function loadTransactions(page = 1, force = false) {
    loading = true;
    error = null;
    try {
      if (!accountId) {
        const me = await getAuthMe(force);
        accountId = me?.accountId;
      }

      if (!accountId) {
        throw new Error('No active account ID found for key.');
      }

      const res = await getTransactions(accountId, page, 20, force);
      transactions = res?.items || [];
      currentPage = res?.page || page;
      totalPages = res?.totalPages || 1;
      totalItems = res?.totalItems || 0;
      isCached = Boolean(res?._cached);
    } catch (err) {
      if (transactions.length > 0) {
        isCached = true;
      } else {
        error = err.message || 'Failed to load transactions';
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadTransactions(1, false);
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

  $: filteredTransactions = transactions.filter((tx) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const memo = (tx.memo || '').toLowerCase();
    const msg = (tx.message || '').toLowerCase();
    const init = (tx.initiatorUuid || '').toLowerCase();
    return memo.includes(q) || msg.includes(q) || init.includes(q);
  });
</script>

<div class="tx-view">
  <div class="view-header">
    <div>
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <h1 class="page-title">Transaction Ledger</h1>
        {#if isCached}
          <span class="badge badge-amber">Cached</span>
        {/if}
      </div>
      <p class="page-subtitle">Total Transactions Recorded: {totalItems}</p>
    </div>
    <div class="search-bar">
      <input
        type="text"
        class="form-input search-input"
        placeholder="Search memo or UUID..."
        bind:value={searchQuery}
      />
      <button class="btn btn-secondary" on:click={() => loadTransactions(currentPage, true)} disabled={loading}>
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="card error-box">
      <p>{error}</p>
    </div>
  {/if}

  <div class="card table-card">
    {#if loading && transactions.length === 0}
      <div class="loading-box">
        <p>Loading transactions...</p>
      </div>
    {:else if filteredTransactions.length === 0}
      <div class="empty-box">
        <p>No transactions matched your criteria.</p>
      </div>
    {:else}
      <table class="tx-table">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Posting ID</th>
            <th>Memo / Details</th>
            <th>System</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredTransactions as tx}
            <tr>
              <td class="date-col">
                <div class="date-main">
                  {tx.settledAt ? new Date(tx.settledAt).toLocaleDateString() : 'N/A'}
                </div>
                <div class="date-sub">
                  {tx.settledAt ? new Date(tx.settledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </td>
              <td class="mono id-col">#{tx.postingId || tx.txnId}</td>
              <td>
                <div class="memo-title">{tx.memo || tx.message || 'Transfer'}</div>
                {#if tx.initiatorUuid}
                  <div class="initiator-uuid mono">Initiator: {tx.initiatorUuid}</div>
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
    {/if}

    <div class="pagination-footer">
      <span class="pagination-info">
        Page {currentPage} of {Math.max(totalPages, 1)}
      </span>
      <div class="pagination-btns">
        <button
          class="btn btn-secondary btn-sm"
          disabled={currentPage <= 1 || loading}
          on:click={() => loadTransactions(currentPage - 1)}
        >
          Previous
        </button>
        <button
          class="btn btn-secondary btn-sm"
          disabled={currentPage >= totalPages || loading}
          on:click={() => loadTransactions(currentPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .tx-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .view-header {
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

  .search-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .search-input {
    width: 240px;
    padding: 0.5rem 0.8rem;
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
    padding: 0.9rem 1.25rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    color: #e2e8f0;
  }

  .date-main {
    font-weight: 500;
  }

  .date-sub {
    font-size: 0.75rem;
    color: #64748b;
  }

  .id-col {
    color: #94a3b8;
    font-size: 0.8rem;
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

  .mono {
    font-family: var(--font-mono);
  }

  .pagination-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: rgba(15, 23, 42, 0.5);
    border-top: 1px solid #334155;
  }

  .pagination-info {
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .pagination-btns {
    display: flex;
    gap: 0.5rem;
  }

  .btn-sm {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }

  .loading-box, .empty-box {
    text-align: center;
    padding: 3rem;
    color: #64748b;
  }

  .error-box {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
    color: #fca5a5;
  }
</style>
