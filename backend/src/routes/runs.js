import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";
import { runWorkflow } from "../services/agentService.js";
import { saveFile, readLocalFileAsText } from "../services/storageService.js";
import { getWorkflow, createRun, updateRunResult, listRuns, getRun } from "../db/store.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
router.use(requireAuth);

router.get("/", ah(async (req, res) => {
  const { workflowId } = req.query;
  res.json(await listRuns(req.user.id, workflowId));
}));

router.get("/:id", ah(async (req, res) => {
  const run = await getRun(req.user.id, req.params.id);
  if (!run) return res.status(404).json({ error: "Run not found" });
  res.json(run);
}));

// Trigger a run: accepts either JSON { workflowId, inputText } or multipart with a file field "file"
router.post("/", upload.single("file"), ah(async (req, res) => {
  const io = req.app.get("io");
  const { workflowId } = req.body;
  if (!workflowId) return res.status(400).json({ error: "workflowId is required" });

  const workflow = await getWorkflow(req.user.id, workflowId);
  if (!workflow) return res.status(404).json({ error: "Workflow not found" });

  let inputText = req.body.inputText || "";
  let fileInfo = null;

  if (req.file) {
    fileInfo = await saveFile(req.file);
    try {
      inputText = readLocalFileAsText(fileInfo.url) || inputText;
    } catch {
      // binary/unreadable file, or file lives in S3 (not local disk) — fall back to inputText
    }
  }

  if (!inputText || !inputText.trim()) {
    return res.status(400).json({ error: "Provide inputText or upload a text file" });
  }

  const runId = nanoid();
  const startedAt = new Date().toISOString();
  await createRun({
    id: runId, workflowId, userId: req.user.id, status: "running",
    inputText, inputFileName: fileInfo?.name || null, inputFileUrl: fileInfo?.url || null, startedAt,
  });

  res.status(202).json({ runId, status: "running" });

  // This part runs after the response is already sent, so a thrown error
  // here can't go through Express's error handling — it's caught locally
  // and reported over the websocket instead, same as before.
  const room = `run:${runId}`;
  try {
    const results = await runWorkflow(workflow.steps, inputText, (stepResult) => {
      io?.to(room).emit("step:update", { runId, step: stepResult });
    });
    await updateRunResult(req.user.id, runId, { status: "completed", stepsResult: results, finishedAt: new Date().toISOString() });
    io?.to(room).emit("run:complete", { runId, status: "completed", stepsResult: results });
  } catch (err) {
    const partial = err.partialResults || [];
    try {
      await updateRunResult(req.user.id, runId, { status: "failed", stepsResult: partial, error: err.message, finishedAt: new Date().toISOString() });
    } catch (persistErr) {
      console.error("Failed to persist run failure state:", persistErr);
    }
    io?.to(room).emit("run:complete", { runId, status: "failed", error: err.message, stepsResult: partial });
  }
}));

export default router;