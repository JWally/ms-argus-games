import { useEffect, useState } from 'react';

const QUOTES = [
  'Roses are red, violets are blue, your VPN is leaking, and we can see you.',
  "You thought you were invisible. That's adorable.",
  "We see you. We've always seen you.",
  'Your proxy called. It wants its dignity back.',
  'Tunneling through a VPN like nobody would notice? Bold.',
  "Nice disguise. We weren't fooled for a second.",
];

/**
 * Full-screen blocker when VPN/proxy detected.
 * Animated "YOU GOT POPPED" with a random snarky quote.
 */
export function NedryModal({ reason }: { reason?: string }) {
  const [visible, setVisible] = useState(false);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center overflow-hidden bg-black">
      {/* Animated scan lines */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
        }}
      />

      {/* Pulsing red rings */}
      <div
        className="absolute h-[600px] w-[600px] rounded-full border-2 border-red-500/20"
        style={{
          animation: 'popRing 2s ease-out infinite',
        }}
      />
      <div
        className="absolute h-[400px] w-[400px] rounded-full border-2 border-red-500/30"
        style={{
          animation: 'popRing 2s ease-out 0.5s infinite',
        }}
      />

      {/* Main content */}
      <div
        className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.8)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Crosshair icon */}
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/10"
          style={{ animation: 'popSpin 4s linear infinite' }}
        >
          <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="12" cy="12" r="8" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </div>

        {/* Title */}
        <div>
          <h1
            className="text-5xl font-black tracking-tight text-red-500 sm:text-6xl"
            style={{ animation: 'popGlow 1.5s ease-in-out infinite alternate' }}
          >
            POPPED
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.4em] text-red-400/60">
            {reason === 'vpn' ? 'VPN Detected' : reason === 'proxy' ? 'Proxy Detected' : 'Busted'}
          </p>
        </div>

        {/* Quote */}
        <p className="max-w-sm text-sm leading-relaxed text-gray-400 italic">
          &ldquo;{quote}&rdquo;
        </p>

        {/* Instruction */}
        <div className="mt-2 rounded-lg border border-white/5 bg-white/5 px-5 py-3">
          <p className="text-xs text-gray-500">
            Disconnect your {reason === 'vpn' ? 'VPN' : 'proxy'} and refresh to continue.
          </p>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes popRing {
          0% { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes popSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes popGlow {
          0% { text-shadow: 0 0 20px rgba(239,68,68,0.3); }
          100% { text-shadow: 0 0 40px rgba(239,68,68,0.6), 0 0 80px rgba(239,68,68,0.2); }
        }
      `}</style>
    </div>
  );
}
