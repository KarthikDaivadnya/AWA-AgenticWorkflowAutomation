import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { api, BASE_URL, getToken } from "../api/client";
import Layout from "../components/Layout";
import RunDetailCard from "../components/RunDetailCard";

export default function RunView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [inputText, setInputText] = useState("");
  const [file, setFile] = useState(null);
  const [runId, setRunId] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | running | completed | failed
  const [stepResults, setStepResults] = useState([]);
  const [runError, setRunError] = useState("");
  const [history, setHistory] = useState([]);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    api.getWorkflow(id).then(setWorkflow);
    api.listRuns(id).then(setHistory);
  }, [id]);

  useEffect(() => {
    // Empty BASE_URL means same-origin mode — passing "" to io() would try
    // to connect to a literal empty host, so pass undefined instead, which
    // makes socket.io-client default to the page's own origin.
    const socket = io(BASE_URL || undefined, { auth: { token: getToken() } });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, []);

  async function handleRun() {
    if (!inputText.trim() && !file) return;
    setRunError("");
    setStatus("running");
    setStepResults([]);

    const socket = socketRef.current;

    try {
      const { runId: newRunId } = await api.triggerRun({ workflowId: id, inputText, file });
      setRunId(newRunId);
      socket.emit("run:subscribe", newRunId);

      socket.on("step:update", ({ runId: rid, step }) => {
        if (rid !== newRunId) return;
        setStepResults((prev) => [...prev, step]);
      });

      socket.on("run:complete", ({ runId: rid, status: finalStatus, error }) => {
        if (rid !== newRunId) return;
        setStatus(finalStatus);
        if (error) setRunError(error);
        api.listRuns(id).then(setHistory);
        socket.off("step:update");
        socket.off("run:complete");
      });
    } catch (err) {
      setStatus("failed");
      setRunError(err.message);
    }
  }

  if (!workflow) return <Layout><p style={{ color: "var(--text-muted)" }}>Loading…</p></Layout>;

  return (
    <Layout>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: 24, margin: 0 }}>{workflow.name}</h1>
          {workflow.description && <p style={{ color: "var(--text-muted)", fontSize: 14, margin: "4px 0 0" }}>{workflow.description}</p>}
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(`/workflows/${id}/edit`)}>Edit workflow</button>
      </div>

      <div style={{ display: "flex", gap: 6, margin: "16px 0 24px" }}>
        {workflow.steps.map((s, i) => (
          <span key={s.id} className="mono badge badge-idle" style={{ fontSize: 10 }}>
            {String(i + 1).padStart(2, "0")} {s.label}
          </span>
        ))}
      </div>

      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <label>Input text</label>
        <textarea rows={4} value={inputText} onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste the text this workflow should process…" style={{ marginBottom: 14 }} />

        <label>Or upload a text file</label>
        <input type="file" accept=".txt,.md,.csv,.json" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: 16 }} />

        <button className="btn btn-primary" onClick={handleRun} disabled={status === "running"}>
          {status === "running" ? "Running…" : "Run workflow"}
        </button>
      </div>

      {runId && (
        <div className="card" style={{ padding: 20, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Live execution</span>
            <StatusBadge status={status} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workflow.steps.map((step, i) => {
              const result = stepResults.find((r) => r.stepId === step.id);
              const isCurrent = !result && status === "running" && stepResults.length === i;
              return (
                <div key={step.id} style={{ display: "flex", gap: 14 }}>
                  <div className="mono" style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    background: result ? (result.status === "success" ? "rgba(79,214,140,0.12)" : "rgba(243,106,106,0.12)") : "var(--panel-raised)",
                    border: `1px solid ${result ? (result.status === "success" ? "var(--state-success)" : "var(--state-error)") : "var(--border-strong)"}`,
                    display: "grid", placeItems: "center", fontSize: 11,
                    color: result ? (result.status === "success" ? "var(--state-success)" : "var(--state-error)") : "var(--text-faint)"
                  }}>
                    {result ? (result.status === "success" ? "✓" : "✕") : isCurrent ? "…" : i + 1}
                  </div>
                  <div style={{ flex: 1, paddingBottom: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{step.label}</div>
                    {result?.output && (
                      <pre className="mono" style={{
                        fontSize: 12, color: "var(--text-muted)", background: "var(--bg)",
                        padding: 10, borderRadius: 6, marginTop: 6, whiteSpace: "pre-wrap", wordBreak: "break-word"
                      }}>{result.output}</pre>
                    )}
                    {result?.status === "error" && (
                      <div className="mono" style={{ fontSize: 12, color: "var(--state-error)", marginTop: 6 }}>{result.error}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {runError && status === "failed" && (
            <div className="mono" style={{ fontSize: 12, color: "var(--state-error)", marginTop: 12, padding: 10, background: "rgba(243,106,106,0.08)", borderRadius: 6 }}>
              {runError}
            </div>
          )}
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Run history</h2>
      <p style={{ color: "var(--text-faint)", fontSize: 12, marginTop: -8, marginBottom: 12 }}>Click a run to see the input and every step's answer.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {history.length === 0 && <p style={{ color: "var(--text-faint)", fontSize: 13 }}>No runs yet.</p>}
        {history.map((run) => {
          const isExpanded = expandedRunId === run.id;
          return (
            <div key={run.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                style={{
                  width: "100%", padding: 14, background: "none", border: "none", cursor: "pointer",
                  display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left", color: "inherit",
                }}
              >
                <div style={{ minWidth: 0, flex: 1, marginRight: 12 }}>
                  <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(run.startedAt).toLocaleString()}</div>
                  <div style={{ fontSize: 13, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {run.inputText}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <StatusBadge status={run.status} />
                  <span style={{ color: "var(--text-faint)", fontSize: 12 }}>{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>
              {isExpanded && <RunDetailCard run={run} />}
            </div>
          );
        })}
      </div>
    </Layout>
  );
}

function StatusBadge({ status }) {
  const map = {
    idle: "Idle",
    running: "Running",
    completed: "Completed",
    failed: "Failed",
    pending: "Pending",
  };
  return <span className={`badge badge-${status}`}><span className="badge-dot" />{map[status] || status}</span>;
}
