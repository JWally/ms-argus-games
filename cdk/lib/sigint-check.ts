import { createDecipheriv } from 'crypto';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

const SIGINT_AES_KEY = process.env.SIGINT_AES_KEY || '';
const KEY_BYTES = SIGINT_AES_KEY ? globalThis.Buffer.from(SIGINT_AES_KEY, 'hex') : null;

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
  'content-type': 'application/json',
};

// Thresholds
const MSS_VPN_THRESHOLD = 1400;
const RATIO_PROXY_THRESHOLD = 5;

interface TcpProbeData {
  tcp_info?: { snd_mss?: number };
  rtt_fingerprint?: {
    tls_to_tcp_ratio?: number;
    proxy_score?: number;
    vpn_score?: number;
  };
}

function decrypt(encryptedB64: string): string {
  if (!KEY_BYTES) throw new Error('No AES key configured');

  const buf = globalThis.Buffer.from(encryptedB64, 'base64');
  // Format: nonce (12 bytes) || ciphertext || GCM tag (16 bytes)
  const nonce = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ciphertext = buf.subarray(12, buf.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', KEY_BYTES, nonce);
  decipher.setAuthTag(tag);
  const decrypted = globalThis.Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // Warmer ping
  if (!(event as unknown as Record<string, unknown>).requestContext) {
    return { statusCode: 200, body: 'warm' };
  }

  if (event.requestContext.http.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const tcpBlob = body.tcp; // { v: 1, data: "base64..." }

    if (!tcpBlob?.data) {
      return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ allowed: true }) };
    }

    // Decrypt the tcp-probe response
    const tcpJson = decrypt(tcpBlob.data);
    const tcp: TcpProbeData = JSON.parse(tcpJson);

    const sndMss = tcp.tcp_info?.snd_mss ?? 1460;
    const ratio = tcp.rtt_fingerprint?.tls_to_tcp_ratio ?? 1;

    const vpnDetected = sndMss < MSS_VPN_THRESHOLD;
    const proxyDetected = ratio > RATIO_PROXY_THRESHOLD;

    if (vpnDetected || proxyDetected) {
      const reason = vpnDetected ? 'vpn' : 'proxy';
      // eslint-disable-next-line no-console
      console.log(
        `Blocked: ${reason} | mss=${sndMss} ratio=${ratio.toFixed(2)} ip=${event.requestContext.http.sourceIp}`
      );
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ allowed: false, reason }),
      };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ allowed: true }) };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Sigint check error:', err);
    // Fail open — don't block users if decryption fails
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ allowed: true }) };
  }
}
