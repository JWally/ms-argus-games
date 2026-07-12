import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';

const FPJS_URL = 'https://fpjscdn.net/v4/xszasGYxaOq23ttuMOC0';
const SERVER_EVENT_URL = '/api/fpjs/event';

const BORDER = '1px solid #0f2a18';
const GREEN = '#4ade80';
const RED = '#f87171';
const MUTED = '#1a6632';
const LABEL = '#94a3b8';

type FpAgent = {
  get: (opts?: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

type FpModule = {
  load?: (opts: { apiKey: string }) => Promise<FpAgent>;
  start?: () => Promise<FpAgent>;
};

type ScanState = 'loading' | 'scanning' | 'done' | 'error';

async function startAgent(mod: FpModule): Promise<FpAgent> {
  if (typeof mod.start === 'function') return mod.start();
  if (typeof mod.load === 'function') {
    return mod.load({ apiKey: '' });
  }
  throw new Error('FingerprintJS module has neither start() nor load()');
}

export default function Fpjs(): ReactElement {
  const [state, setState] = useState<ScanState>('loading');
  const [clientResult, setClientResult] = useState<Record<string, unknown> | null>(null);
  const [serverResult, setServerResult] = useState<Record<string, unknown> | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clientMs, setClientMs] = useState<number | null>(null);
  const [serverMs, setServerMs] = useState<number | null>(null);
  const agentRef = useRef<FpAgent | null>(null);

  const runScan = useCallback(async (agent: FpAgent) => {
    setState('scanning');
    setError(null);
    setServerError(null);
    setServerResult(null);
    const t0 = performance.now();
    let clientR: Record<string, unknown> | null = null;
    try {
      clientR = await agent.get({ extendedResult: true });
      setClientResult(clientR);
      setClientMs(Math.round(performance.now() - t0));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
      return;
    }

    setState('done');

    // v4 SDK returns `event_id` (snake_case); v3 returned `requestId`.
    const eventId =
      typeof clientR.event_id === 'string'
        ? clientR.event_id
        : typeof clientR.requestId === 'string'
          ? clientR.requestId
          : null;
    if (!eventId) {
      setServerError('no event_id / requestId on client result');
      return;
    }

    const ts = performance.now();
    try {
      const res = await fetch(SERVER_EVENT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      setServerMs(Math.round(performance.now() - ts));
      if (!res.ok) {
        setServerError(`${res.status}: ${JSON.stringify(data)}`);
      } else {
        setServerResult(data);
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = (await import(/* @vite-ignore */ FPJS_URL)) as FpModule;
        if (cancelled) return;
        const agent = await startAgent(mod);
        if (cancelled) return;
        agentRef.current = agent;
        await runScan(agent);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runScan]);

  const rescan = () => {
    if (agentRef.current) void runScan(agentRef.current);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col" style={{ background: '#030c06', color: GREEN }}>
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.18) 3px, rgba(0,10,0,0.18) 4px)',
          opacity: 0.55,
        }}
      />

      <nav
        className="sticky top-0 z-40"
        style={{
          background: '#030c06f0',
          borderBottom: BORDER,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 16px #000c',
        }}
      >
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4 sm:px-6">
          <Link
            to="/"
            className="font-display text-base tracking-[0.2em] sm:text-lg"
            style={{
              color: GREEN,
              textShadow: '0 0 8px #22c55e, 0 0 20px #22c55e44',
            }}
          >
            ARCADES.CLICK
          </Link>
          <span className="ml-auto font-mono text-xs tracking-widest" style={{ color: LABEL }}>
            / FPJS
          </span>
        </div>
      </nav>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div
          className="rounded-[3px] p-5 sm:p-7"
          style={{
            border: BORDER,
            background: '#040e07',
            boxShadow: 'inset 0 0 20px #00000040',
          }}
        >
          <h1
            className="font-display text-lg tracking-[0.25em] sm:text-xl"
            style={{ color: GREEN, textShadow: '0 0 8px #22c55e44' }}
          >
            &gt; FINGERPRINTJS / V4
          </h1>

          <div className="mt-2 text-[0.7rem]" style={{ color: MUTED, lineHeight: 1.5 }}>
            vendor: fpjscdn.net · extendedResult: true · server-side Smart Signals via
            /api/fpjs/event
          </div>

          <div className="mt-5 space-y-1 font-mono text-xs tracking-widest">
            <StatusRow state={state} clientMs={clientMs} />
            {error && (
              <div style={{ color: RED }}>
                <span style={{ color: LABEL }}>ERROR:&nbsp;&nbsp;</span>
                {error}
              </div>
            )}
          </div>

          {state === 'done' && clientResult && (
            <Section
              title="CLIENT `fp.get()` RESULT"
              subtitle="visible in browser with public key"
              data={clientResult}
            />
          )}

          {state === 'done' && (
            <Section
              title="SERVER API `/events/{requestId}` RESULT"
              subtitle={
                serverMs !== null
                  ? `fetched via /api/fpjs/event in ${serverMs} ms`
                  : 'fetched via /api/fpjs/event (server-side, secret key)'
              }
              data={serverResult}
              error={serverError}
              pending={clientResult !== null && serverResult === null && serverError === null}
            />
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={rescan}
              disabled={state === 'loading' || state === 'scanning'}
              className="font-mono text-xs tracking-widest"
              style={{
                color: GREEN,
                border: '1px solid #1a6632',
                background: 'transparent',
                padding: '0.55rem 1rem',
                borderRadius: '2px',
                cursor: state === 'scanning' ? 'not-allowed' : 'pointer',
                opacity: state === 'loading' || state === 'scanning' ? 0.4 : 1,
              }}
            >
              [ RE-SCAN ]
            </button>
            <Link
              to="/"
              className="font-mono text-xs tracking-widest"
              style={{
                color: GREEN,
                border: '1px solid #1a6632',
                background: 'transparent',
                padding: '0.55rem 1rem',
                borderRadius: '2px',
                textDecoration: 'none',
              }}
            >
              [ BACK ]
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusRow({
  state,
  clientMs,
}: {
  state: ScanState;
  clientMs: number | null;
}): ReactElement {
  let label: string;
  let color: string = GREEN;
  switch (state) {
    case 'loading':
      label = 'LOADING AGENT...';
      break;
    case 'scanning':
      label = 'IDENTIFYING...';
      break;
    case 'done':
      label = clientMs !== null ? `COMPLETE (${clientMs} ms)` : 'COMPLETE';
      break;
    case 'error':
      label = 'FAILED';
      color = RED;
      break;
  }
  return (
    <div>
      <span style={{ color: LABEL }}>STATUS:&nbsp;&nbsp;</span>
      <span style={{ color }}>{label}</span>
    </div>
  );
}

function Section({
  title,
  subtitle,
  data,
  error,
  pending,
}: {
  title: string;
  subtitle?: string;
  data: Record<string, unknown> | null;
  error?: string | null;
  pending?: boolean;
}): ReactElement {
  return (
    <div className="mt-8">
      <div className="font-mono text-xs tracking-widest" style={{ color: LABEL }}>
        {title}
      </div>
      {subtitle && (
        <div className="mt-1 text-[0.65rem]" style={{ color: MUTED, lineHeight: 1.5 }}>
          {subtitle}
        </div>
      )}

      {pending && (
        <div className="mt-3 font-mono text-xs tracking-widest" style={{ color: LABEL }}>
          loading...
        </div>
      )}

      {error && (
        <div className="mt-3 font-mono text-xs tracking-widest" style={{ color: RED }}>
          ERROR: {error}
        </div>
      )}

      {data && (
        <>
          <div className="mt-3 space-y-0.5 font-mono text-xs tracking-widest">
            {flatten(data).map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <span
                  style={{
                    color: MUTED,
                    minWidth: '17rem',
                    display: 'inline-block',
                    wordBreak: 'break-all',
                  }}
                >
                  {key}
                </span>
                <span style={{ color: GREEN, wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>

          <details className="mt-4">
            <summary
              className="font-mono text-xs tracking-widest"
              style={{ color: LABEL, cursor: 'pointer' }}
            >
              [raw json]
            </summary>
            <pre
              className="mt-2 overflow-x-auto font-mono text-[0.7rem]"
              style={{ color: GREEN, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </>
      )}
    </div>
  );
}

const DASH = '—';

function flatten(obj: unknown, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (obj === null || obj === undefined) {
    out.push([prefix || '(root)', DASH]);
    return out;
  }
  if (typeof obj !== 'object') {
    out.push([prefix || '(root)', formatPrimitive(obj)]);
    return out;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      out.push([prefix || '(root)', '[]']);
      return out;
    }
    obj.forEach((v, i) => {
      out.push(...flatten(v, `${prefix}[${i}]`));
    });
    return out;
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) {
    out.push([prefix || '(root)', '{}']);
    return out;
  }
  for (const [k, v] of entries) {
    const nextKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object') {
      out.push(...flatten(v, nextKey));
    } else {
      out.push([nextKey, formatPrimitive(v)]);
    }
  }
  return out;
}

function formatPrimitive(v: unknown): string {
  if (v === null || v === undefined) return DASH;
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v === '' ? DASH : v;
  return String(v);
}
