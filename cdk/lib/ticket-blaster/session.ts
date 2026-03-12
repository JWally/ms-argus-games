import { randomBytes } from 'crypto';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { createJwt } from './jwt';
import { FIELD_SCHEMA } from './fields';

const ddb = new DynamoDBClient({});
const TABLE = process.env.TB_SESSIONS_TABLE!;
const SESSION_TTL = 1800; // 30 minutes

export async function createSession(ip: string): Promise<{ statusCode: number; body: string }> {
  const sessionId = randomBytes(16).toString('hex');
  const nonce = randomBytes(12).toString('hex');
  const now = Date.now();
  const ttl = Math.floor(now / 1000) + SESSION_TTL;

  await ddb.send(
    new PutItemCommand({
      TableName: TABLE,
      Item: marshall(
        { sessionId, nonce, createdAt: now, ip, used: false, ttl },
        { removeUndefinedValues: true }
      ),
    })
  );

  const jwtTtl = 1800; // 30 min JWT
  const token = createJwt(sessionId, jwtTtl);

  // Return static field schema (same every time, no honeypot flag)
  const fields = FIELD_SCHEMA.map((f) => {
    const out: Record<string, unknown> = {
      name: f.name,
      label: f.label,
      type: f.type,
      section: f.section,
      required: f.required,
    };
    if (f.placeholder) out.placeholder = f.placeholder;
    if (f.options) out.options = f.options;
    if (f.validation) out.validation = f.validation;
    if (f.conditional) out.conditional = f.conditional;
    return out;
  });

  return {
    statusCode: 200,
    body: JSON.stringify({ token, nonce, fields, expiresAt: now + jwtTtl * 1000 }),
  };
}
