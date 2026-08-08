import { useCallback, useState } from 'react';
import { type ProxyProjection, isProxyProjection } from '../games/proxy-or-not/engine';
import {
  MERCHANT_CPI,
  PROXY_LOADER_SCRIPT_URL,
  RUN_TIMEOUT_MS,
  getArgusLoader,
  loadArgusLoader,
} from '../utils/argusLoader';

const RESULT_URL = '/api/integrity/check';

export type ProxyGamePhase = 'ready' | 'scanning' | 'revealed' | 'error';

async function fetchProjection(sessionId: string): Promise<ProxyProjection> {
  const response = await fetch(RESULT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Merchant API returned ${response.status}`);
  if (!isProxyProjection(body))
    throw new Error('Merchant API did not return a proxy_v1 projection');
  return body;
}

export function useProxyOrNot() {
  const [phase, setPhase] = useState<ProxyGamePhase>('ready');
  const [result, setResult] = useState<ProxyProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  const test = useCallback(async () => {
    setPhase('scanning');
    setResult(null);
    setError(null);
    try {
      if (!MERCHANT_CPI) throw new Error('Arcade merchant CPI is not configured');
      await loadArgusLoader(PROXY_LOADER_SCRIPT_URL);
      const argus = getArgusLoader();
      if (!argus) throw new Error('Proxy detector did not initialize');
      const scan = await argus.run({ cpi: MERCHANT_CPI, timeoutMs: RUN_TIMEOUT_MS });
      if (!scan.argusSessionId) throw new Error('Proxy detector returned no session');
      const projection = await fetchProjection(scan.argusSessionId);
      setResult(projection);
      setPhase('revealed');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setPhase('error');
    }
  }, []);

  return { phase, result, error, test };
}
