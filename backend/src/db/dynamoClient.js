import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// Lazily-connecting client — safe to import even when STORAGE_MODE=local,
// since it doesn't actually talk to AWS until a command is sent.
const client = new DynamoDBClient({ region: process.env.AWS_REGION });
export const ddb = DynamoDBDocumentClient.from(client);
export const TABLE = process.env.DYNAMODB_TABLE_NAME || "agentic-workflow-table";