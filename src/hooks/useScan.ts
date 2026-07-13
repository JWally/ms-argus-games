import { useCallback, useEffect, useRef, useState } from 'react';
import type { MerchantSafeResponse } from '../utils/classifyScan';
import {
  MERCHANT_CPI,
  RUN_TIMEOUT_MS,
  getArgusLoader,
  loadArgusLoader,
} from '../utils/argusLoader';

// Bot-buster submit endpoint. Fetches the merchant projection internally,
// runs duplicate-detection + tampering thresholds, persists the entry,
// returns the verdict in one shot. See cdk/lib/integrity-proxy.ts.
const LEADERBOARD_ENTRY_URL = '/api/leaderboard-entry';

export type BotBusterOutcome = 'SUCCESS' | 'BLOCKED';

export type BotBusterReason =
  | 'TAMPERING_AUTOMATION'
  | 'TAMPERING_DEVICE'
  | 'TAMPERING_NETWORK'
  | 'INCOGNITO'
  | 'DUPLICATE_CRYPTO'
  | 'DUPLICATE_TPC'
  | 'DUPLICATE_UUID'
  | 'DUPLICATE_NETWORK_1H'
  | null;

export interface BotBusterVerdict {
  outcome: BotBusterOutcome;
  reason: BotBusterReason;
  /** session_id of the prior SUCCESS that this submission duplicated. Null
   *  when no duplicate (i.e., outcome=SUCCESS or reason=TAMPERING_*). */
  duplicateOf: string | null;
  /** Epoch ms when the prior duplicate was recorded. Renders as "seen N
   *  ago" in the verdict screen so blocked users know how recent the
   *  collision was. Null when no duplicate. */
  duplicateAt: number | null;
}

/**
 * State machine for the BOT-BUSTER page:
 *   profiling  — loader is running in the background
 *   profiled   — session id captured; waiting on PLAY
 *   revealing  — PLAY clicked; fetching server-side analysis
 *   revealed   — full result rendered
 *   error      — either profiling or revealing failed
 */
export type ScanState = 'profiling' | 'profiled' | 'revealing' | 'revealed' | 'error';

export interface ScanResult {
  /** UUID the integrity VM generated; key into server's integrity-results table */
  sessionId: string;
  scannedAt: string;
  /** The merchant-safe API response — identical to what a paying customer sees. */
  merchant: MerchantSafeResponse;
  /** Bot-buster game verdict computed by the leaderboard-entry endpoint. */
  verdict: BotBusterVerdict;
}

/**
 * Two-phase scanner for the BOT-BUSTER page.
 *
 * Phase 1 (auto, on mount): load the argus loader, run the integrity
 * collection inside its srcdoc iframe, capture the argusSessionId.
 * Nothing is shown to the user — this is the "profile" phase. The
 * fingerprint never leaves the iframe realm.
 *
 * Phase 2 (on `reveal()`): fetch the server-stored analysis via the
 * /api/integrity/check proxy. If phase 1 is still running when reveal
 * is called, phase 2 awaits it. If phase 1 errored, phase 2 retries
 * from scratch.
 *
 * Typical UX: user lands on the page → profile starts silently → when
 * user clicks PLAY, the result is either already waiting (fast path)
 * or reveal waits for the profile to finish (slow path).
 */
export function useScan() {
  const [state, setState] = useState<ScanState>('profiling');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Promise for the in-flight profile so reveal() can await it. Never
  // rejects — captures error into a tagged result for the caller to
  // branch on.
  const profilePromise = useRef<Promise<
    { ok: true; sessionId: string } | { ok: false; error: string }
  > | null>(null);

  const startProfile = useCallback(() => {
    setState('profiling');
    setError(null);
    profilePromise.current = (async () => {
      try {
        await loadArgusLoader();
        const argus = getArgusLoader();
        if (!argus || typeof argus.run !== 'function') {
          throw new Error('argus loader unavailable — did the script load?');
        }
        const runResult = await argus.run({
          cpi: MERCHANT_CPI,
          timeoutMs: RUN_TIMEOUT_MS,
        });
        const sessionId = runResult.argusSessionId;
        if (!sessionId) throw new Error('loader returned empty session id');
        return { ok: true as const, sessionId };
      } catch (err) {
        return {
          ok: false as const,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })();

    profilePromise.current.then((r) => {
      if (r.ok) {
        setState((prev) => (prev === 'profiling' ? 'profiled' : prev));
      } else {
        setError(r.error);
        setState('error');
      }
    });
  }, []);

  // Auto-profile on mount.
  useEffect(() => {
    startProfile();
  }, [startProfile]);

  const reveal = useCallback(
    async (attribution: string = '') => {
      // Already revealed — nothing to do. Re-triggering from the UI
      // would be odd; but harmless.
      if (state === 'revealing' || state === 'revealed') return;

      // If profile errored, restart it before revealing.
      let profile = profilePromise.current;
      if (!profile || state === 'error') {
        startProfile();
        profile = profilePromise.current!;
      }

      setState('revealing');
      setError(null);

      const p = await profile;
      if (!p.ok) {
        setError(p.error);
        setState('error');
        return;
      }

      try {
        const res = await fetch(LEADERBOARD_ENTRY_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId: p.sessionId, attribution }),
        });
        if (!res.ok) throw new Error(`Leaderboard endpoint returned ${res.status}`);

        const body = (await res.json()) as {
          outcome: BotBusterOutcome;
          reason: BotBusterReason;
          duplicate_of: string | null;
          duplicate_at: number | null;
          merchant: MerchantSafeResponse;
        };

        setResult({
          sessionId: p.sessionId,
          scannedAt: new Date().toISOString(),
          merchant: body.merchant,
          verdict: {
            outcome: body.outcome,
            reason: body.reason,
            duplicateOf: body.duplicate_of,
            duplicateAt: body.duplicate_at,
          },
        });
        setState('revealed');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    },
    [state, startProfile]
  );

  /** Restart from scratch — re-profile and re-reveal. */
  const scanAgain = useCallback(() => {
    setResult(null);
    setError(null);
    startProfile();
  }, [startProfile]);

  return { state, result, error, reveal, scanAgain };
}
