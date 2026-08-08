// Loader URL — injects the integrity bundle into a srcdoc iframe and
// returns only the opaque session id via postMessage. The full
// fingerprint never touches this page's JS context. API endpoints are
// baked into the inner bundle at build time based on its stage.
export const FULL_LOADER_SCRIPT_URL =
  'https://static-integrity-dev-jw.argus.pw/argus-loader.iife.js';
export const PROXY_LOADER_SCRIPT_URL =
  'https://static-integrity-dev-jw.argus.pw/argus-proxy-loader.iife.js';

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

let activeLoaderUrl: string | null = null;
let loadQueue: Promise<void> = Promise.resolve();

/**
 * Load one Argus product at a time. Both browser builds intentionally expose
 * the same window.argus API, so SPA navigation must swap the script rather
 * than letting the normal and proxy-only loaders race to own the global.
 */
export function loadArgusLoader(loaderUrl = FULL_LOADER_SCRIPT_URL): Promise<void> {
  const task = loadQueue.then(async () => {
    const current = getArgusLoader();
    if (activeLoaderUrl === loaderUrl && current) return;

    current?.destroy();
    for (const script of document.querySelectorAll<HTMLScriptElement>(
      'script[data-argus-loader]'
    )) {
      script.remove();
    }
    delete (window as unknown as { argus?: ArgusLoader }).argus;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = loaderUrl;
      script.async = true;
      script.dataset.argusLoader = loaderUrl;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${loaderUrl}`));
      document.head.appendChild(script);
    });

    if (!getArgusLoader()) throw new Error(`Argus loader did not initialize: ${loaderUrl}`);
    activeLoaderUrl = loaderUrl;
  });

  // Keep the queue usable after a network failure while returning the actual
  // rejection to this caller.
  loadQueue = task.catch(() => {});
  return task;
}

export function getArgusLoader(): ArgusLoader | undefined {
  return (window as unknown as { argus?: ArgusLoader }).argus;
}
