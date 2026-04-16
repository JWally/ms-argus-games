import { useState, useEffect, useRef, useCallback } from 'react';
import type { MerchantSafeResponse } from '../utils/classifyScan';

const INTEGRITY_CHECK_URL = '/api/integrity/check';
const INTEGRITY_SCRIPT_URL = 'https://static-integrity-dev-jw.argus.pw/argus-integrity.iife.js';
const INTEGRITY_API_BASE = 'https://api-dev-jw.argus.pw';
const SIGINT_CONFIG = {
  baseDomain: 'argus.pw',
  stagePrefix: 'dev-jw-',
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

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
 * Dynamically loads the argus-integrity script after the page is idle,
 * then runs collection and retrieves server-side results via the proxy Lambda.
 *
 * The script is NOT in index.html — loaded here to stay out of Lighthouse's
 * critical path. Must run before argus-bio to avoid lie-detector interference,
 * which is guaranteed because bio is triggered by user interaction (CAPTCHA).
 */
export function useIntegrityGuard({ enabled = true }: { enabled?: boolean } = {}) {
  const [blocked, setBlocked] = useState(false);
  const [signals, setSignals] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string>();
  const [loading, setLoading] = useState(enabled);
  const ran = useRef(false);

  const check = useCallback(async () => {
    if (ran.current) return;
    ran.current = true;

    try {
      // Wait until the browser is idle to avoid impacting LCP/TBT
      await whenIdle();

      // Dynamically load the integrity script
      await loadScript(INTEGRITY_SCRIPT_URL);

      const argus = (window as any).ArgusIntegrity;
      if (!argus?.collectIntegrity || !argus?.runArgusVm || !argus?.prefetchArgusVm) {
        setLoading(false);
        return;
      }

      // Start prefetch (h2 probe + bytecode) immediately
      argus.prefetchArgusVm(SIGINT_CONFIG);

      // Collect fingerprint
      const fingerprint = await argus.collectIntegrity();

      // Run VM — does bot detection, ECDH encrypt, POST to /v1/integrity
      const vmResult = await argus.runArgusVm(fingerprint, INTEGRITY_API_BASE, SIGINT_CONFIG);

      const vmSessionId = vmResult?.sessionId;
      if (!vmSessionId) {
        setLoading(false);
        return;
      }

      setSessionId(vmSessionId);

      // Retrieve server-side results via proxy Lambda
      const res = await fetch(INTEGRITY_CHECK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: vmSessionId }),
      });

      if (!res.ok) {
        setLoading(false);
        return;
      }

      const merchant = (await res.json()) as MerchantSafeResponse;

      // Block on tampering or confirmed bot. Probability >= 50 matches the
      // server's tag threshold for tampering; bot gets a tighter 90 so we
      // don't block on "suspected" ratings alone.
      if (merchant.tampering.probability >= 50 || merchant.bot.probability >= 90) {
        setBlocked(true);
        setSignals(merchant.tags);
      }
    } catch (err) {
      // Fail open — integrity errors shouldn't block users
      console.warn('[integrity-guard]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    check();
  }, [check, enabled]);

  return { blocked, signals, sessionId, loading };
}
