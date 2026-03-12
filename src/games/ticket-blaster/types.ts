export interface SessionResponse {
  token: string;
  nonce: string;
  expiresAt: number;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  count: number;
}

export interface PurchaseResponse {
  success: boolean;
  message?: string;
  error?: string;
  leaderboard?: LeaderboardEntry[];
}
