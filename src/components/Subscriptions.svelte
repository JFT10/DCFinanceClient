<script>
  import { onMount } from 'svelte';
  import {
    loadSubscriptions,
    saveSubscriptions,
    getNextDueDate,
    isSubscriptionDue,
    executeDueSubscriptions,
    loadAutopayHistory,
  } from '../lib/subscriptions.js';

  let subscriptions = [];
  let history = [];
  let showCreateModal = false;
  let processingAutopay = false;
  let autopayStatus = null;

  let newName = '';
  let newRecipient = '';
  let newType = 'firm'; // 'player' | 'firm'
  let newAmount = '';
  let newFrequency = 'weekly'; // 'daily' | 'weekly' | 'monthly'

  onMount(() => {
    refreshData();
  });

  function refreshData() {
    subscriptions = loadSubscriptions();
    history = loadAutopayHistory();
  }

  function addSubscription() {
    if (!newName.trim() || !newRecipient.trim() || !newAmount.trim()) return;

    const sub = {
      id: Date.now().toString(),
      name: newName.trim(),
      recipient: newRecipient.trim(),
      type: newType,
      amount: newAmount.trim(),
      frequency: newFrequency,
      active: true,
      lastPaid: null,
      createdAt: new Date().toISOString(),
    };

    subscriptions = [sub, ...subscriptions];
    saveSubscriptions(subscriptions);

    // Reset
    newName = '';
    newRecipient = '';
    newAmount = '';
    showCreateModal = false;
  }

  function toggleSub(id) {
    subscriptions = subscriptions.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    saveSubscriptions(subscriptions);
  }

  function deleteSub(id) {
    subscriptions = subscriptions.filter((s) => s.id !== id);
    saveSubscriptions(subscriptions);
  }

  async function handleRunDueNow() {
    processingAutopay = true;
    autopayStatus = null;
    try {
      const summary = await executeDueSubscriptions();
      refreshData();
      if (summary.executed > 0) {
        autopayStatus = {
          success: true,
          message: `Processed ${summary.executed} subscription(s) for $${summary.totalAmount}!`,
        };
      } else if (summary.errors.length > 0) {
        autopayStatus = {
          success: false,
          message: `Encountered errors: ${summary.errors.map((e) => e.error).join(', ')}`,
        };
      } else {
        autopayStatus = {
          success: true,
          message: 'All subscriptions are currently up to date.',
        };
      }
    } catch (err) {
      autopayStatus = {
        success: false,
        message: err.message || 'Failed to execute subscriptions',
      };
    } finally {
      processingAutopay = false;
      setTimeout(() => (autopayStatus = null), 6000);
    }
  }

  $: dueCount = subscriptions.filter(isSubscriptionDue).length;
</script>

<div class="subs-view">
  <div class="view-header">
    <div>
      <h1 class="page-title">Automated Subscriptions</h1>
      <p class="page-subtitle">Schedule recurring payments to players and businesses</p>
    </div>
    <div class="header-actions">
      <button
        class="btn btn-secondary"
        on:click={handleRunDueNow}
        disabled={processingAutopay || subscriptions.length === 0}
      >
        <svg class={processingAutopay ? 'spin' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10"/>
          <polyline points="1 20 1 14 7 14"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
        {processingAutopay ? 'Paying Due Subscriptions...' : `Run Due Now (${dueCount})`}
      </button>

      <button class="btn btn-primary" on:click={() => (showCreateModal = true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        New Subscription
      </button>
    </div>
  </div>

  {#if autopayStatus}
    <div class="card {autopayStatus.success ? 'status-success' : 'status-err'}">
      {autopayStatus.message}
    </div>
  {/if}

  {#if subscriptions.length === 0}
    <div class="card empty-card">
      <div class="empty-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      </div>
      <h3>No Subscriptions Active</h3>
      <p>Set up automated recurring dues for plot leases, business services, or club memberships.</p>
      <button class="btn btn-primary btn-sm" on:click={() => (showCreateModal = true)}>
        Create First Subscription
      </button>
    </div>
  {:else}
    <div class="subs-grid">
      {#each subscriptions as sub}
        <div class="card sub-card {sub.active ? '' : 'paused'}">
          <div class="sub-header">
            <div>
              <h3 class="sub-name">{sub.name}</h3>
              <div class="sub-target">
                {sub.type === 'firm' ? 'Business: ' : 'Player: '}
                <strong>{sub.recipient}</strong>
              </div>
            </div>
            <span class="badge {sub.active ? 'badge-emerald' : 'badge-slate'}">
              {sub.active ? 'Active' : 'Paused'}
            </span>
          </div>

          <div class="sub-body">
            <div class="sub-amount">${sub.amount}</div>
            <div class="sub-meta-row">
              <span class="sub-frequency">Billed {sub.frequency}</span>
              <span class="due-tag {isSubscriptionDue(sub) ? 'due-now' : ''}">
                {getNextDueDate(sub)}
              </span>
            </div>
          </div>

          <div class="sub-footer">
            <div class="last-paid">
              Last paid: {sub.lastPaid ? new Date(sub.lastPaid).toLocaleDateString() : 'Never'}
            </div>
            <div class="card-actions">
              <button class="btn btn-outline btn-xs" on:click={() => toggleSub(sub.id)}>
                {sub.active ? 'Pause' : 'Resume'}
              </button>
              <button class="btn btn-outline btn-xs danger-btn" on:click={() => deleteSub(sub.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Autopay Execution History Section -->
  {#if history.length > 0}
    <div class="history-section">
      <div class="section-title">Autopay Execution History</div>
      <div class="card table-card">
        <table class="history-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Subscription</th>
              <th>Recipient</th>
              <th>Status / Txn</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {#each history.slice(0, 10) as item}
              <tr>
                <td class="date-col">
                  {new Date(item.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td><strong>{item.name}</strong></td>
                <td>{item.recipient} ({item.type})</td>
                <td>
                  {#if item.status === 'success'}
                    <span class="badge badge-emerald">Txn #{item.txnId}</span>
                  {:else}
                    <span class="badge badge-amber">{item.error}</span>
                  {/if}
                </td>
                <td class="text-right font-mono">${item.amount}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}

  {#if showCreateModal}
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="modal-header">
          <h3>Add Recurring Subscription</h3>
          <button class="btn btn-outline btn-xs" on:click={() => (showCreateModal = false)}>✕</button>
        </div>
        <form on:submit|preventDefault={addSubscription} class="modal-body">
          <div class="form-group">
            <label class="form-label" for="sub-name">Subscription Name</label>
            <input id="sub-name" class="form-input" placeholder="e.g. Oak Street Plot Lease" bind:value={newName} required />
          </div>

          <div class="form-group">
            <label class="form-label" for="sub-type">Recipient Type</label>
            <select id="sub-type" class="form-input" bind:value={newType}>
              <option value="firm">Business / Firm</option>
              <option value="player">Individual Player</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="sub-target">Recipient Name</label>
            <input id="sub-target" class="form-input" placeholder="e.g. RealtyCorp or Notch" bind:value={newRecipient} required />
          </div>

          <div class="form-group">
            <label class="form-label" for="sub-amount">Amount ($)</label>
            <input id="sub-amount" class="form-input" placeholder="50.00" bind:value={newAmount} required />
          </div>

          <div class="form-group">
            <label class="form-label" for="sub-freq">Billing Frequency</label>
            <select id="sub-freq" class="form-input" bind:value={newFrequency}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" on:click={() => (showCreateModal = false)}>
              Cancel
            </button>
            <button type="submit" class="btn btn-primary">
              Save Subscription
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>

<style>
  .subs-view {
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

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
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

  .empty-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 3rem;
    gap: 1rem;
  }

  .empty-icon {
    background: rgba(148, 163, 184, 0.1);
    padding: 1rem;
    border-radius: 50%;
  }

  .subs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .sub-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 1.2rem;
  }

  .sub-card.paused {
    opacity: 0.6;
  }

  .sub-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .sub-name {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .sub-target {
    font-size: 0.8rem;
    color: #94a3b8;
    margin-top: 0.2rem;
  }

  .sub-amount {
    font-size: 1.6rem;
    font-family: var(--font-mono);
    font-weight: 800;
    color: #34d399;
  }

  .sub-meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0.25rem;
  }

  .sub-frequency {
    font-size: 0.8rem;
    color: #64748b;
    text-transform: capitalize;
  }

  .due-tag {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
  }

  .due-tag.due-now {
    color: #f59e0b;
    font-weight: 700;
  }

  .sub-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #334155;
    padding-top: 0.8rem;
  }

  .last-paid {
    font-size: 0.75rem;
    color: #64748b;
  }

  .card-actions {
    display: flex;
    gap: 0.4rem;
  }

  .history-section {
    margin-top: 1.5rem;
  }

  .section-title {
    font-size: 1.2rem;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 0.75rem;
  }

  .table-card {
    padding: 0;
    overflow: hidden;
  }

  .history-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    text-align: left;
  }

  .history-table th {
    background: rgba(15, 23, 42, 0.6);
    padding: 0.65rem 1rem;
    color: #94a3b8;
    font-weight: 600;
    border-bottom: 1px solid #334155;
  }

  .history-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    color: #e2e8f0;
  }

  .text-right {
    text-align: right;
  }

  .font-mono {
    font-family: var(--font-mono);
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 12px;
    width: 100%;
    max-width: 480px;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.2rem 1.5rem;
    border-bottom: 1px solid #334155;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn-xs {
    padding: 0.25rem 0.6rem;
    font-size: 0.75rem;
  }

  .status-success {
    background: rgba(16, 185, 129, 0.1);
    border-color: #10b981;
    color: #34d399;
    padding: 0.75rem 1rem;
  }

  .status-err {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #fca5a5;
    padding: 0.75rem 1rem;
  }

  .danger-btn:hover {
    color: #f87171;
    border-color: #ef4444;
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
