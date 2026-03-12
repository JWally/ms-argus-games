import { DynamoDBClient, UpdateItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';

const ddb = new DynamoDBClient({});
const TABLE = process.env.TB_RATE_LIMITS_TABLE!;
const MAX_FAILED_PER_HOUR = 100;

function currentWindow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}`;
}

export async function checkRateLimit(ip: string): Promise<boolean> {
  const window = currentWindow();
  try {
    const result = await ddb.send(
      new GetItemCommand({
        TableName: TABLE,
        Key: {
          ip: { S: ip },
          window: { S: window },
        },
        ProjectionExpression: 'attempts',
      })
    );
    const attempts = result.Item?.attempts?.N ? parseInt(result.Item.attempts.N, 10) : 0;
    return attempts < MAX_FAILED_PER_HOUR;
  } catch {
    // On error, allow the request (fail open)
    return true;
  }
}

export async function incrementRateLimit(ip: string): Promise<void> {
  const window = currentWindow();
  const ttl = Math.floor(Date.now() / 1000) + 7200; // 2 hours
  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: {
          ip: { S: ip },
          window: { S: window },
        },
        UpdateExpression: 'ADD attempts :one SET #ttl = if_not_exists(#ttl, :ttl)',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':one': { N: '1' },
          ':ttl': { N: String(ttl) },
        },
      })
    );
  } catch {
    // Non-critical
  }
}
