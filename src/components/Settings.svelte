<script>
  import { onMount } from 'svelte';
  import { loadApiKey, saveApiKey, getAuthMe, checkForUpdates, isTauri } from '../lib/api.js';

  export let onTriggerUpdateModal = (info) => {};

  let apiKey = '';
  let showKey = false;
  let saving = false;
  let testing = false;
  let checkingUpdate = false;

  let testResult = null;
  let updateStatus = null;
  let saveMessage = null;

  onMount(async () => {
    apiKey = await loadApiKey();
  });

  async function handleSaveKey() {
    saving = true;
    saveMessage = null;
    try {
      await saveApiKey(apiKey);
      saveMessage = 'API key saved to key.env successfully!';
      setTimeout(() => (saveMessage = null), 4000);
    } catch (err) {
      saveMessage = 'Error saving key: ' + err.message;
    } finally {
      saving = false;
    }
  }

  async function testConnection() {
    testing = true;
    testResult = null;
    try {
      // Save key first in case edited
      await saveApiKey(apiKey);
      const res = await getAuthMe();
      testResult = {
        success: true,
        account: res,
      };
    } catch (err) {
      testResult = {
        success: false,
        error: err.message || 'Failed to authenticate key',
      };
    } finally {
      testing = false;
    }
  }

  async function triggerManualUpdateCheck() {
    checkingUpdate = true;
    updateStatus = null;
    try {
      const res = await checkForUpdates();
      if (res?.update_available) {
        onTriggerUpdateModal(res);
      } else {
        updateStatus = {
          upToDate: true,
          sha: res?.latest_commit_sha || 'main',
          message: 'Client is up to date with origin/main.',
        };
      }
    } catch (err) {
      updateStatus = {
        upToDate: false,
        error: err.message || 'Failed to check GitHub updates',
      };
    } finally {
      checkingUpdate = false;
    }
  }
</script>

<div class="settings-view">
  <div class="view-header">
    <div>
      <h1 class="page-title">Settings & Configuration</h1>
      <p class="page-subtitle">Manage API credentials, updates, and environment status</p>
    </div>
  </div>

  <!-- API Key Card -->
  <div class="card settings-card">
    <div class="card-header">
      <div class="header-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div>
        <h2 class="card-title">DemocracyCraft Treasury API Key</h2>
        <p class="card-desc">
          Loaded from <code>key.env</code>. Keys are stored locally on your device and are never sent anywhere except the official Treasury API.
        </p>
      </div>
    </div>

    <div class="card-body">
      <div class="form-group">
        <div class="label-row">
          <label class="form-label" for="key-input">JWT Token</label>
          <button class="text-btn" on:click={() => (showKey = !showKey)}>
            {showKey ? 'Hide Secret' : 'Show Secret'}
          </button>
        </div>

        <input
          id="key-input"
          type={showKey ? 'text' : 'password'}
          class="form-input mono"
          placeholder="eyJhbGciOi..."
          bind:value={apiKey}
        />
      </div>

      {#if saveMessage}
        <div class="save-msg">{saveMessage}</div>
      {/if}

      {#if testResult}
        {#if testResult.success}
          <div class="conn-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div>
              <strong>Authentication Successful!</strong>
              <div>Owner: <code>{testResult.account.ownerUuid}</code></div>
              <div>Account #{testResult.account.accountId} ({testResult.account.keyType})</div>
            </div>
          </div>
        {:else}
          <div class="conn-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <strong>Authentication Failed:</strong> {testResult.error}
            </div>
          </div>
        {/if}
      {/if}

      <div class="btn-row">
        <button class="btn btn-secondary" on:click={handleSaveKey} disabled={saving}>
          {saving ? 'Saving...' : 'Save to key.env'}
        </button>
        <button class="btn btn-primary" on:click={testConnection} disabled={testing || !apiKey}>
          {testing ? 'Testing Key...' : 'Test Connection'}
        </button>
      </div>
    </div>
  </div>

  <!-- Updates & System Info Card -->
  <div class="card settings-card">
    <div class="card-header">
      <div class="header-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
      </div>
      <div>
        <h2 class="card-title">Version & Updates</h2>
        <p class="card-desc">Tracking repository: <code>JFT10/DCFinanceClient</code> on branch <code>main</code></p>
      </div>
    </div>

    <div class="card-body">
      <div class="system-stats">
        <div class="stat-box">
          <span class="stat-label">Client Version</span>
          <span class="stat-val">v0.1.0</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">Runtime Engine</span>
          <span class="stat-val">{isTauri() ? 'Tauri Desktop (Rust)' : 'Browser Dev / Preview'}</span>
        </div>
        <div class="stat-box">
          <span class="stat-label">License</span>
          <span class="stat-val">AGPLv3</span>
        </div>
      </div>

      {#if updateStatus}
        <div class="update-banner {updateStatus.upToDate ? 'up-to-date' : 'update-err'}">
          {updateStatus.message || updateStatus.error}
        </div>
      {/if}

      <div class="btn-row">
        <button class="btn btn-secondary" on:click={triggerManualUpdateCheck} disabled={checkingUpdate}>
          <svg class={checkingUpdate ? 'spin' : ''} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          {checkingUpdate ? 'Checking GitHub...' : 'Check for Updates Now'}
        </button>
        <a href="https://github.com/JFT10/DCFinanceClient" target="_blank" rel="noreferrer" class="btn btn-outline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
          </svg>
          View GitHub Repository
        </a>
      </div>
    </div>
  </div>
</div>

<style>
  .settings-view {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 760px;
    margin: 0 auto;
    width: 100%;
  }

  .view-header {
    margin-bottom: 0.5rem;
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

  .settings-card {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    border-bottom: 1px solid #334155;
    padding-bottom: 1rem;
  }

  .header-icon {
    background: #0f172a;
    padding: 0.6rem;
    border-radius: 8px;
    border: 1px solid #334155;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-title {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .card-desc {
    font-size: 0.85rem;
    color: #94a3b8;
    margin-top: 0.25rem;
    line-height: 1.4;
  }

  .label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
  }

  .text-btn {
    background: none;
    border: none;
    color: #34d399;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .btn-row {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-top: 1rem;
  }

  .save-msg {
    font-size: 0.85rem;
    color: #34d399;
    margin-bottom: 0.5rem;
  }

  .conn-success {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #34d399;
    margin-top: 0.5rem;
  }

  .conn-error {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    color: #fca5a5;
    margin-top: 0.5rem;
  }

  .system-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 600px) {
    .system-stats {
      grid-template-columns: 1fr;
    }
  }

  .stat-box {
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
    font-size: 0.9rem;
    font-weight: 600;
    color: #cbd5e1;
  }

  .update-banner {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }

  .up-to-date {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .update-err {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
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
