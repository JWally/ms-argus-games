export interface SessionRecord {
  sessionId: string;
  nonce: string;
  createdAt: number;
  ip: string;
  used: boolean;
  ttl: number;
}

export interface PurchaseRecord {
  email: string;
  count: number;
  lastPurchase: number;
  displayName: string;
}

export interface RateLimitRecord {
  ip: string;
  window: string;
  attempts: number;
  ttl: number;
}

export interface PurchaseRequest {
  nonce: string;
  captchaToken: string;
  fields: Record<string, string | boolean>;
}
