import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Layout from "../components/Layout";

const STEP_ICONS = {
  summarize: "▸",
  extract: "{ }",
  classify: "◆",
  draft_reply: "✉",
  custom: "*",
};

export default function Dashboard() {
  const [workflows, setWorkflows] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.listWorkflows().then(setWorkflows).catch((e) => setError(e.message));
  }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this workflow? This can't be undone.")) return;
    await api.deleteWorkflow(id);
    setWorkflows((w) => w.filter((wf) => wf.id !== id));
  }

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>Workflows</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "4px 0 0" }}>
            Chains of AI agent steps — each step's output feeds the next.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/workflows/new")}>+ New workflow</button>
      </div>

      {error && <div className="mono" style={{ color: "var(--state-error)", fontSize: 13 }}>{error}</div>}

      {workflows?.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          <p style={{ marginBottom: 16 }}>No workflows yet. Build your first agent pipeline.</p>
          <button className="btn btn-primary" onClick={() => navigate("/workflows/new")}>Create a workflow</button>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {workflows?.map((wf) => (
          <div key={wf.id} className="card" style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Link to={`/workflows/${wf.id}/run`} style={{ fontSize: 16, fontWeight: 600 }}>{wf.name}</Link>
              {wf.description && <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 10px" }}>{wf.description}</p>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {wf.steps.map((s, i) => (
                  <span key={s.id} className="mono badge badge-idle" style={{ fontSize: 10 }}>
                    {String(i + 1).padStart(2, "0")} {STEP_ICONS[s.type]} {s.label}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => navigate(`/workflows/${wf.id}/edit`)}>Edit</button>
              <button className="btn btn-primary" onClick={() => navigate(`/workflows/${wf.id}/run`)}>Run</button>
              <button className="btn btn-danger" onClick={() => handleDelete(wf.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
