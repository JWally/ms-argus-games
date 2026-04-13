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
  const { state, result, error, reveal, scanAgain } = useScan();
  const dots = useLoadingDots();

  const signals = useMemo(
    () => (result ? classifyScan(result.integrity as IntegrityLike) : []),
    [result]
  );

  const scannedAt = result
    ? new Date(result.scannedAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
    : '';

  // PLAY button: enabled as soon as profile is captured OR if we're
  // still profiling (in which case reveal() will await). Disabled only
  // while reveal is already in flight or the result is on screen.
  const playDisabled = state === 'revealing' || state === 'revealed';

  // Human-readable state line.
  let statusLabel: string;
  let statusColor: string;
  switch (state) {
    case 'profiling':
      statusLabel = `PROFILING${dots}`;
      statusColor = '#4ade80';
      break;
    case 'profiled':
      statusLabel = 'READY TO REVEAL';
      statusColor = '#4ade80';
      break;
    case 'revealing':
      statusLabel = `ANALYZING${dots}`;
      statusColor = '#4ade80';
      break;
    case 'revealed':
      statusLabel = 'COMPLETE';
      statusColor = '#4ade80';
      break;
    case 'error':
      statusLabel = 'DIAGNOSTIC OFFLINE';
      statusColor = '#f87171';
      break;
  }

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
            / BOT-BUSTER
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
            &gt; BOT-BUSTER / DIAGNOSTIC
          </h1>

          <div className="mt-5 space-y-1 font-mono text-xs tracking-widest">
            <div>
              <span style={{ color: '#1a6632' }}>STATUS:&nbsp;&nbsp;</span>
              <span style={{ color: statusColor }}>{statusLabel}</span>
            </div>
            {state === 'revealed' && (
              <div>
                <span style={{ color: '#1a6632' }}>SCANNED: </span>
                <span>{scannedAt}</span>
              </div>
            )}
            {state === 'error' && error && <div style={{ color: '#f87171' }}>ERROR: {error}</div>}
          </div>

          {/* PLAY button — pre-reveal. Big, centered, impossible to miss. */}
          {(state === 'profiling' || state === 'profiled' || state === 'revealing') && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={() => reveal()}
                disabled={playDisabled}
                className="font-display tracking-[0.3em] disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  color: '#030c06',
                  background: '#4ade80',
                  border: '2px solid #22c55e',
                  padding: '1.25rem 3.5rem',
                  fontSize: '2rem',
                  borderRadius: '3px',
                  boxShadow: '0 0 18px #22c55e88, 0 0 40px #22c55e44, inset 0 0 12px #00000022',
                  cursor: playDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                &gt; PLAY
              </button>
            </div>
          )}

          {state === 'revealed' && result && (
            <>
              <div className="mt-6 font-mono text-xs tracking-widest" style={{ color: '#1a6632' }}>
                DETECTED:
              </div>
              <SignalList signals={signals} />
              <RawScanPanel signals={signals} sessionId={result.sessionId} />
            </>
          )}

          {/* Actions — shown after reveal or on error */}
          {(state === 'revealed' || state === 'error') && (
            <div className="mt-7 flex flex-wrap gap-2">
              <button
                onClick={() => scanAgain()}
                className="font-mono text-xs tracking-widest"
                style={{
                  color: '#4ade80',
                  border: '1px solid #1a6632',
                  background: 'transparent',
                  padding: '0.55rem 1rem',
                  borderRadius: '2px',
                }}
              >
                [ RUN AGAIN ]
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
          )}
        </div>
      </main>
    </div>
  );
}
