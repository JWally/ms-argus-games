import { useEffect, useRef } from 'react';
import {
  MERCHANT_CPI,
  RUN_TIMEOUT_MS,
  getArgusLoader,
  loadArgusLoader,
} from '../utils/argusLoader';

const VERDICT_URL = '/api/integrity/check';

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 5000 });
    } else {
      setTimeout(resolve, 2000);
    }
  });
}

/**
 * Loads argus-loader after the page is idle, runs collection inside its
 * srcdoc iframe, and fires the merchant verdict-fetch so each pageview
 * burns one credit (the integrity-collect POST itself is free; the
 * GET /v1/session/{cpi}/{sessionId} round-trip is what the api charges
 * for). Observe-only — the verdict response is discarded.
 *
 * Pass `trigger` (e.g. the current pathname) to make SPA navigation
 * fire a fresh scan. Same trigger across renders is a no-op. If
 * `trigger` is omitted the hook only scans once per mount.
 *
 * Everything is async, idle-deferred, and fire-and-forget. Errors are
 * swallowed; if the user bails mid-flight the browser cancels the
 * outstanding fetch on its own.
 */
export function useIntegrityGuard({
  enabled = true,
  trigger,
}: { enabled?: boolean; trigger?: string } = {}) {
  const lastTrigger = useRef<string | undefined>(undefined);
  const everRan = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    // When `trigger` is supplied, scan whenever it changes. When it's
    // omitted, fall back to scan-once-per-mount.
    if (trigger === undefined) {
      if (everRan.current) return;
    } else if (lastTrigger.current === trigger) {
      return;
    }
    everRan.current = true;
    lastTrigger.current = trigger;

    (async () => {
      try {
        await whenIdle();
        await loadArgusLoader();
        const argus = getArgusLoader();
        if (!argus || typeof argus.run !== 'function') return;
        const result = await argus.run({ cpi: MERCHANT_CPI, timeoutMs: RUN_TIMEOUT_MS });
        const sessionId = result.argusSessionId;
        if (!sessionId) return;

        // Fire-and-forget — no await, no caller waits on the round-trip.
        // The credit burn happens on the server when the proxy forwards
        // to /v1/session/{cpi}/{sessionId}.
        fetch(VERDICT_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch((err) => console.warn('[integrity-guard] verdict fetch', err));
      } catch (err) {
        console.warn('[integrity-guard]', err);
      }
    })();
  }, [enabled, trigger]);
}
