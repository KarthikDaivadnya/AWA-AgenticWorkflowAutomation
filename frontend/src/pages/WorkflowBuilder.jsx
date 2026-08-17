import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import Layout from "../components/Layout";

const STEP_TYPES = [
  { value: "summarize", label: "Summarize", desc: "Condense the input into key points" },
  { value: "extract", label: "Extract data", desc: "Pull structured fields out as JSON" },
  { value: "classify", label: "Classify", desc: "Assign a category or priority label" },
  { value: "draft_reply", label: "Draft reply", desc: "Write a response based on the input" },
  { value: "custom", label: "Custom prompt", desc: "Define your own agent instruction" },
];

function newStep() {
  return { id: crypto.randomUUID(), type: "summarize", label: "Summarize", prompt: "" };
}

export default function WorkflowBuilder() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState([newStep()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isNew) {
      api.getWorkflow(id).then((wf) => {
        setName(wf.name);
        setDescription(wf.description);
        setSteps(wf.steps);
      });
    }
  }, [id, isNew]);

  function updateStep(stepId, patch) {
    setSteps((s) => s.map((step) => (step.id === stepId ? { ...step, ...patch } : step)));
  }

  function addStep() {
    setSteps((s) => [...s, newStep()]);
  }

  function removeStep(stepId) {
    setSteps((s) => s.filter((step) => step.id !== stepId));
  }

  function moveStep(index, dir) {
    setSteps((s) => {
      const next = [...s];
      const target = index + dir;
      if (target < 0 || target >= next.length) return s;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    setError("");
    if (!name.trim()) return setError("Give the workflow a name.");
    if (steps.length === 0) return setError("Add at least one step.");
    setSaving(true);
    try {
      const payload = { name, description, steps };
      if (isNew) {
        const wf = await api.createWorkflow(payload);
        navigate(`/workflows/${wf.id}/run`);
      } else {
        await api.updateWorkflow(id, payload);
        navigate(`/workflows/${id}/run`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>{isNew ? "New workflow" : "Edit workflow"}</h1>
      <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 28 }}>
        Each step's output becomes the next step's input — that's the chain.
      </p>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <label>Workflow name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Support Ticket Triage" />
        </div>
        <div>
          <label>Description (optional)</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this pipeline automate?" />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((step, i) => (
          <div key={step.id} style={{ display: "flex", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 32 }}>
              <div className="mono" style={{
                width: 32, height: 32, borderRadius: "50%", background: "var(--panel-raised)",
                border: "1px solid var(--border-strong)", display: "grid", placeItems: "center",
                fontSize: 12, fontWeight: 600, flexShrink: 0, color: "var(--accent-bright)"
              }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              {i < steps.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 24, background: "var(--border-strong)" }} />}
            </div>

            <div className="card" style={{ padding: 18, marginBottom: 16, flex: 1 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label>Step type</label>
                  <select value={step.type} onChange={(e) => {
                    const t = STEP_TYPES.find((x) => x.value === e.target.value);
                    updateStep(step.id, { type: t.value, label: t.label });
                  }}>
                    {STEP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label>Label</label>
                  <input value={step.label} onChange={(e) => updateStep(step.id, { label: e.target.value })} />
                </div>
              </div>

              <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "0 0 12px" }}>
                {STEP_TYPES.find((t) => t.value === step.type)?.desc}
              </p>

              {step.type === "custom" && (
                <div>
                  <label>Agent instruction</label>
                  <textarea rows={3} value={step.prompt} onChange={(e) => updateStep(step.id, { prompt: e.target.value })}
                    placeholder="e.g. Rewrite the input in a formal tone and flag any legal risk." />
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }} disabled={i === 0} onClick={() => moveStep(i, -1)}>↑ Move up</button>
                <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12 }} disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}>↓ Move down</button>
                <div style={{ flex: 1 }} />
                <button className="btn btn-danger" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => removeStep(step.id)} disabled={steps.length === 1}>Remove</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-ghost" style={{ borderStyle: "dashed", borderColor: "var(--border-strong)", width: "100%", justifyContent: "center", padding: 14, marginBottom: 24 }} onClick={addStep}>
        + Add step
      </button>

      {error && <div className="mono" style={{ color: "var(--state-error)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : isNew ? "Create workflow" : "Save changes"}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("/")}>Cancel</button>
      </div>
    </Layout>
  );
}
