import { GameCabinet } from '../components/GameCabinet';
import { connectionLabel, isProxyConnection } from '../games/proxy-or-not/engine';
import { useProxyOrNot } from '../hooks/useProxyOrNot';

const GREEN = '#4ade80';
const RED = '#f87171';
const TEXT = '#86efac';
const MUTED = '#3f9e68';

export default function ProxyOrNot() {
  const { phase, result, error, test } = useProxyOrNot();
  const isScanning = phase === 'scanning';
  const proxy = result ? isProxyConnection(result) : false;

  return (
    <GameCabinet title="PROXY OR NOT" tag="Diagnostic">
      <div className="flex min-h-[390px] w-full max-w-lg flex-col items-center justify-center px-4 py-8 text-center sm:px-8">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: '#092213', border: '1px solid #1a6632', color: GREEN }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor">
            <path d="M12 3 4 6v5c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6z" strokeWidth="1.4" />
            <path d="M8 12h8m-3-3 3 3-3 3" strokeWidth="1.4" />
          </svg>
        </div>

        <h1 className="font-display text-xl tracking-[0.14em] sm:text-2xl" style={{ color: TEXT }}>
          Proxy or Not?
        </h1>
        <p className="mb-7 mt-3 max-w-sm font-mono text-xs leading-6" style={{ color: MUTED }}>
          Test whether this connection looks like a proxy, VPN, relay, or network shield.
        </p>

        <button
          type="button"
          onClick={() => void test()}
          disabled={isScanning}
          className="h-12 min-w-44 rounded-sm px-10 font-display text-sm tracking-[0.22em] transition-all hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
          style={{ background: GREEN, color: '#031006', boxShadow: '0 4px 18px #22c55e22' }}
        >
          TEST
        </button>

        <div className="mt-8 min-h-24 w-full" aria-live="polite">
          {isScanning && (
            <div className="font-mono text-xs tracking-[0.18em]" style={{ color: MUTED }}>
              <span className="animate-pulse">Checking network path…</span>
            </div>
          )}

          {phase === 'revealed' && result && (
            <div>
              <div
                className="font-display text-2xl tracking-[0.12em] sm:text-3xl"
                style={{ color: proxy ? RED : GREEN }}
              >
                {proxy ? 'Proxy' : 'Not Proxy'}
              </div>
              <p className="mt-3 font-mono text-xs leading-5" style={{ color: MUTED }}>
                {connectionLabel(result)} · {result.network_tampering}% network risk
              </p>
              {result.tags.length > 0 && (
                <p className="mt-1 font-mono text-[11px] leading-5" style={{ color: MUTED }}>
                  {result.tags.map((tag) => tag.replace(/_/g, ' ')).join(' · ')}
                </p>
              )}
            </div>
          )}

          {phase === 'error' && (
            <p className="mx-auto max-w-sm font-mono text-xs leading-5" style={{ color: RED }}>
              {error ?? 'The test could not be completed. Please try again.'}
            </p>
          )}
        </div>

        <p className="mt-2 font-mono text-[10px] tracking-wide" style={{ color: '#26714a' }}>
          Network-only scan · no full device fingerprint
        </p>
      </div>
    </GameCabinet>
  );
}
