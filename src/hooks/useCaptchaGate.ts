import { useState, useCallback } from 'react';

// Proxy through our own backend (holds the merchant secret server-side)

interface CaptchaState {
  verified: boolean;
  loading: boolean;
  error: string | null;
  token: string | null;
}

export function useCaptchaGate() {
  const [state, setState] = useState<CaptchaState>(() => ({
    verified: !!sessionStorage.getItem('argus_arcade_token'),
    loading: false,
    error: null,
    token: sessionStorage.getItem('argus_arcade_token'),
  }));

  const requestAccess = useCallback((): Promise<boolean> => {
    setState((s) => ({ ...s, loading: true, error: null }));

    return new Promise((resolve) => {
      fetch('/api/session', { method: 'POST' })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to create session');
          return res.json();
        })
        .then((data) => {
          ArgusBio.open({
            sessionId: data.sessionId,
            onVerified: (token: string) => {
              sessionStorage.setItem('argus_arcade_token', token);
              setState({ verified: true, loading: false, error: null, token });
              resolve(true);
            },
            onError: (err: string) => {
              setState((s) => ({ ...s, loading: false, error: err }));
              resolve(false);
            },
            onClose: () => {
              setState((s) => ({ ...s, loading: false }));
              resolve(false);
            },
          });
        })
        .catch((err) => {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          }));
          resolve(false);
        });
    });
  }, []);

  return { ...state, requestAccess };
}
