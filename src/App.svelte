<script>
  import { onMount } from 'svelte';
  import Dashboard from './components/Dashboard.svelte';
  import Transactions from './components/Transactions.svelte';
  import SendMoney from './components/SendMoney.svelte';
  import Subscriptions from './components/Subscriptions.svelte';
  import Settings from './components/Settings.svelte';
  import UpdateModal from './components/UpdateModal.svelte';
  import RateLimitNotice from './components/RateLimitNotice.svelte';
  import { checkForUpdates } from './lib/api.js';

  let currentTab = 'dashboard';
  let updateInfo = null;
  let showUpdateModal = false;

  onMount(async () => {
    // Automatically query GitHub when the application first opens to check for updates on main branch
    try {
      const res = await checkForUpdates();
      if (res && res.update_available) {
        updateInfo = res;
        showUpdateModal = true;
      }
    } catch (err) {
      console.warn('Startup update check notification error:', err);
    }
  });

  function handleNavigate(tab) {
    currentTab = tab;
  }

  function handleTriggerModal(info) {
    updateInfo = info;
    showUpdateModal = true;
  }
</script>

<main class="app-layout">
  <!-- Sidebar Navigation -->
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-logo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"/>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      </div>
      <div>
        <div class="brand-title">DC Finance</div>
        <div class="brand-badge">Client v0.1.0</div>
      </div>
    </div>

    <nav class="nav-links">
      <button
        class="nav-item {currentTab === 'dashboard' ? 'active' : ''}"
        on:click={() => handleNavigate('dashboard')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
        </svg>
        <span>Overview</span>
      </button>

      <button
        class="nav-item {currentTab === 'transactions' ? 'active' : ''}"
        on:click={() => handleNavigate('transactions')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span>Transactions</span>
      </button>

      <button
        class="nav-item {currentTab === 'send' ? 'active' : ''}"
        on:click={() => handleNavigate('send')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        <span>Send Money</span>
      </button>

      <button
        class="nav-item {currentTab === 'subscriptions' ? 'active' : ''}"
        on:click={() => handleNavigate('subscriptions')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>
        <span>Subscriptions</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <button
        class="nav-item {currentTab === 'settings' ? 'active' : ''}"
        on:click={() => handleNavigate('settings')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span>Settings & Keys</span>
      </button>
    </div>
  </aside>

  <!-- Main Content View Area -->
  <div class="content-area">
    <RateLimitNotice />

    {#if currentTab === 'dashboard'}
      <Dashboard onNavigate={handleNavigate} />
    {:else if currentTab === 'transactions'}
      <Transactions />
    {:else if currentTab === 'send'}
      <SendMoney onNavigate={handleNavigate} />
    {:else if currentTab === 'subscriptions'}
      <Subscriptions />
    {:else if currentTab === 'settings'}
      <Settings onTriggerUpdateModal={handleTriggerModal} />
    {/if}
  </div>

  <!-- Startup Update Modal Prompt -->
  {#if showUpdateModal}
    <UpdateModal
      updateInfo={updateInfo}
      onClose={() => (showUpdateModal = false)}
    />
  {/if}
</main>

<style>
  .app-layout {
    display: flex;
    min-height: 100vh;
    background: var(--bg-primary);
  }

  .sidebar {
    width: 240px;
    background: #090e1a;
    border-right: 1px solid #1e293b;
    display: flex;
    flex-direction: column;
    padding: 1.5rem 1rem;
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 0.5rem 1.5rem;
    border-bottom: 1px solid #1e293b;
    margin-bottom: 1.5rem;
  }

  .brand-logo {
    width: 38px;
    height: 38px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-title {
    font-size: 1rem;
    font-weight: 700;
    color: #f8fafc;
    line-height: 1.2;
  }

  .brand-badge {
    font-size: 0.7rem;
    color: #64748b;
    font-family: var(--font-mono);
  }

  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    flex: 1;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.7rem 0.9rem;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    width: 100%;
  }

  .nav-item:hover {
    background: #1e293b;
    color: #f8fafc;
  }

  .nav-item.active {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    font-weight: 600;
  }

  .sidebar-footer {
    border-top: 1px solid #1e293b;
    padding-top: 1rem;
  }

  .content-area {
    flex: 1;
    padding: 2.2rem 2.5rem;
    overflow-y: auto;
    max-height: 100vh;
  }

  @media (max-width: 800px) {
    .app-layout {
      flex-direction: column;
    }
    .sidebar {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid #1e293b;
      padding: 1rem;
    }
    .nav-links {
      flex-direction: row;
      overflow-x: auto;
    }
    .content-area {
      padding: 1.25rem;
    }
  }
</style>
