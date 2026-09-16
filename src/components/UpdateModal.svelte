<script>
  import { isTauri } from '../lib/api.js';

  export let updateInfo = null;
  export let onClose = () => {};

  function openGitHub() {
    if (updateInfo?.html_url) {
      window.open(updateInfo.html_url, '_blank');
    }
  }

  function dismissOnce() {
    onClose();
  }

  function acknowledgeAndDismiss() {
    if (updateInfo?.full_commit_sha) {
      localStorage.setItem('dc_last_seen_commit', updateInfo.full_commit_sha);
    }
    onClose();
  }

  function getPlatform() {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent || '';
    if (ua.includes('Mac') || ua.includes('Darwin')) return 'macos';
    if (ua.includes('Win')) return 'windows';
    if (ua.includes('Linux') || ua.includes('X11')) return 'linux';
    return 'unknown';
  }

  const platform = getPlatform();
  const runningTauri = isTauri();

  $: bestAsset = (() => {
    const assets = updateInfo?.assets || [];
    if (!assets.length) return null;

    if (runningTauri) {
      if (platform === 'macos') return assets.find(a => a.name.endsWith('.dmg')) || assets[0];
      if (platform === 'windows') return assets.find(a => a.name.endsWith('.msi') || a.name.endsWith('.exe')) || assets[0];
      if (platform === 'linux') return assets.find(a => a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) || assets[0];
    } else {
      // Portable client
      if (platform === 'macos') return assets.find(a => a.name.includes('portable-macos')) || assets[0];
      if (platform === 'windows') return assets.find(a => a.name.includes('portable-windows')) || assets[0];
      if (platform === 'linux') return assets.find(a => a.name.includes('portable-linux')) || assets[0];
    }
    return assets[0];
  })();

  function formatBytes(bytes) {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `(${mb.toFixed(1)} MB)`;
  }

  const formattedDate = updateInfo?.commit_date
    ? new Date(updateInfo.commit_date).toLocaleString()
    : 'Recently';
</script>

<div class="modal-backdrop">
  <div class="modal-card">
    <div class="modal-header">
      <div class="icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </div>
      <div>
        <h3 class="modal-title">New Update Available!</h3>
        <p class="modal-subtitle">DemocracyCraft Finance Client on <code>main</code> branch</p>
      </div>
    </div>

    <div class="modal-body">
      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Latest Commit:</span>
          <span class="meta-val font-mono">{updateInfo?.latest_commit_sha || 'Latest'}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Committed At:</span>
          <span class="meta-val">{formattedDate}</span>
        </div>
      </div>

      <div class="notes-box">
        <div class="notes-label">Patch Notes / Commit Message:</div>
        <pre class="notes-content">{updateInfo?.latest_commit_message || 'No commit notes provided.'}</pre>
      </div>

      <!-- One-Click Download Box -->
      <div class="download-card">
        {#if bestAsset}
          <a
            href={bestAsset.download_url}
            target="_blank"
            rel="noreferrer"
            class="btn btn-primary direct-download-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download {runningTauri ? 'Desktop Installer' : 'Portable Bundle'} {formatBytes(bestAsset.size)}
          </a>
          <div class="download-instruction">
            {#if runningTauri}
              Matches your OS: <code>{bestAsset.name}</code>. Run installer to upgrade your app.
            {:else}
              Matches your OS: <code>{bestAsset.name}</code>. Unzip and run <code>start.sh</code> / <code>start.bat</code>.
            {/if}
          </div>
        {:else}
          <a
            href={updateInfo?.html_url || 'https://github.com/JFT10/DCFinanceClient/releases'}
            target="_blank"
            rel="noreferrer"
            class="btn btn-primary direct-download-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Download from GitHub Releases
          </a>
        {/if}
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={dismissOnce}>
        Remind Me Later
      </button>
      <button class="btn btn-outline" on:click={acknowledgeAndDismiss}>
        Don't Show for this Commit
      </button>
      <button class="btn btn-ghost" on:click={openGitHub}>
        View on GitHub
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
    max-width: 600px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes popIn {
    0% {
      opacity: 0;
      transform: scale(0.96) translateY(8px);
    }
    100% {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border-bottom: 1px solid #334155;
    background: rgba(16, 185, 129, 0.05);
  }

  .icon-wrap {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .modal-title {
    font-size: 1.2rem;
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

  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1.2rem;
  }

  .meta-item {
    background: #0f172a;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid #334155;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .meta-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    color: #64748b;
    font-weight: 600;
  }

  .meta-val {
    font-size: 0.9rem;
    color: #cbd5e1;
    font-weight: 500;
  }

  .font-mono {
    font-family: var(--font-mono);
    color: #34d399;
  }

  .notes-box {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.25rem;
  }

  .notes-label {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: 600;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
  }

  .notes-content {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow-y: auto;
    line-height: 1.4;
  }

  .download-card {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 10px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .direct-download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 700;
    padding: 0.8rem 1.2rem;
  }

  .download-instruction {
    font-size: 0.78rem;
    color: #94a3b8;
    text-align: center;
    line-height: 1.4;
  }

  .download-instruction code {
    color: #34d399;
    font-family: var(--font-mono);
  }

  .btn-ghost {
    background: transparent;
    color: #94a3b8;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0.5rem 0.8rem;
    border-radius: 6px;
    transition: color 0.2s;
  }

  .btn-ghost:hover {
    color: #f8fafc;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1.25rem 1.5rem;
    background: #0f172a;
    border-top: 1px solid #334155;
    flex-wrap: wrap;
  }
</style>
