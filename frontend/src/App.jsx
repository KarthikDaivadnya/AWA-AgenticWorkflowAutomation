import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { api } from "./api/client";
import Layout from "./components/Layout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import RunView from "./pages/RunView";

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AllRuns() {
  const [runs, setRuns] = useState(null);
  useEffect(() => { api.listRuns().then(setRuns); }, []);

  return (
    <Layout>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Run history</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {runs?.length === 0 && <p style={{ color: "var(--text-faint)", fontSize: 13 }}>No runs yet.</p>}
        {runs?.map((run) => (
          <div key={run.id} className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="mono" style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(run.startedAt).toLocaleString()}</div>
              <div style={{ fontSize: 13, color: "var(--text-faint)", maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {run.inputText}
              </div>
            </div>
            <span className={`badge badge-${run.status}`}><span className="badge-dot" />{run.status}</span>
          </div>
        ))}
      </div>
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/workflows/new" element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>} />
          <Route path="/workflows/:id/edit" element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>} />
          <Route path="/workflows/:id/run" element={<ProtectedRoute><RunView /></ProtectedRoute>} />
          <Route path="/runs" element={<ProtectedRoute><AllRuns /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
