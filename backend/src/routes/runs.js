import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { db } from "../db/init.js";
import { requireAuth } from "../middleware/auth.js";
import { runWorkflow } from "../services/agentService.js";
import { saveFile, readLocalFileAsText } from "../services/storageService.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(requireAuth);

function serialize(row) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    status: row.status,
    inputText: row.input_text,
    inputFileName: row.input_file_name,
    inputFileUrl: row.input_file_url,
    stepsResult: JSON.parse(row.steps_result_json),
    error: row.error,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

router.get("/", (req, res) => {
  const { workflowId } = req.query;
  const rows = workflowId
    ? db
        .prepare("SELECT * FROM runs WHERE user_id = ? AND workflow_id = ? ORDER BY started_at DESC")
        .all(req.user.id, workflowId)
    : db.prepare("SELECT * FROM runs WHERE user_id = ? ORDER BY started_at DESC").all(req.user.id);
  res.json(rows.map(serialize));
});

router.get("/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM runs WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Run not found" });
  res.json(serialize(row));
});

// Trigger a run: accepts either JSON { workflowId, inputText } or multipart with a file field "file"
router.post("/", upload.single("file"), async (req, res) => {
  const io = req.app.get("io");
  const { workflowId } = req.body;
  if (!workflowId) return res.status(400).json({ error: "workflowId is required" });

  const workflowRow = db
    .prepare("SELECT * FROM workflows WHERE id = ? AND user_id = ?")
    .get(workflowId, req.user.id);
  if (!workflowRow) return res.status(404).json({ error: "Workflow not found" });
  const steps = JSON.parse(workflowRow.steps_json);

  let inputText = req.body.inputText || "";
  let fileInfo = null;

  if (req.file) {
    fileInfo = await saveFile(req.file);
    try {
      inputText = readLocalFileAsText(fileInfo.url) || inputText;
    } catch {
      // binary or unreadable file — fall back to whatever inputText was provided
    }
  }

  if (!inputText || !inputText.trim()) {
    return res.status(400).json({ error: "Provide inputText or upload a text file" });
  }

  const runId = nanoid();
  const startedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO runs (id, workflow_id, user_id, status, input_text, input_file_name, input_file_url, started_at)
     VALUES (?, ?, ?, 'running', ?, ?, ?, ?)`
  ).run(runId, workflowId, req.user.id, inputText, fileInfo?.name || null, fileInfo?.url || null, startedAt);

  // Respond immediately with the run id; client subscribes over WebSocket for live progress.
  res.status(202).json({ runId, status: "running" });

  const room = `run:${runId}`;
  try {
    const results = await runWorkflow(steps, inputText, (stepResult) => {
      io?.to(room).emit("step:update", { runId, step: stepResult });
    });
    db.prepare(
      `UPDATE runs SET status = 'completed', steps_result_json = ?, finished_at = ? WHERE id = ?`
    ).run(JSON.stringify(results), new Date().toISOString(), runId);
    io?.to(room).emit("run:complete", { runId, status: "completed", stepsResult: results });
  } catch (err) {
    const partial = err.partialResults || [];
    db.prepare(
      `UPDATE runs SET status = 'failed', steps_result_json = ?, error = ?, finished_at = ? WHERE id = ?`
    ).run(JSON.stringify(partial), err.message, new Date().toISOString(), runId);
    io?.to(room).emit("run:complete", { runId, status: "failed", error: err.message, stepsResult: partial });
  }
});

export default router;
