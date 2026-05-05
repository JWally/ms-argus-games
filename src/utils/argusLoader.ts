// Loader URL — injects the integrity bundle into a srcdoc iframe and
// returns only the opaque session id via postMessage. The full
// fingerprint never touches this page's JS context. API endpoints are
// baked into the inner bundle at build time based on its stage.
const LOADER_SCRIPT_URL = 'https://static-integrity-dev-jw.argus.pw/argus-loader.iife.js';

// Public client id (cpi) baked at build time. Forwarded to argus.run() so
// the iframe attaches `x-argus-cpi` to its integrity-collect POST. The
// resulting record lands in the (cpi, session_id) partition the merchant
// API reads back on /api/integrity/check. Public-safe.
export const MERCHANT_CPI = import.meta.env.VITE_MERCHANT_CPI as string | undefined;

export const RUN_TIMEOUT_MS = 20_000;

export interface ArgusLoader {
  run(opts?: { sessionId?: string; cpi?: string; timeoutMs?: number }): Promise<{
    sessionId: string | null;
    argusSessionId: string;
    durationMs: number;
  }>;
  destroy(): void;
}

let scriptPromise: Promise<void> | null = null;

export function loadArgusLoader(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  if (typeof window !== 'undefined' && (window as unknown as { argus?: unknown }).argus) {
    scriptPromise = Promise.resolve();
    return scriptPromise;
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LOADER_SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${LOADER_SCRIPT_URL}`));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function getArgusLoader(): ArgusLoader | undefined {
  return (window as unknown as { argus?: ArgusLoader }).argus;
}
