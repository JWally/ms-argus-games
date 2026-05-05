import { useEffect, useRef } from 'react';
import {
  MERCHANT_CPI,
  RUN_TIMEOUT_MS,
  getArgusLoader,
  loadArgusLoader,
} from '../utils/argusLoader';

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
 * Loads argus-loader after the page is idle and runs collection inside
 * its srcdoc iframe. Observe-only — the verdict is not fetched back here.
 * The /bot-buster page has its own scanner that surfaces the verdict for
 * display.
 */
export function useIntegrityGuard({ enabled = true }: { enabled?: boolean } = {}) {
  const ran = useRef(false);

  useEffect(() => {
    if (!enabled || ran.current) return;
    ran.current = true;

    (async () => {
      try {
        await whenIdle();
        await loadArgusLoader();
        const argus = getArgusLoader();
        if (!argus || typeof argus.run !== 'function') return;
        await argus.run({ cpi: MERCHANT_CPI, timeoutMs: RUN_TIMEOUT_MS });
      } catch (err) {
        console.warn('[integrity-guard]', err);
      }
    })();
  }, [enabled]);
}
