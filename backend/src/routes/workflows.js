import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { ah } from "../middleware/asyncHandler.js";
import { createWorkflow, listWorkflows, getWorkflow, updateWorkflow, deleteWorkflow } from "../db/store.js";

const router = Router();
router.use(requireAuth);

const stepSchema = z.object({
  id: z.string(),
  type: z.enum(["summarize", "extract", "classify", "draft_reply", "custom"]),
  label: z.string().min(1).max(100),
  prompt: z.string().max(4000).optional(),
});

const workflowSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional().default(""),
  steps: z.array(stepSchema).min(1).max(10),
});

router.get("/", ah(async (req, res) => {
  res.json(await listWorkflows(req.user.id));
}));

router.get("/:id", ah(async (req, res) => {
  const wf = await getWorkflow(req.user.id, req.params.id);
  if (!wf) return res.status(404).json({ error: "Workflow not found" });
  res.json(wf);
}));

router.post("/", ah(async (req, res) => {
  const parsed = workflowSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, description, steps } = parsed.data;
  const now = new Date().toISOString();
  const wf = await createWorkflow({ id: nanoid(), userId: req.user.id, name, description, steps, createdAt: now, updatedAt: now });
  res.status(201).json(wf);
}));

router.put("/:id", ah(async (req, res) => {
  const parsed = workflowSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, description, steps } = parsed.data;
  const updated = await updateWorkflow(req.user.id, req.params.id, { name, description, steps, updatedAt: new Date().toISOString() });
  if (!updated) return res.status(404).json({ error: "Workflow not found" });
  res.json(updated);
}));

router.delete("/:id", ah(async (req, res) => {
  const ok = await deleteWorkflow(req.user.id, req.params.id);
  if (!ok) return res.status(404).json({ error: "Workflow not found" });
  res.status(204).end();
}));

export default router;