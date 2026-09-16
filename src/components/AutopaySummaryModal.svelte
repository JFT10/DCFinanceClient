<script>
  export let summary = null;
  export let onClose = () => {};
</script>

<div class="modal-backdrop">
  <div class="modal-card">
    <div class="modal-header">
      <div class="icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      </div>
      <div>
        <h3 class="modal-title">Startup Autopay Complete</h3>
        <p class="modal-subtitle">Automatically settled scheduled subscriptions</p>
      </div>
    </div>

    <div class="modal-body">
      <div class="summary-stat">
        <div class="stat-item">
          <span class="stat-label">Subscriptions Paid</span>
          <span class="stat-val">{summary?.executed || 0}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Debited</span>
          <span class="stat-val font-mono">${summary?.totalAmount || '0.00'}</span>
        </div>
      </div>

      {#if summary?.items && summary.items.length > 0}
        <div class="sub-list">
          {#each summary.items as item}
            <div class="sub-row">
              <div class="sub-info">
                <span class="sub-name">{item.name}</span>
                <span class="sub-meta">To: {item.recipient} ({item.type}) • Txn #{item.txnId}</span>
              </div>
              <span class="sub-amount font-mono">-${item.amount}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if summary?.errors && summary.errors.length > 0}
        <div class="error-box">
          <div class="err-title">Failed Payments:</div>
          {#each summary.errors as err}
            <div class="err-row">
              <span>{err.name} ({err.recipient}): {err.error}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn btn-primary" on:click={onClose}>
        Done
      </button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    width: 100%;
    max-width: 520px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #334155;
    background: rgba(16, 185, 129, 0.05);
  }

  .icon-wrap {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    width: 42px;
    height: 42px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .modal-subtitle {
    font-size: 0.85rem;
    color: #94a3b8;
    margin-top: 0.2rem;
  }

  .modal-body {
    padding: 1.5rem;
  }

  .summary-stat {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .stat-item {
    background: #0f172a;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid #334155;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    color: #64748b;
    font-weight: 600;
    text-transform: uppercase;
  }

  .stat-val {
    font-size: 1.2rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .font-mono {
    font-family: var(--font-mono);
    color: #34d399;
  }

  .sub-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 200px;
    overflow-y: auto;
  }

  .sub-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #0f172a;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid #334155;
  }

  .sub-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .sub-name {
    font-weight: 600;
    color: #f8fafc;
    font-size: 0.9rem;
  }

  .sub-meta {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .sub-amount {
    font-size: 0.95rem;
    font-weight: 700;
    color: #34d399;
  }

  .error-box {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-top: 1rem;
    font-size: 0.8rem;
    color: #fca5a5;
  }

  .err-title {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 1rem 1.5rem;
    background: #0f172a;
    border-top: 1px solid #334155;
  }
</style>
