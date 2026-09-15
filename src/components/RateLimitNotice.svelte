<script>
  import { onMount, onDestroy } from 'svelte';
  import { subscribeRateLimit } from '../lib/cache.js';

  let isLimited = false;
  let remainingSeconds = 0;
  let unsubscribe = null;
  let intervalTimer = null;

  onMount(() => {
    // Subscribe to rate-limit events
    unsubscribe = subscribeRateLimit((state) => {
      isLimited = state.isRateLimited;
      remainingSeconds = state.remainingSeconds;

      // Manage local 1-second tick timer
      if (isLimited && !intervalTimer) {
        intervalTimer = setInterval(() => {
          if (remainingSeconds > 0) {
            remainingSeconds -= 1;
          } else {
            isLimited = false;
            if (intervalTimer) {
              clearInterval(intervalTimer);
              intervalTimer = null;
            }
          }
        }, 1000);
      }
    });
  });

  onDestroy(() => {
    // Clean up timer and listener to prevent memory leaks
    if (intervalTimer) {
      clearInterval(intervalTimer);
      intervalTimer = null;
    }
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
  });
</script>

{#if isLimited && remainingSeconds > 0}
  <div class="rate-limit-banner">
    <div class="banner-content">
      <div class="banner-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="banner-text">
        <strong>Rate Limit Active (DemocracyCraft Treasury)</strong>
        <span>Showing cached values. Live requests resume in <strong>{remainingSeconds}s</strong>.</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .rate-limit-banner {
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.4);
    color: #fbbf24;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    margin-bottom: 1.5rem;
    animation: fadeIn 0.2s ease;
  }

  .banner-content {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .banner-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .banner-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    line-height: 1.3;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
