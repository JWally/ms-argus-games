import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import { verifyJwt } from './jwt';

const ddb = new DynamoDBClient({});
const TABLE = process.env.TB_SESSIONS_TABLE!;

export async function handleSignout(
  authHeader: string | undefined
): Promise<{ statusCode: number; body: string }> {
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  const jwt = verifyJwt(authHeader.slice(7));
  if (!jwt) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid or expired token' }) };
  }

  try {
    await ddb.send(
      new UpdateItemCommand({
        TableName: TABLE,
        Key: marshall({ sessionId: jwt.sessionId }),
        UpdateExpression: 'SET used = :true',
        ExpressionAttributeValues: marshall({ ':true': true }),
      })
    );
  } catch {
    // Non-critical — session may already be burned or expired
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };
}
