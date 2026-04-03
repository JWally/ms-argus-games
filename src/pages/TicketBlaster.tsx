import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTicketSession } from '../games/ticket-blaster/hooks/useTicketSession';
import { submitPurchase } from '../games/ticket-blaster/api';
import { getFieldError } from '../games/ticket-blaster/validation';
import { FIELDS, SECTIONS, HONEYPOT_NAMES, type Field } from '../games/ticket-blaster/fields';
import { CountdownTimer } from '../games/ticket-blaster/components/CountdownTimer';
import { CONTEST_END_LABEL } from '../games/ticket-blaster/constants';
import type { LeaderboardEntry } from '../games/ticket-blaster/types';
import { launchConfetti } from '../games/confetti';
import { useSigintGuard } from '../hooks/useSigintGuard';
import { NedryModal } from '../components/NedryModal';

/* ── Helpers ─────────────────────────────────────────────── */

function iframeHeight(type: string): number {
  if (type === 'textarea') return 84;
  if (type === 'checkbox') return 38;
  if (type === 'radio') return 42;
  return 42;
}

function buildSrc(f: Field): string {
  const u = new URLSearchParams();
  u.set('name', f.name);
  u.set('type', f.type);
  if (f.placeholder) u.set('placeholder', f.placeholder);
  if (f.options) u.set('options', f.options.join(','));
  if (f.type === 'checkbox') u.set('label', f.label);
  if (f.validation) u.set('validation', f.validation);
  return `/field-frame.html?${u.toString()}`;
}

function generateOrderNumber(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += chars[(Math.random() * chars.length) | 0];
  return `TB-${id}`;
}

/* ── Purchase limit storage ──────────────────────────────── */

const LS_KEY = 'tb_purchased';
const IDB_NAME = 'tb-config';
const IDB_STORE = 'flags';
const CACHE_NAME = 'tb-assets';
const CACHE_KEY = '/tb-limit';

async function markPurchased(): Promise<void> {
  // localStorage
  try {
    localStorage.setItem(LS_KEY, '1');
  } catch {
    /* noop */
  }

  // IndexedDB
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(true, 'purchased');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* noop */
  }

  // Cache API
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(CACHE_KEY, new Response('1'));
  } catch {
    /* noop */
  }
}

async function checkPurchased(): Promise<boolean> {
  // localStorage
  try {
    if (localStorage.getItem(LS_KEY) === '1') return true;
  } catch {
    /* noop */
  }

  // IndexedDB
  try {
    const found = await new Promise<boolean>((resolve) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(IDB_STORE, 'readonly');
        const get = tx.objectStore(IDB_STORE).get('purchased');
        get.onsuccess = () => resolve(!!get.result);
        get.onerror = () => resolve(false);
      };
      req.onerror = () => resolve(false);
    });
    if (found) return true;
  } catch {
    /* noop */
  }

  // Cache API
  try {
    const cache = await caches.open(CACHE_NAME);
    const resp = await cache.match(CACHE_KEY);
    if (resp) return true;
  } catch {
    /* noop */
  }

  return false;
}

/* ── Fake QR code ────────────────────────────────────────── */

function fakeQrDataUri(seed: string): string {
  const S = 25;
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) & 0xffffffff;
  const rects: string[] = [];
  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
          rects.push(`<rect x="${c0 + c}" y="${r0 + r}" width="1" height="1"/>`);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, S - 7);
  drawFinder(S - 7, 0);
  for (let r = 0; r < S; r++) {
    for (let c = 0; c < S; c++) {
      if ((r < 8 && c < 8) || (r < 8 && c >= S - 8) || (r >= S - 8 && c < 8)) continue;
      h = (h * 1664525 + 1013904223) & 0xffffffff;
      if ((h >>> 16) % 2 === 0) rects.push(`<rect x="${c}" y="${r}" width="1" height="1"/>`);
    }
  }
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">${rects.join('')}</svg>`)}`;
}

/* ── Error Modal ─────────────────────────────────────────── */

function ErrorModal({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-center text-lg font-semibold text-gray-900">Something went wrong</h3>
        <p className="mt-2 text-center text-sm text-gray-500">{message}</p>
        <button
          onClick={onDismiss}
          className="mt-5 w-full rounded-xl bg-gray-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

/* ── Expired Page ────────────────────────────────────────── */

function ExpiredPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#0a0a1a] via-[#1a0533] to-[#0a192f] px-4 text-center">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
        <svg
          className="h-12 w-12 text-indigo-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-white sm:text-3xl">Session Expired</h1>
      <p className="mx-auto mt-3 max-w-xs text-sm text-gray-400">
        For your protection, we ended your session due to inactivity. Please start a new session to
        continue purchasing tickets.
      </p>
      <button
        onClick={() => location.reload()}
        className="mt-8 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30"
      >
        Start Over
      </button>
      <Link to="/" className="mt-4 text-xs text-gray-500 hover:text-gray-300">
        Return to Game Hub
      </Link>
    </div>
  );
}

/* ── Success Page ────────────────────────────────────────── */

function SuccessPage({
  orderNumber,
  leaderboard,
  onBuyAnother,
}: {
  orderNumber: string;
  leaderboard: LeaderboardEntry[];
  onBuyAnother: () => void;
}) {
  const qrSrc = useMemo(() => fakeQrDataUri(orderNumber), [orderNumber]);
  const now = new Date();
  const orderTime = `${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <div className="bg-gradient-to-br from-[#1a0533] via-[#0d1b2a] to-[#0a192f] px-4 pb-16 pt-8 text-center text-white">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30">
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">Order Confirmed!</h1>
        <p className="mt-1 text-sm text-gray-300">Your tickets are on the way</p>
        <p className="mt-2 text-xs text-gray-500">Order {orderNumber}</p>
      </div>
      <div className="mx-auto max-w-md px-4" style={{ marginTop: '-2.5rem' }}>
        <div className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
          <div className="border-b border-dashed border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-500">
                  The Errors Tour
                </p>
                <h2 className="mt-0.5 text-lg font-bold text-gray-900">Taylor Swift</h2>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-[10px] font-semibold text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Confirmed
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400">Date</p>
                <p className="font-medium text-gray-900">{CONTEST_END_LABEL}</p>
              </div>
              <div>
                <p className="text-gray-400">Time</p>
                <p className="font-medium text-gray-900">7:00 PM EST</p>
              </div>
              <div>
                <p className="text-gray-400">Venue</p>
                <p className="font-medium text-gray-900">MetLife Stadium</p>
              </div>
              <div>
                <p className="text-gray-400">Location</p>
                <p className="font-medium text-gray-900">East Rutherford, NJ</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center border-b border-dashed border-gray-200 px-5 py-6">
            <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-black/5">
              <img
                src={qrSrc}
                alt="Ticket QR Code"
                className="h-36 w-36"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <p className="mt-3 font-mono text-xs tracking-wider text-gray-400">{orderNumber}</p>
            <p className="mt-0.5 text-[10px] text-gray-400">Show this at the gate for entry</p>
          </div>
          <div className="space-y-2 px-5 py-4 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">General Admission</span>
              <span className="font-medium text-gray-900">1x $12.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Service Fee</span>
              <span className="font-medium text-gray-900">$0.00</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Facility Charge</span>
              <span className="font-medium text-gray-900">$0.00</span>
            </div>
            <div className="mt-1 border-t border-gray-100 pt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">$12.00</span>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-white p-4 text-xs shadow-sm ring-1 ring-black/5">
          <div className="flex justify-between text-gray-400">
            <span>Ordered</span>
            <span className="text-gray-600">{orderTime}</span>
          </div>
          <div className="mt-1.5 flex justify-between text-gray-400">
            <span>Delivery</span>
            <span className="text-gray-600">Mobile Ticket</span>
          </div>
        </div>
        {leaderboard.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
              Top Buyers
            </h3>
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              {leaderboard.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center justify-between px-4 py-2.5 ${entry.rank === 1 ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : entry.rank % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${entry.rank === 1 ? 'bg-amber-400 text-white' : entry.rank === 2 ? 'bg-gray-300 text-white' : entry.rank === 3 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {entry.rank}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{entry.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {entry.count} ticket{entry.count !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={onBuyAnother}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/30"
        >
          Buy Another Ticket
        </button>
        <Link
          to="/"
          className="mt-3 mb-8 block text-center text-xs text-gray-400 hover:text-gray-600"
        >
          Return to Game Hub
        </Link>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────── */

export default function TicketBlaster() {
  const { blocked, reason } = useSigintGuard();
  const { session, startSession } = useTicketSession();
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [fieldValid, setFieldValid] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<'idle' | 'captcha' | 'submitting' | 'success' | 'expired'>(
    'idle'
  );
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [orderNumber, setOrderNumber] = useState('');
  const [purchaseLimited, setPurchaseLimited] = useState(false);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check purchase limit on mount
  useEffect(() => {
    checkPurchased().then(setPurchaseLimited);
  }, []);

  // Start session on mount
  useEffect(() => {
    startSession();
  }, [startSession]);

  // Session expiry timer
  useEffect(() => {
    if (expiryTimer.current) clearTimeout(expiryTimer.current);
    if (!session?.expiresAt || phase === 'success') return;
    const remaining = Math.max(0, session.expiresAt - Date.now());
    expiryTimer.current = setTimeout(() => setPhase('expired'), remaining);
    return () => {
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [session?.expiresAt, phase]);

  const visibleFields = useMemo(() => FIELDS.filter((f) => !HONEYPOT_NAMES.has(f.name)), []);

  const renderFields = useMemo(() => FIELDS, []);

  // Listen for iframe messages
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (e.origin !== location.origin) return;
      const d = e.data;
      if (!d?.name) return;
      if (d.type === 'tb:change') setValues((prev) => ({ ...prev, [d.name]: d.value }));
      else if (d.type === 'tb:focus') setFocused(d.name);
      else if (d.type === 'tb:blur') setFocused(null);
      else if (d.type === 'tb:valid') setFieldValid((prev) => ({ ...prev, [d.name]: d.value }));
      else if (d.type === 'tb:tab') {
        const fieldNames = visibleFields.map((f) => f.name);
        const idx = fieldNames.indexOf(d.name);
        if (idx === -1) return;
        const nextIdx = d.value === 'forward' ? idx + 1 : idx - 1;
        if (nextIdx >= fieldNames.length) {
          document.getElementById('tb-submit')?.focus();
          return;
        }
        if (nextIdx < 0) return;
        const nextIframe = document.querySelector<HTMLIFrameElement>(
          `iframe[data-field="${fieldNames[nextIdx]}"]`
        );
        nextIframe?.contentWindow?.postMessage({ type: 'tb:focus-input' }, '*');
      }
    }
    addEventListener('message', handler);
    return () => removeEventListener('message', handler);
  }, [visibleFields]);

  const getError = useCallback(
    (f: Field): string | null => {
      if (HONEYPOT_NAMES.has(f.name)) return null;
      const val = values[f.name];
      // Required check — only after submit
      if (showValidation && f.required && (val === undefined || val === '' || val === false))
        return 'Required';
      // Validation check — real-time
      if (typeof val === 'string' && val !== '' && f.validation)
        return getFieldError(val, f.validation);
      return null;
    },
    [values, showValidation]
  );

  const handleSubmit = () => {
    setShowValidation(true);

    for (const f of visibleFields) {
      if (getError(f)) {
        const el = document.querySelector(`[data-field="${f.name}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    if (!session) {
      setErrorModal('Session not ready. Please wait and try again.');
      return;
    }

    setPhase('captcha');
    fetch('/api/session', { method: 'POST' })
      .then((r) => {
        if (!r.ok) throw new Error('Session failed');
        return r.json();
      })
      .then((data) => {
        ArgusBio.open({
          sessionId: data.sessionId,
          onVerified: (token: string) => doPurchase(token),
          onError: () => {
            setPhase('idle');
            setErrorModal('CAPTCHA verification failed. Please try again.');
          },
          onClose: () => setPhase('idle'),
        });
      })
      .catch(() => {
        setPhase('idle');
        setErrorModal('Failed to start CAPTCHA. Please try again.');
      });
  };

  const doPurchase = async (captchaToken: string) => {
    if (!session) return;
    setPhase('submitting');
    try {
      const result = await submitPurchase(session.token, session.nonce, captchaToken, values);
      if (result.success) {
        if (result.leaderboard) setLeaderboard(result.leaderboard);
        setOrderNumber(generateOrderNumber());
        setPhase('success');
        launchConfetti(3000);
        await markPurchased();
        setPurchaseLimited(true);
      } else {
        if (result.error?.toLowerCase().includes('expired')) {
          setPhase('expired');
        } else {
          setErrorModal(result.error || 'Purchase failed. Please try again.');
          setPhase('idle');
        }
      }
    } catch {
      setErrorModal('Network error. Please try again.');
      setPhase('idle');
    }
  };

  const handleReset = () => {
    setValues({});
    setFieldValid({});
    setShowValidation(false);
    setErrorModal(null);
    setPhase('idle');
    setLeaderboard([]);
    setOrderNumber('');
    startSession();
    for (const iframe of document.querySelectorAll<HTMLIFrameElement>('iframe[data-field]')) {
      iframe.contentWindow?.postMessage({ type: 'tb:reset' }, '*');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ── Render ──────────────────────────────────────────── */

  if (blocked) return <NedryModal reason={reason} />;
  if (phase === 'expired') return <ExpiredPage />;
  if (phase === 'success')
    return (
      <SuccessPage orderNumber={orderNumber} leaderboard={leaderboard} onBuyAnother={handleReset} />
    );

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {errorModal && <ErrorModal message={errorModal} onDismiss={() => setErrorModal(null)} />}

      {/* ── Purchase limit banner ─────────────────────── */}
      {purchaseLimited && (
        <div className="sticky top-0 z-40 border-b border-red-200 bg-red-600 px-4 py-2 text-center text-xs font-semibold text-white shadow-sm">
          Limit: 1 purchase per customer
        </div>
      )}

      {/* ── Navbar ─────────────────────────────────────── */}
      <nav
        className={`sticky ${purchaseLimited ? 'top-[33px]' : 'top-0'} z-30 border-b border-white/10 bg-[#0a0a1a]/95 px-4 py-3 backdrop-blur-md`}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-xs text-gray-500 hover:text-white">
              &larr;
            </Link>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 100-4V6z" />
              </svg>
              <span className="text-sm font-bold tracking-wider text-white">TICKETBLASTER</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {session ? (
              <span className="text-green-400">Session active</span>
            ) : (
              <span className="text-yellow-400">Connecting...</span>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-[#1a0533] via-[#0d1b2a] to-[#0a192f] px-4 py-12 text-center text-white sm:py-16">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-indigo-300/80">
          The Errors Tour &mdash; Final Encore
        </p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">Taylor Swift</h1>
        <p className="mt-3 text-sm text-gray-300">
          {CONTEST_END_LABEL} &middot; MetLife Stadium &middot; East Rutherford, NJ
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-1 text-xs font-semibold shadow-lg shadow-indigo-500/20">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            Verified Fan
          </span>
          <span className="rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs font-medium text-gray-300">
            $12.00 / ticket
          </span>
        </div>
        <div className="mx-auto mt-6 max-w-xs">
          <CountdownTimer />
        </div>
      </section>

      {/* ── Form ───────────────────────────────────────── */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <div className={`relative ${purchaseLimited ? 'select-none' : ''}`}>
          {purchaseLimited && (
            <div className="absolute inset-0 z-10 rounded-2xl bg-gray-100/70 backdrop-blur-[1px]" />
          )}
          {SECTIONS.map((sec) => {
            const sectionFields = renderFields.filter((f) => f.section === sec.key);
            if (sectionFields.length === 0) return null;
            return (
              <div key={sec.key} className="mb-8">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50">
                    <svg
                      className="h-4 w-4 text-indigo-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={sec.icon} />
                    </svg>
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900">{sec.title}</h2>
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
                  <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    {sectionFields.map((f) => {
                      const isHoneypot = HONEYPOT_NAMES.has(f.name);
                      const isWide =
                        f.type === 'textarea' || f.type === 'radio' || f.type === 'checkbox';
                      const error = getError(f);
                      const iframeInvalid = f.validation && fieldValid[f.name] === false;

                      if (isHoneypot) {
                        return (
                          <div
                            key={f.name}
                            aria-hidden="true"
                            style={{
                              position: 'absolute',
                              left: '-9999px',
                              top: '-9999px',
                              width: '1px',
                              height: '1px',
                              overflow: 'hidden',
                              opacity: 0,
                            }}
                          >
                            <iframe
                              data-field={f.name}
                              tabIndex={-1}
                              src={buildSrc(f)}
                              title={f.label}
                              height={iframeHeight(f.type)}
                              style={{ width: '100%', border: 0 }}
                            />
                          </div>
                        );
                      }

                      const hasError = !!error || iframeInvalid;

                      return (
                        <div
                          key={f.name}
                          data-field={f.name}
                          className={isWide ? 'sm:col-span-2' : ''}
                        >
                          {f.type !== 'checkbox' && (
                            <div className="mb-1.5">
                              <label className="block text-xs font-medium text-gray-600">
                                {f.label}
                                {f.required && <span className="ml-0.5 text-red-400">*</span>}
                              </label>
                              {f.name === 'email' && (
                                <p className="mt-0.5 text-[10px] text-gray-400">
                                  Used only for leaderboard tracking. We won&apos;t spam you or
                                  share it.
                                </p>
                              )}
                            </div>
                          )}
                          <div
                            className={`overflow-hidden rounded-lg border-[1.5px] transition-all duration-150 ${
                              hasError
                                ? 'border-red-400 bg-red-50/30 ring-[3px] ring-red-400/10'
                                : focused === f.name
                                  ? 'border-indigo-500 ring-[3px] ring-indigo-500/10'
                                  : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <iframe
                              data-field={f.name}
                              src={buildSrc(f)}
                              title={f.label}
                              height={iframeHeight(f.type)}
                              tabIndex={-1}
                              style={{ width: '100%', border: 0, display: 'block' }}
                            />
                          </div>
                          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          <button
            id="tb-submit"
            onClick={handleSubmit}
            disabled={phase !== 'idle' || purchaseLimited}
            className="mt-2 w-full rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 text-base font-semibold text-white shadow-xl shadow-indigo-500/20 transition-all hover:shadow-2xl hover:shadow-indigo-500/30 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {purchaseLimited
              ? 'Purchase Limit Reached'
              : phase === 'captcha'
                ? 'Complete CAPTCHA...'
                : phase === 'submitting'
                  ? 'Processing...'
                  : 'Purchase Ticket \u2014 $12.00'}
          </button>
        </div>

        {/* ── Challenge Info ──────────────────────────── */}
        <div className="mt-12">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
            <h3 className="text-sm font-semibold text-gray-900">Challenge Rules</h3>
            <p className="mt-1 text-xs text-gray-500">
              Build a bot to buy tickets faster than everyone else. Most tickets by {CONTEST_END_LABEL}
              wins.
            </p>
            <ul className="mt-3 space-y-1 text-xs text-gray-500">
              <li className="flex gap-2">
                <span className="text-indigo-400">1.</span> Fill all required fields correctly
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">2.</span> Complete an Argus Bio CAPTCHA per
                purchase
              </li>
              <li className="flex gap-2">
                <span className="text-indigo-400">3.</span> Each session is single-use
              </li>
            </ul>
            <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              Prize: 1x used Chick-fil-A gift card ($12.72) + 1x expired Chili&apos;s gift
              certificate.
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 px-4 py-5 text-center text-[10px] text-gray-400">
        No actual Taylor Swift tickets are involved. Contest ends {CONTEST_END_LABEL}.
      </footer>
    </div>
  );
}
