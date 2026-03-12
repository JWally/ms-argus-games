import {
  DynamoDBClient,
  GetItemCommand,
  UpdateItemCommand,
  ScanCommand,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { verifyJwt } from './jwt';
import { checkRateLimit, incrementRateLimit } from './rate-limit';
import { validatePurchaseFields } from './validate';
import type { SessionRecord, PurchaseRequest } from './types';

const ddb = new DynamoDBClient({});
const SESSIONS_TABLE = process.env.TB_SESSIONS_TABLE!;
const PURCHASES_TABLE = process.env.TB_PURCHASES_TABLE!;
const BIO_API_URL = process.env.BIO_API_URL!;
const BIO_API_SECRET = process.env.BIO_API_SECRET!;

type Result = { statusCode: number; body: string };

function fail(statusCode: number, error: string): Result {
  return { statusCode, body: JSON.stringify({ error }) };
}

async function failWithRateLimit(ip: string, statusCode: number, error: string): Promise<Result> {
  await incrementRateLimit(ip);
  return fail(statusCode, error);
}

async function verifyCaptcha(token: string): Promise<boolean> {
  const res = await fetch(`${BIO_API_URL}/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: BIO_API_SECRET, response: token }),
  });
  const data = (await res.json()) as { success?: boolean };
  return !!data.success;
}

async function recordPurchase(request: PurchaseRequest, sessionId: string): Promise<Result> {
  // Burn session atomically
  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: SESSIONS_TABLE,
        Key: marshall({ sessionId }),
        UpdateExpression: 'SET used = :true',
        ConditionExpression: 'used = :false',
        ExpressionAttributeValues: marshall({ ':true': true, ':false': false }),
      })
    );
  } catch {
    return fail(400, 'Session already used');
  }

  const email = String(request.fields.email || '')
    .toLowerCase()
    .trim();
  const displayName = String(request.fields.displayName || '').trim() || 'Anonymous';

  if (!email) return fail(400, 'Email is required');

  await ddb.send(
    new UpdateItemCommand({
      TableName: PURCHASES_TABLE,
      Key: marshall({ email }),
      UpdateExpression: 'ADD #count :one SET lastPurchase = :now, displayName = :name',
      ExpressionAttributeNames: { '#count': 'count' },
      ExpressionAttributeValues: marshall({ ':one': 1, ':now': Date.now(), ':name': displayName }),
    })
  );

  // Fetch top 5 for leaderboard
  const scan = await ddb.send(
    new ScanCommand({
      TableName: PURCHASES_TABLE,
      ProjectionExpression: 'displayName, #count',
      ExpressionAttributeNames: { '#count': 'count' },
    })
  );
  const players = (scan.Items || [])
    .map(
      (item: Record<string, AttributeValue>) =>
        unmarshall(item) as { displayName: string; count: number }
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((p, i) => ({ rank: i + 1, name: p.displayName, count: p.count }));

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, message: 'Ticket purchased!', leaderboard: players }),
  };
}

export async function handlePurchase(
  authHeader: string | undefined,
  body: string | undefined,
  ip: string
): Promise<Result> {
  if (!authHeader?.startsWith('Bearer ')) {
    return failWithRateLimit(ip, 401, 'Authentication required');
  }
  const jwt = verifyJwt(authHeader.slice(7));
  if (!jwt) return failWithRateLimit(ip, 401, 'Invalid or expired token');

  let request: PurchaseRequest;
  try {
    request = JSON.parse(body || '{}');
  } catch {
    return failWithRateLimit(ip, 400, 'Invalid request body');
  }

  // Session exists
  const sessionResult = await ddb.send(
    new GetItemCommand({ TableName: SESSIONS_TABLE, Key: marshall({ sessionId: jwt.sessionId }) })
  );
  if (!sessionResult.Item) return failWithRateLimit(ip, 400, 'Invalid session');

  const session = unmarshall(sessionResult.Item) as SessionRecord;

  if (session.used) return failWithRateLimit(ip, 400, 'Session already used');
  if (request.nonce !== session.nonce) return failWithRateLimit(ip, 400, 'Invalid nonce');
  if (!(await checkRateLimit(ip))) return fail(429, 'Too many attempts. Try again later.');

  const validation = validatePurchaseFields(request, session);
  if (!validation.valid) return failWithRateLimit(ip, 400, validation.error!);

  if (!request.captchaToken) return failWithRateLimit(ip, 400, 'CAPTCHA verification required');

  try {
    if (!(await verifyCaptcha(request.captchaToken))) {
      return failWithRateLimit(ip, 400, 'CAPTCHA verification failed');
    }
  } catch {
    return fail(502, 'CAPTCHA service unavailable');
  }

  return recordPurchase(request, jwt.sessionId);
}
