import { PutCommand, GetCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "./dynamoClient.js";
import { db as sqliteDb } from "./init.js";

const MODE = process.env.STORAGE_MODE || "local";

// Every function below returns the same shape regardless of backend, so
// route files never need to know or care which one is active.

// ---------- USERS ----------
export async function createUser(user) {
  // user: { id, email, passwordHash, name, createdAt }
  if (MODE === "aws") {
    // Written under two keys: USER#<id> is the canonical record, and
    // EMAIL#<email> is a lookup copy so login can fetch by email in a
    // single GetItem instead of a table scan (no GSI needed).
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: `USER#${user.id}`, SK: "PROFILE", ...user } }));
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: `EMAIL#${user.email}`, SK: "PROFILE", ...user } }));
    return user;
  }
  sqliteDb
    .prepare("INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, user.email, user.passwordHash, user.name, user.createdAt);
  return user;
}

export async function getUserByEmail(email) {
  if (MODE === "aws") {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `EMAIL#${email}`, SK: "PROFILE" } }));
    return res.Item || null;
  }
  const row = sqliteDb.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row) return null;
  return { id: row.id, email: row.email, passwordHash: row.password_hash, name: row.name, createdAt: row.created_at };
}

// ---------- WORKFLOWS ----------
export async function createWorkflow(wf) {
  // wf: { id, userId, name, description, steps, createdAt, updatedAt }
  if (MODE === "aws") {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: { PK: `USER#${wf.userId}`, SK: `WORKFLOW#${wf.id}`, ...wf } }));
    return wf;
  }
  sqliteDb
    .prepare("INSERT INTO workflows (id, user_id, name, description, steps_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(wf.id, wf.userId, wf.name, wf.description, JSON.stringify(wf.steps), wf.createdAt, wf.updatedAt);
  return wf;
}

export async function listWorkflows(userId) {
  if (MODE === "aws") {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":prefix": "WORKFLOW#" },
    }));
    return (res.Items || []).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  return sqliteDb.prepare("SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC").all(userId).map(rowToWorkflow);
}

export async function getWorkflow(userId, id) {
  if (MODE === "aws") {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: `WORKFLOW#${id}` } }));
    return res.Item || null;
  }
  const row = sqliteDb.prepare("SELECT * FROM workflows WHERE id = ? AND user_id = ?").get(id, userId);
  return row ? rowToWorkflow(row) : null;
}

export async function updateWorkflow(userId, id, patch) {
  // patch: { name, description, steps, updatedAt }
  if (MODE === "aws") {
    const existing = await getWorkflow(userId, id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: updated }));
    return updated;
  }
  const existing = sqliteDb.prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) return null;
  sqliteDb
    .prepare("UPDATE workflows SET name = ?, description = ?, steps_json = ?, updated_at = ? WHERE id = ?")
    .run(patch.name, patch.description, JSON.stringify(patch.steps), patch.updatedAt, id);
  return rowToWorkflow(sqliteDb.prepare("SELECT * FROM workflows WHERE id = ?").get(id));
}

export async function deleteWorkflow(userId, id) {
  if (MODE === "aws") {
    const existing = await getWorkflow(userId, id);
    if (!existing) return false;
    await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: `WORKFLOW#${id}` } }));
    return true;
  }
  return sqliteDb.prepare("DELETE FROM workflows WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

function rowToWorkflow(row) {
  return {
    id: row.id, userId: row.user_id, name: row.name, description: row.description,
    steps: JSON.parse(row.steps_json), createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

// ---------- RUNS ----------
export async function createRun(run) {
  // run: { id, workflowId, userId, status, inputText, inputFileName, inputFileUrl, startedAt }
  if (MODE === "aws") {
    const item = { PK: `USER#${run.userId}`, SK: `RUN#${run.id}`, ...run };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return item;
  }
  sqliteDb
    .prepare("INSERT INTO runs (id, workflow_id, user_id, status, input_text, input_file_name, input_file_url, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(run.id, run.workflowId, run.userId, run.status, run.inputText, run.inputFileName, run.inputFileUrl, run.startedAt);
  return run;
}

export async function updateRunResult(userId, id, patch) {
  // patch: { status, stepsResult, error, finishedAt }
  if (MODE === "aws") {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: `RUN#${id}` } }));
    if (!res.Item) return null;
    const updated = { ...res.Item, ...patch };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: updated }));
    return updated;
  }
  sqliteDb
    .prepare("UPDATE runs SET status = ?, steps_result_json = ?, error = ?, finished_at = ? WHERE id = ?")
    .run(patch.status, JSON.stringify(patch.stepsResult), patch.error || null, patch.finishedAt, id);
  return getRun(userId, id);
}

export async function listRuns(userId, workflowId) {
  if (MODE === "aws") {
    const res = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":prefix": "RUN#" },
    }));
    let items = res.Items || [];
    if (workflowId) items = items.filter((r) => r.workflowId === workflowId);
    return items.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  }
  const rows = workflowId
    ? sqliteDb.prepare("SELECT * FROM runs WHERE user_id = ? AND workflow_id = ? ORDER BY started_at DESC").all(userId, workflowId)
    : sqliteDb.prepare("SELECT * FROM runs WHERE user_id = ? ORDER BY started_at DESC").all(userId);
  return rows.map(rowToRun);
}

export async function getRun(userId, id) {
  if (MODE === "aws") {
    const res = await ddb.send(new GetCommand({ TableName: TABLE, Key: { PK: `USER#${userId}`, SK: `RUN#${id}` } }));
    return res.Item || null;
  }
  const row = sqliteDb.prepare("SELECT * FROM runs WHERE id = ? AND user_id = ?").get(id, userId);
  return row ? rowToRun(row) : null;
}

function rowToRun(row) {
  return {
    id: row.id, workflowId: row.workflow_id, userId: row.user_id, status: row.status,
    inputText: row.input_text, inputFileName: row.input_file_name, inputFileUrl: row.input_file_url,
    stepsResult: JSON.parse(row.steps_result_json), error: row.error,
    startedAt: row.started_at, finishedAt: row.finished_at,
  };
}