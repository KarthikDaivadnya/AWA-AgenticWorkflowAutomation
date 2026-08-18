// Shown when a run history row is expanded. Displays the original input
// plus each step's answer, in order, so the user can actually read what
// the workflow produced — not just that it ran.
export default function RunDetailCard({ run }) {
  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: 16, background: "var(--bg)" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>
          Input
        </div>
        <pre className="mono" style={{
          fontSize: 12, color: "var(--text)", background: "var(--panel)", border: "1px solid var(--border)",
          padding: 10, borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
        }}>
          {run.inputText || "(no text — file upload)"}
        </pre>
        {run.inputFileName && (
          <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
            File: {run.inputFileName}
          </div>
        )}
      </div>

      {run.stepsResult && run.stepsResult.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {run.stepsResult.map((step, i) => (
            <div key={step.stepId || i} style={{ display: "flex", gap: 12 }}>
              <div className="mono" style={{
                width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                background: step.status === "success" ? "rgba(79,214,140,0.12)" : "rgba(243,106,106,0.12)",
                border: `1px solid ${step.status === "success" ? "var(--state-success)" : "var(--state-error)"}`,
                display: "grid", placeItems: "center", fontSize: 10,
                color: step.status === "success" ? "var(--state-success)" : "var(--state-error)",
              }}>
                {step.status === "success" ? "✓" : "✕"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{step.label || step.type}</div>
                {step.output && (
                  <pre className="mono" style={{
                    fontSize: 12, color: "var(--text-muted)", background: "var(--panel)", border: "1px solid var(--border)",
                    padding: 10, borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
                  }}>
                    {step.output}
                  </pre>
                )}
                {step.status === "error" && (
                  <div className="mono" style={{ fontSize: 12, color: "var(--state-error)" }}>{step.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>No step output recorded for this run.</div>
      )}

      {run.error && run.status === "failed" && (
        <div className="mono" style={{ fontSize: 12, color: "var(--state-error)", marginTop: 12, padding: 10, background: "rgba(243,106,106,0.08)", borderRadius: 6 }}>
          {run.error}
        </div>
      )}
    </div>
  );
}
