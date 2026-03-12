import { useState, useCallback } from 'react';
import { createTicketSession, signoutSession } from '../api';
import type { SessionResponse } from '../types';

interface TicketSessionState {
  session: SessionResponse | null;
  loading: boolean;
  error: string | null;
}

export function useTicketSession() {
  const [state, setState] = useState<TicketSessionState>({
    session: null,
    loading: false,
    error: null,
  });

  const startSession = useCallback(async () => {
    setState({ session: null, loading: true, error: null });
    try {
      const session = await createTicketSession();
      setState({ session, loading: false, error: null });
      return session;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start session';
      setState({ session: null, loading: false, error: msg });
      return null;
    }
  }, []);

  const endSession = useCallback(async () => {
    if (state.session?.token) {
      await signoutSession(state.session.token);
    }
    setState({ session: null, loading: false, error: null });
  }, [state.session]);

  return { ...state, startSession, endSession };
}
