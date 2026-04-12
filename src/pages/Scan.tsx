import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useScan } from '../hooks/useScan';
import { classifyScan, type IntegrityLike } from '../utils/classifyScan';
import { SignalList } from './scan/SignalList';
import { RawScanPanel } from './scan/RawScanPanel';

const BORDER = '1px solid #0f2a18';

function useLoadingDots() {
  const [dots, setDots] = useState('.');
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return dots;
}

export default function Scan(): ReactElement {
  const { state, result, error, scan } = useScan();
  const dots = useLoadingDots();

  // Auto-scan on mount
  useEffect(() => {
    scan();
  }, [scan]);

  const signals = useMemo(
    () => (result ? classifyScan(result.integrity as IntegrityLike) : []),
    [result]
  );

  const scannedAt = result
    ? new Date(result.scannedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : '';

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      {/* CRT scanlines overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-50"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,10,0,0.18) 3px, rgba(0,10,0,0.18) 4px)',
          opacity: 0.55,
        }}
      />

      {/* Nav */}
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
              color: '#4ade80',
              textShadow: '0 0 8px #22c55e, 0 0 20px #22c55e44',
            }}
          >
            ARCADES.CLICK
          </Link>
          <span className="ml-auto font-mono text-xs tracking-widest" style={{ color: '#94a3b8' }}>
            / SCAN
          </span>
        </div>
      </nav>

      {/* Main */}
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
            style={{
              color: '#4ade80',
              textShadow: '0 0 8px #22c55e44',
            }}
          >
            &gt; SCAN / DIAGNOSTIC
          </h1>

          <div className="mt-5 space-y-1 font-mono text-xs tracking-widest">
            <div>
              <span style={{ color: '#1a6632' }}>STATUS:&nbsp;&nbsp;</span>
              <span style={{ color: state === 'error' ? '#f87171' : '#4ade80' }}>
                {state === 'loading' && `SCANNING${dots}`}
                {state === 'scanned' && 'COMPLETE'}
                {state === 'error' && 'DIAGNOSTIC OFFLINE'}
                {state === 'idle' && 'READY'}
              </span>
            </div>
            {state === 'scanned' && (
              <div>
                <span style={{ color: '#1a6632' }}>SCANNED: </span>
                <span>{scannedAt}</span>
              </div>
            )}
            {state === 'error' && error && <div style={{ color: '#f87171' }}>ERROR: {error}</div>}
          </div>

          {state === 'scanned' && result && (
            <>
              <div className="mt-6 font-mono text-xs tracking-widest" style={{ color: '#1a6632' }}>
                DETECTED:
              </div>
              <SignalList signals={signals} />
              <RawScanPanel signals={signals} sessionId={result.sessionId} />
            </>
          )}

          {/* Actions */}
          <div className="mt-7 flex flex-wrap gap-2">
            <button
              onClick={() => scan()}
              disabled={state === 'loading'}
              className="font-mono text-xs tracking-widest disabled:opacity-40"
              style={{
                color: '#4ade80',
                border: '1px solid #1a6632',
                background: 'transparent',
                padding: '0.55rem 1rem',
                borderRadius: '2px',
              }}
            >
              [ SCAN AGAIN ]
            </button>
            <Link
              to="/"
              className="font-mono text-xs tracking-widest"
              style={{
                color: '#4ade80',
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
