import type { SessionResponse, PurchaseResponse } from './types';

export async function createTicketSession(): Promise<SessionResponse> {
  const res = await fetch('/api/ticket-blaster/session', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to create session');
  return res.json();
}

export async function submitPurchase(
  token: string,
  nonce: string,
  captchaToken: string,
  fields: Record<string, string | boolean>
): Promise<PurchaseResponse> {
  const res = await fetch('/api/ticket-blaster/purchase', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nonce, captchaToken, fields }),
  });
  return res.json();
}

export async function signoutSession(token: string): Promise<void> {
  await fetch('/api/ticket-blaster/signout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}
