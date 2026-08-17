import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../db/init.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const stepSchema = z.object({
  id: z.string(),
  type: z.enum(["summarize", "extract", "classify", "draft_reply", "custom"]),
  label: z.string().min(1).max(100),
  prompt: z.string().max(4000).optional(), // used when type === custom
});

const workflowSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional().default(""),
  steps: z.array(stepSchema).min(1).max(10),
});

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps: JSON.parse(row.steps_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC")
    .all(req.user.id);
  res.json(rows.map(serialize));
});

router.get("/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM workflows WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: "Workflow not found" });
  res.json(serialize(row));
});

router.post("/", (req, res) => {
  const parsed = workflowSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, description, steps } = parsed.data;
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO workflows (id, user_id, name, description, steps_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.user.id, name, description, JSON.stringify(steps), now, now);

  res.status(201).json(serialize({ id, name, description, steps_json: JSON.stringify(steps), created_at: now, updated_at: now }));
});

router.put("/:id", (req, res) => {
  const parsed = workflowSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const existing = db
    .prepare("SELECT id FROM workflows WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Workflow not found" });

  const { name, description, steps } = parsed.data;
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE workflows SET name = ?, description = ?, steps_json = ?, updated_at = ? WHERE id = ?`
  ).run(name, description, JSON.stringify(steps), now, req.params.id);

  const row = db.prepare("SELECT * FROM workflows WHERE id = ?").get(req.params.id);
  res.json(serialize(row));
});

router.delete("/:id", (req, res) => {
  const result = db
    .prepare("DELETE FROM workflows WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Workflow not found" });
  res.status(204).end();
});

export default router;
