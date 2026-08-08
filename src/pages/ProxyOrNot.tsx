import { GameCabinet } from '../components/GameCabinet';
import {
  connectionLabel,
  guessIsCorrect,
  isProxyConnection,
  type ProxyGuess,
} from '../games/proxy-or-not/engine';
import { useProxyOrNot } from '../hooks/useProxyOrNot';

const GREEN = '#4ade80';
const RED = '#f87171';
const MUTED = '#3f9e68';
const BORDER = '1px solid #1a6632';

function GuessButton({ guess, onChoose }: { guess: ProxyGuess; onChoose: () => void }) {
  const label = guess === 'proxy' ? 'PROXY' : 'NOT PROXY';
  return (
    <button
      type="button"
      onClick={onChoose}
      className="min-h-24 flex-1 font-display text-lg tracking-[0.16em] transition-all hover:[box-shadow:0_0_18px_#22c55e66] sm:text-xl"
      style={{ color: GREEN, border: BORDER, background: '#06150a' }}
    >
      {label}
    </button>
  );
}

export default function ProxyOrNot() {
  const { phase, result, error, choose, reset } = useProxyOrNot();
  const actualProxy = result ? isProxyConnection(result.projection) : false;
  const correct = result ? guessIsCorrect(result.guess, result.projection) : false;

  const status = (
    <div className="font-mono text-xs tracking-widest" style={{ color: MUTED }}>
      {phase === 'guessing' && 'ROUND READY · MAKE YOUR CALL'}
      {phase === 'scanning' && 'READING NETWORK PATH…'}
      {phase === 'revealed' && (correct ? 'CORRECT CALL' : 'MISSED IT')}
      {phase === 'error' && 'SCAN INTERRUPTED'}
    </div>
  );

  return (
    <GameCabinet
      title="PROXY OR NOT"
      subtitle="CALL THE CONNECTION BEFORE ARGUS DOES"
      tag="Diagnostic"
      status={status}
      onRestart={phase === 'revealed' || phase === 'error' ? reset : undefined}
      rules={
        <p className="font-mono text-xs leading-relaxed" style={{ color: MUTED }}>
          Guess whether your current connection is passing through a proxy, VPN, privacy relay,
          hosting proxy, or corporate shield. Argus checks the network-only product, then reveals
          the merchant verdict.
        </p>
      }
    >
      <div className="flex min-h-[340px] w-full max-w-[560px] flex-col items-center justify-center py-5">
        {phase === 'guessing' && (
          <>
            <div
              className="mb-8 text-center font-display text-2xl tracking-[0.18em] sm:text-3xl"
              style={{ color: GREEN, textShadow: '0 0 14px #22c55e66' }}
            >
              WHAT&apos;S YOUR CALL?
            </div>
            <div className="flex w-full flex-col gap-4 sm:flex-row">
              <GuessButton guess="proxy" onChoose={() => void choose('proxy')} />
              <GuessButton guess="not_proxy" onChoose={() => void choose('not_proxy')} />
            </div>
          </>
        )}

        {phase === 'scanning' && (
          <div className="text-center">
            <div
              className="mb-5 animate-pulse font-display text-3xl tracking-[0.2em]"
              style={{ color: GREEN, textShadow: '0 0 18px #22c55e88' }}
            >
              SCANNING
            </div>
            <p className="font-mono text-xs tracking-widest" style={{ color: MUTED }}>
              TLS · TCP · HTTP/2 · WEBRTC · IP/ASN
            </p>
          </div>
        )}

        {phase === 'revealed' && result && (
          <div className="w-full text-center">
            <div
              className="font-display text-lg tracking-[0.2em]"
              style={{ color: correct ? GREEN : RED }}
            >
              {correct ? '✓ YOU CALLED IT' : '✕ ARGUS GOT YOU'}
            </div>
            <div
              className="my-7 font-display text-4xl tracking-[0.16em] sm:text-5xl"
              style={{
                color: actualProxy ? RED : GREEN,
                textShadow: `0 0 22px ${actualProxy ? '#ef444488' : '#22c55e88'}`,
              }}
            >
              {actualProxy ? 'PROXY' : 'NOT PROXY'}
            </div>
            <div
              className="mx-auto grid max-w-md grid-cols-1 gap-px text-left font-mono text-xs sm:grid-cols-2"
              style={{ border: '1px solid #0f2a18', background: '#0f2a18' }}
            >
              <div className="p-3" style={{ background: '#030c06', color: MUTED }}>
                NETWORK CLASS
                <div className="mt-1 text-sm" style={{ color: GREEN }}>
                  {connectionLabel(result.projection)}
                </div>
              </div>
              <div className="p-3" style={{ background: '#030c06', color: MUTED }}>
                NETWORK RISK
                <div className="mt-1 text-sm" style={{ color: GREEN }}>
                  {result.projection.network_tampering}% · {result.projection.verdict.toUpperCase()}
                </div>
              </div>
              <div className="p-3 sm:col-span-2" style={{ background: '#030c06', color: MUTED }}>
                MERCHANT SIGNALS
                <div className="mt-1 text-sm" style={{ color: GREEN }}>
                  {result.projection.tags.length > 0
                    ? result.projection.tags
                        .map((tag) => tag.replace(/_/g, ' '))
                        .join(' · ')
                        .toUpperCase()
                    : 'NONE'}
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="max-w-md text-center">
            <div className="mb-4 font-display text-2xl tracking-[0.16em]" style={{ color: RED }}>
              NO SIGNAL
            </div>
            <p className="font-mono text-xs leading-relaxed" style={{ color: MUTED }}>
              {error ?? 'The proxy scan could not be completed.'}
            </p>
          </div>
        )}
      </div>
    </GameCabinet>
  );
}
