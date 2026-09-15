<script>
  import { onMount } from 'svelte';
  import { getAuthMe, getAccountBalance, transferToPlayer, transferToFirm } from '../lib/api.js';

  export let onNavigate = (tab) => {};

  let transferType = 'player'; // 'player' | 'firm'
  let recipient = '';
  let amount = '';
  let memo = '';

  let loading = false;
  let error = null;
  let success = null;

  let authData = null;
  let currentBalance = null;

  onMount(async () => {
    try {
      authData = await getAuthMe();
      if (authData?.accountId) {
        const bal = await getAccountBalance(authData.accountId);
        currentBalance = bal?.balance;
      }
    } catch (err) {
      console.warn('Could not pre-fetch balance for transfer:', err);
    }
  });

  function validateAmount(val) {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0 && /^\d+(\.\d{1,2})?$/.test(val);
  }

  async function handleTransfer() {
    error = null;
    success = null;

    if (!recipient.trim()) {
      error = transferType === 'player' ? 'Please enter a player username.' : 'Please enter a firm name.';
      return;
    }

    if (!validateAmount(amount)) {
      error = 'Please enter a valid positive amount with up to 2 decimal places (e.g. 25.50).';
      return;
    }

    if (!authData?.accountId) {
      error = 'Could not determine source account ID. Please check your API key in Settings.';
      return;
    }

    loading = true;

    try {
      let res;
      if (transferType === 'player') {
        res = await transferToPlayer({
          fromAccountId: authData.accountId,
          toPlayerName: recipient.trim(),
          amount: amount.trim(),
          memo: memo.trim(),
        });
      } else {
        res = await transferToFirm({
          fromAccountId: authData.accountId,
          toFirm: recipient.trim(),
          amount: amount.trim(),
          memo: memo.trim(),
        });
      }

      success = {
        txnId: res?.txnId || 'Settled',
        recipient: recipient.trim(),
        amount: amount.trim(),
        settledAt: res?.settledAt || new Date().toISOString(),
      };

      // Reset form
      recipient = '';
      amount = '';
      memo = '';

      // Refresh balance
      const bal = await getAccountBalance(authData.accountId);
      currentBalance = bal?.balance;
    } catch (err) {
      error = err.message || 'Transfer failed. Check recipient name and account balance.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="send-view">
  <div class="view-header">
    <div>
      <h1 class="page-title">Send Money</h1>
      <p class="page-subtitle">Instant, cryptographically signed Treasury transfers</p>
    </div>
    {#if currentBalance !== null}
      <div class="bal-pill">
        <span class="bal-pill-label">Available:</span>
        <span class="bal-pill-val">${currentBalance}</span>
      </div>
    {/if}
  </div>

  {#if success}
    <div class="card success-card">
      <div class="success-header">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <span>Payment Successfully Sent!</span>
      </div>
      <p class="success-desc">
        Transferred <strong>${success.amount}</strong> to <strong>{success.recipient}</strong> (Txn #{success.txnId}).
      </p>
      <div class="success-actions">
        <button class="btn btn-secondary btn-sm" on:click={() => (success = null)}>
          Send Another Transfer
        </button>
        <button class="btn btn-primary btn-sm" on:click={() => onNavigate('transactions')}>
          View in Ledger
        </button>
      </div>
    </div>
  {/if}

  {#if error}
    <div class="card error-card">
      <div class="error-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Transfer Error</span>
      </div>
      <p class="error-body">{error}</p>
    </div>
  {/if}

  <div class="card form-card">
    <div class="type-toggle">
      <button
        class="toggle-btn {transferType === 'player' ? 'active' : ''}"
        on:click={() => (transferType = 'player')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        Transfer to Player
      </button>
      <button
        class="toggle-btn {transferType === 'firm' ? 'active' : ''}"
        on:click={() => (transferType = 'firm')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
        Transfer to Business / Firm
      </button>
    </div>

    <form on:submit|preventDefault={handleTransfer}>
      <div class="form-group">
        <label class="form-label" for="recipient-input">
          {transferType === 'player' ? 'Player Minecraft Username' : 'Firm Name'}
        </label>
        <input
          id="recipient-input"
          type="text"
          class="form-input"
          placeholder={transferType === 'player' ? 'e.g. Steve' : 'e.g. BankOfDC'}
          bind:value={recipient}
          required
        />
      </div>

      <div class="form-group">
        <label class="form-label" for="amount-input">Amount ($)</label>
        <div class="amount-wrap">
          <span class="currency-symbol">$</span>
          <input
            id="amount-input"
            type="text"
            inputmode="decimal"
            class="form-input amount-input"
            placeholder="0.00"
            bind:value={amount}
            required
          />
        </div>
        <span class="field-hint">Amounts are sent as precision-safe decimal strings.</span>
      </div>

      <div class="form-group">
        <label class="form-label" for="memo-input">Memo / Description (Optional)</label>
        <input
          id="memo-input"
          type="text"
          class="form-input"
          placeholder="e.g. Payment for plot rental or goods"
          bind:value={memo}
          maxlength="128"
        />
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary submit-btn" disabled={loading}>
          {#if loading}
            <span>Processing Transfer...</span>
          {:else}
            <span>Send ${amount || '0.00'}</span>
          {/if}
        </button>
      </div>
    </form>
  </div>
</div>

<style>
  .send-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 680px;
    margin: 0 auto;
    width: 100%;
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

  .bal-pill {
    background: #1e293b;
    border: 1px solid #334155;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .bal-pill-label {
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .bal-pill-val {
    font-family: var(--font-mono);
    color: #34d399;
    font-weight: 700;
  }

  .type-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: #0f172a;
    padding: 0.25rem;
    border-radius: 10px;
    margin-bottom: 1.5rem;
    border: 1px solid #334155;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border: none;
    background: transparent;
    color: #94a3b8;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn.active {
    background: #1e293b;
    color: #f8fafc;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .amount-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .currency-symbol {
    position: absolute;
    left: 1rem;
    color: #94a3b8;
    font-size: 1.1rem;
    font-weight: 600;
  }

  .amount-input {
    padding-left: 2.2rem;
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 600;
  }

  .field-hint {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
    margin-top: 0.35rem;
  }

  .submit-btn {
    width: 100%;
    padding: 0.85rem;
    font-size: 1rem;
  }

  .success-card {
    border-color: #10b981;
    background: rgba(16, 185, 129, 0.08);
  }

  .success-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: #34d399;
    font-size: 1.1rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .success-desc {
    color: #e2e8f0;
    font-size: 0.95rem;
    margin-bottom: 1rem;
  }

  .success-actions {
    display: flex;
    gap: 0.75rem;
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
  }

  .btn-sm {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
</style>
