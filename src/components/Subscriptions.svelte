<script>
  import { onMount } from 'svelte';

  let subscriptions = [];
  let showCreateModal = false;

  let newName = '';
  let newRecipient = '';
  let newType = 'firm'; // 'player' | 'firm'
  let newAmount = '';
  let newFrequency = 'weekly'; // 'daily' | 'weekly' | 'monthly'

  onMount(() => {
    loadSubscriptions();
  });

  function loadSubscriptions() {
    try {
      const stored = localStorage.getItem('dc_subscriptions');
      subscriptions = stored ? JSON.parse(stored) : [];
    } catch {
      subscriptions = [];
    }
  }

  function saveSubscriptions() {
    localStorage.setItem('dc_subscriptions', JSON.stringify(subscriptions));
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
    saveSubscriptions();

    // Reset
    newName = '';
    newRecipient = '';
    newAmount = '';
    showCreateModal = false;
  }

  function toggleSub(id) {
    subscriptions = subscriptions.map((s) => (s.id === id ? { ...s, active: !s.active } : s));
    saveSubscriptions();
  }

  function deleteSub(id) {
    subscriptions = subscriptions.filter((s) => s.id !== id);
    saveSubscriptions();
  }
</script>

<div class="subs-view">
  <div class="view-header">
    <div>
      <h1 class="page-title">Automated Subscriptions</h1>
      <p class="page-subtitle">Schedule recurring payments to players and businesses</p>
    </div>
    <button class="btn btn-primary" on:click={() => (showCreateModal = true)}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      New Subscription
    </button>
  </div>

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
            <div class="sub-frequency">Billed {sub.frequency}</div>
          </div>

          <div class="sub-footer">
            <button class="btn btn-outline btn-xs" on:click={() => toggleSub(sub.id)}>
              {sub.active ? 'Pause' : 'Resume'}
            </button>
            <button class="btn btn-outline btn-xs danger-btn" on:click={() => deleteSub(sub.id)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
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
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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

  .sub-frequency {
    font-size: 0.8rem;
    color: #64748b;
    text-transform: capitalize;
  }

  .sub-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    border-top: 1px solid #334155;
    padding-top: 0.8rem;
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

  .danger-btn:hover {
    color: #f87171;
    border-color: #ef4444;
  }
</style>
