import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CrtOverlay } from './GameShell';

const LOADER_URL = 'https://static-captcha-dev-jw.argus.pw/captcha.js';
const EMBED_ORIGIN = 'https://qr.arcades.click';

interface CaptchaResult {
  token: string | null;
}

interface CaptchaHandle {
  destroy: () => void;
}

interface CaptchaApi {
  startMobileSso: (options: { cpi: string; challengeId: string; returnUrl: string }) => void;
  render: (
    element: Element,
    options: {
      cpi: string;
      challengeId: string;
      embedOrigin: string;
      onResult: (result: CaptchaResult) => void;
      onEvent: (event: Record<string, unknown>) => void;
    }
  ) => CaptchaHandle | null;
}

declare global {
  interface Window {
    argusCaptcha?: CaptchaApi;
  }
}

interface Challenge {
  challengeId: string;
  cpi: string;
  ssoReturnUrl: string;
}

type Bootstrap = { passed: true } | { passed: false; challenge: Challenge };
type Phase = 'checking' | 'ready' | 'verifying' | 'error';

let bootstrapPromise: Promise<Bootstrap> | null = null;

async function requestChallenge(): Promise<Challenge> {
  const response = await fetch('/api/captcha/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ returnPath: window.location.pathname + window.location.search }),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<Challenge>;
  if (!response.ok || !body.challengeId || !body.cpi || !body.ssoReturnUrl) {
    throw new Error('challenge_unavailable');
  }
  return {
    challengeId: body.challengeId,
    cpi: body.cpi,
    ssoReturnUrl: body.ssoReturnUrl,
  };
}

async function bootstrapGate(): Promise<Bootstrap> {
  const status = await fetch('/api/captcha/status', { cache: 'no-store' });
  if (status.ok) return { passed: true };
  return { passed: false, challenge: await requestChallenge() };
}

function sharedBootstrap(): Promise<Bootstrap> {
  bootstrapPromise ??= bootstrapGate().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });
  return bootstrapPromise;
}

async function loadCaptcha(): Promise<CaptchaApi> {
  if (window.argusCaptcha) return window.argusCaptcha;
  const existing = document.querySelector<HTMLScriptElement>('script[data-argus-loader]');
  const script = existing ?? document.createElement('script');
  if (!existing) {
    script.src = LOADER_URL;
    script.async = true;
    script.dataset.argusLoader = 'true';
    document.head.appendChild(script);
  }
  await new Promise<void>((resolve, reject) => {
    if (window.argusCaptcha) return resolve();
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('loader_unavailable')), {
      once: true,
    });
  });
  if (!window.argusCaptcha) throw new Error('loader_unavailable');
  return window.argusCaptcha;
}

export function CaptchaGate({ children }: { children: ReactNode }) {
  const [granted, setGranted] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [phase, setPhase] = useState<Phase>('checking');
  const slotRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    void sharedBootstrap()
      .then((result) => {
        if (!active) return;
        if (result.passed) {
          setGranted(true);
          return;
        }
        setChallenge(result.challenge);
        setPhase('ready');
      })
      .catch(() => {
        if (active) setPhase('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || !challenge) return;
    let active = true;
    let handle: CaptchaHandle | null = null;

    void loadCaptcha()
      .then((captcha) => {
        if (!active) return;
        handle = captcha.render(slot, {
          cpi: challenge.cpi,
          challengeId: challenge.challengeId,
          embedOrigin: EMBED_ORIGIN,
          onEvent: (event) => {
            if (event.event === 'error' && active) setPhase('error');
          },
          onResult: (result) => {
            if (!active || !result.token) {
              if (active) setPhase('error');
              return;
            }
            setPhase('verifying');
            void fetch('/api/captcha/verify', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                token: result.token,
                challengeId: challenge.challengeId,
              }),
            })
              .then(async (response) => {
                const body = (await response.json().catch(() => ({}))) as {
                  passed?: boolean;
                };
                if (!active) return;
                if (!response.ok || body.passed !== true) throw new Error('captcha_failed');
                bootstrapPromise = null;
                setGranted(true);
              })
              .catch(() => {
                if (active) setPhase('error');
              });
          },
        });
        if (!handle) setPhase('error');
      })
      .catch(() => {
        if (active) setPhase('error');
      });

    return () => {
      active = false;
      handle?.destroy();
      slot.replaceChildren();
    };
  }, [challenge]);

  const retry = () => {
    setPhase('checking');
    setChallenge(null);
    bootstrapPromise = null;
    void requestChallenge()
      .then((next) => {
        bootstrapPromise = Promise.resolve({ passed: false, challenge: next });
        setChallenge(next);
        setPhase('ready');
      })
      .catch(() => setPhase('error'));
  };

  const launchMobileSso = () => {
    if (!challenge) return;
    void loadCaptcha()
      .then((captcha) =>
        captcha.startMobileSso({
          cpi: challenge.cpi,
          challengeId: challenge.challengeId,
          returnUrl: challenge.ssoReturnUrl,
        })
      )
      .catch(() => setPhase('error'));
  };

  if (granted) return children;

  return (
    <main
      className="flex min-h-screen flex-col px-4 py-10 sm:py-16"
      style={{ background: '#030c06', color: '#4ade80' }}
    >
      <CrtOverlay />
      <section className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center">
        <div className="mb-8 text-center">
          <p
            className="font-display text-[10px] tracking-[0.2em]"
            style={{ color: '#4ade80', textShadow: '0 0 8px #22c55e, 0 0 20px #22c55e44' }}
          >
            ARCADES.CLICK
          </p>
          <h1
            className="mt-5 font-display text-lg leading-relaxed sm:text-xl"
            style={{ color: '#86efac', textShadow: '0 0 8px #22c55e44' }}
          >
            HUMAN CHECK
          </h1>
          <p className="mt-3 font-mono text-sm leading-relaxed" style={{ color: '#3f9e68' }}>
            One quick check unlocks every game.
            <br />
            No account, nothing to install.
          </p>
        </div>

        <div className="w-full p-5" style={{ border: '1px solid #0f2a18', background: '#040e07' }}>
          {phase === 'checking' && (
            <div className="flex h-80 items-center justify-center" role="status">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#0f2a18] border-t-[#22c55e]" />
              <span className="sr-only">Loading check</span>
            </div>
          )}
          {/* QR widget — desktop only; phones use the button below instead */}
          <div
            ref={slotRef}
            className={
              phase === 'checking' || phase === 'error'
                ? 'hidden'
                : 'hidden w-full justify-center sm:flex'
            }
          />
          {phase === 'ready' && challenge && (
            <button
              type="button"
              onClick={launchMobileSso}
              className="flex min-h-11 w-full items-center justify-center font-display text-[10px] tracking-widest transition-all duration-150 hover:[box-shadow:0_0_18px_#22c55e88] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22c55e] sm:hidden"
              style={{
                color: '#0a1f0a',
                background: '#22c55e',
                border: '1px solid #4ade80',
                padding: '12px 18px',
              }}
            >
              ▶ CHECK WITH YOUR PHONE
            </button>
          )}
          {phase === 'verifying' && (
            <p
              className="mt-4 text-center font-mono text-xs tracking-widest"
              style={{ color: '#4ade80' }}
            >
              CHECKING…
            </p>
          )}
          {phase === 'error' && (
            <div className="flex h-80 flex-col items-center justify-center text-center">
              <p className="font-mono text-sm" style={{ color: '#86efac' }}>
                The check didn&apos;t load.
              </p>
              <button
                type="button"
                onClick={retry}
                className="mt-6 font-display text-[10px] tracking-widest transition-all duration-150 hover:[box-shadow:0_0_12px_#22c55e66]"
                style={{
                  color: '#4ade80',
                  background: 'transparent',
                  border: '1px solid #1a6632',
                  padding: '12px 18px',
                }}
              >
                ▶ TRY AGAIN
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 font-mono text-[10px] tracking-widest" style={{ color: '#26714a' }}>
          ▮ TAKES SECONDS · BEATS ROBOTS
        </p>
      </section>
    </main>
  );
}
