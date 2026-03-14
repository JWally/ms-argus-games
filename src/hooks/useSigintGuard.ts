import { useState, useEffect, useRef, useCallback } from 'react';

const TCP_PROBE_URL = 'https://dev-jw-tcp-probe.argus.pw/';
const SIGINT_CHECK_URL = '/api/sigint-check';
const TRIGGER_DELAY_MS = 3000;

interface SigintResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Fires a background sigint check ~3 seconds after mount.
 * Fetches tcp-probe (so the server can measure MSS/RTT),
 * sends the encrypted blob to our Lambda for analysis.
 * Returns { blocked, reason } — if blocked, show Nedry.
 */
export function useSigintGuard() {
  const [blocked, setBlocked] = useState(false);
  const [reason, setReason] = useState<string>();
  const ran = useRef(false);

  const check = useCallback(async () => {
    if (ran.current) return;
    ran.current = true;

    try {
      // Hit tcp-probe — server measures connection, returns encrypted blob
      const tcpRes = await fetch(TCP_PROBE_URL, { credentials: 'omit' });
      if (!tcpRes.ok) return;
      const tcpBlob = await tcpRes.json();

      // Send encrypted blob to our Lambda for decryption + analysis
      const checkRes = await fetch(SIGINT_CHECK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tcp: tcpBlob }),
      });
      if (!checkRes.ok) return;

      const result: SigintResult = await checkRes.json();
      if (!result.allowed) {
        setBlocked(true);
        setReason(result.reason);
      }
    } catch {
      // Fail open — network errors shouldn't block users
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(check, TRIGGER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [check]);

  return { blocked, reason };
}
