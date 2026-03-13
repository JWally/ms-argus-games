import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCaptchaGate } from '../hooks/useCaptchaGate';

export default function CaptchaGate({ children }: { children: ReactNode }) {
  const { verified, loading, error, requestAccess } = useCaptchaGate();

  if (verified) return <>{children}</>;

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center bg-arcade-bg px-4">
      <div className="text-center">
        <h1 className="font-display text-lg text-arcade-accent sm:text-2xl">HOLD UP</h1>
        <p className="mt-3 text-sm text-gray-400">Prove you&apos;re human before you play.</p>

        {error && (
          <p className="mt-3 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-300">{error}</p>
        )}

        <button
          onClick={() => requestAccess()}
          disabled={loading}
          className="mt-5 rounded-xl bg-arcade-accent px-8 py-3 text-sm font-bold text-white transition-all hover:bg-arcade-accent-hover active:scale-95 disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>

        <p className="mt-6">
          <Link to="/" className="text-sm text-arcade-accent/70 hover:text-arcade-accent">
            &larr; Back to Arcade
          </Link>
        </p>
      </div>
    </div>
  );
}
