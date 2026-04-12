import { useCallback, useRef, useState } from 'react';

const INTEGRITY_CHECK_URL = '/api/integrity/check';
const INTEGRITY_SCRIPT_URL = 'https://static-integrity-dev-jw.argus.pw/argus-integrity.iife.js';
const INTEGRITY_API_BASE = 'https://api-dev-jw.argus.pw';
const SIGINT_CONFIG = {
  baseDomain: 'argus.pw',
  stagePrefix: 'dev-jw-',
};

type ScanState = 'idle' | 'loading' | 'scanned' | 'error';

export interface ScanResult {
  sessionId: string;
  scannedAt: string;
  integrity: unknown; // full server response — consumers pull fields they need
}

let scriptPromise: Promise<void> | null = null;

function loadScriptOnce(src: string): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (typeof window !== 'undefined' && (window as { ArgusIntegrity?: unknown }).ArgusIntegrity) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Runs one integrity scan on demand. No CAPTCHA interaction, no caching.
 * Each call to `scan()` triggers a fresh collection + server analysis.
 *
 * Separate from `useIntegrityGuard` (which auto-runs once on app mount and
 * is used for tampering-gated features) because the /scan page needs
 * user-triggered repeats and exposes the full result to the component.
 */
export function useScan() {
  const [state, setState] = useState<ScanState>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(false);

  const scan = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setState('loading');
    setError(null);

    try {
      await loadScriptOnce(INTEGRITY_SCRIPT_URL);

      const argus = (
        window as unknown as {
          ArgusIntegrity?: {
            collectIntegrity: () => Promise<unknown>;
            runArgusVm: (
              fp: unknown,
              base: string,
              cfg: unknown
            ) => Promise<{ sessionId?: string }>;
            prefetchArgusVm: (cfg: unknown) => void;
          };
        }
      ).ArgusIntegrity;

      if (!argus?.collectIntegrity || !argus?.runArgusVm || !argus?.prefetchArgusVm) {
        throw new Error('ArgusIntegrity API unavailable');
      }

      argus.prefetchArgusVm(SIGINT_CONFIG);
      const fingerprint = await argus.collectIntegrity();
      const vmResult = await argus.runArgusVm(fingerprint, INTEGRITY_API_BASE, SIGINT_CONFIG);

      const sessionId = vmResult?.sessionId;
      if (!sessionId) throw new Error('No session id returned');

      const res = await fetch(INTEGRITY_CHECK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) throw new Error(`Check endpoint returned ${res.status}`);

      const data = await res.json();
      const integrity = data.integrity ?? data;

      setResult({
        sessionId,
        scannedAt: new Date().toISOString(),
        integrity,
      });
      setState('scanned');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setState('error');
    } finally {
      inflight.current = false;
    }
  }, []);

  return { state, result, error, scan };
}
