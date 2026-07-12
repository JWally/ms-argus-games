import { useEffect, useRef, useState, type ReactNode } from 'react';

const LOADER_URL = 'https://static-captcha-dev-jw.argus.pw/captcha.js';
const EMBED_ORIGIN = 'https://qr.arcades.click';

interface CaptchaResult {
  token: string | null;
}

interface CaptchaHandle {
  destroy: () => void;
}

interface CaptchaApi {
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
}

type Bootstrap = { passed: true } | { passed: false; challenge: Challenge };
type Phase = 'checking' | 'ready' | 'verifying' | 'error';

let bootstrapPromise: Promise<Bootstrap> | null = null;

async function requestChallenge(): Promise<Challenge> {
  const response = await fetch('/api/captcha/challenge', { method: 'POST' });
  const body = (await response.json().catch(() => ({}))) as Partial<Challenge>;
  if (!response.ok || !body.challengeId || !body.cpi) {
    throw new Error('challenge_unavailable');
  }
  return { challengeId: body.challengeId, cpi: body.cpi };
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

  if (granted) return children;

  return (
    <main className="min-h-screen bg-arcade-bg px-4 py-10 text-white sm:py-16">
      <section className="mx-auto flex w-full max-w-md flex-col items-center">
        <div className="mb-8 text-center">
          <p className="font-display text-[10px] uppercase text-arcade-accent">Argus Arcade</p>
          <h1 className="mt-4 font-display text-lg leading-relaxed sm:text-xl">Pass to play</h1>
          <p className="mt-3 text-sm text-gray-400">Complete the check to enter the arcade.</p>
        </div>

        <div className="w-full">
          {phase === 'checking' && (
            <div className="flex h-80 items-center justify-center" role="status">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-arcade-border border-t-arcade-accent" />
              <span className="sr-only">Loading check</span>
            </div>
          )}
          <div
            ref={slotRef}
            className={phase === 'checking' || phase === 'error' ? 'hidden' : 'flex justify-center'}
          />
          {phase === 'verifying' && (
            <p className="mt-4 text-center font-display text-[9px] uppercase text-arcade-neon">
              Checking result
            </p>
          )}
          {phase === 'error' && (
            <div className="flex h-80 flex-col items-center justify-center text-center">
              <p className="text-sm text-gray-300">The check could not be completed.</p>
              <button
                type="button"
                onClick={retry}
                className="mt-6 rounded border border-arcade-accent px-5 py-3 font-display text-[9px] uppercase text-arcade-accent transition hover:bg-arcade-accent hover:text-white"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
