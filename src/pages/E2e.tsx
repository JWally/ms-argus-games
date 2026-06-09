import { useEffect, useState } from 'react';

/**
 * /e2e — hidden, minimal end-to-end harness (NOT a game, not on the Hub).
 *
 * Differs from /bot-buster only in WHERE the SDK comes from: it loads the
 * isolated e2e build from static-integrity-e2e.argus.pw (which serves
 * loader/iframe/worker same-origin and submits to the dev-jw API), runs a
 * scan, waits ~1s, fetches the stored merchant projection back via
 * /api/integrity/check, and dumps the raw JSON. No styling, no gating.
 *
 * Use it to eyeball that the e2e SDK runs the real Worker path end-to-end.
 */
const E2E_LOADER_URL =
  'https://static-integrity-e2e.argus.pw/argus-loader.iife.js';
const CPI = import.meta.env.VITE_MERCHANT_CPI as string | undefined;

interface E2eArgus {
  run(opts?: {
    cpi?: string;
    timeoutMs?: number;
  }): Promise<{ argusSessionId: string }>;
}

export default function E2e() {
  const [status, setStatus] = useState('init');
  const [out, setOut] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setStatus('loading-sdk');
        await new Promise<void>((resolve, reject) => {
          if ((window as unknown as { argus?: unknown }).argus) return resolve();
          const s = document.createElement('script');
          s.src = E2E_LOADER_URL;
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`failed to load ${E2E_LOADER_URL}`));
          document.head.appendChild(s);
        });

        const argus = (window as unknown as { argus?: E2eArgus }).argus;
        if (!argus || typeof argus.run !== 'function') {
          throw new Error('argus loader unavailable');
        }

        setStatus('scanning');
        const { argusSessionId } = await argus.run({ cpi: CPI, timeoutMs: 20_000 });
        if (!argusSessionId) throw new Error('loader returned empty session id');

        // Let the server-side projection settle before reading it back.
        setStatus('waiting 1 second');
        await new Promise((r) => setTimeout(r, 1000));

        setStatus('fetching');
        const res = await fetch('/api/integrity/check', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: argusSessionId }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setOut({ sessionId: argusSessionId, httpStatus: res.status, data });
        setStatus('done');
      } catch (e) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <pre
      data-e2e-status={status}
      style={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        padding: 16,
        margin: 0,
        fontFamily: 'monospace',
        fontSize: 12,
        background: '#000',
        color: '#0f0',
        minHeight: '100vh',
      }}
    >
      {status === 'error'
        ? `ERROR: ${err}`
        : out
          ? JSON.stringify(out, null, 2)
          : `[${status}…]`}
    </pre>
  );
}
