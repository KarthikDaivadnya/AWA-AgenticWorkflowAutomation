import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside style={{
        width: 220, borderRight: "1px solid var(--border)", padding: "22px 16px",
        display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 0, height: "100vh"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 24 }}>
          <div className="mono" style={{
            width: 26, height: 26, borderRadius: 7, background: "var(--accent)",
            display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "#fff"
          }}>⛓</div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>Agentic Workflows</span>
        </div>

        <NavItem to="/" label="Workflows" />
        <NavItem to="/runs" label="Run history" />

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, padding: "14px 8px 0" }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginBottom: 10 }}>{user?.email}</div>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", padding: "8px 12px" }}
            onClick={() => { logout(); navigate("/login"); }}>
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "32px 40px", maxWidth: 980 }}>
        {children}
      </main>
    </div>
  );
}

function NavItem({ to, label }) {
  return (
    <NavLink to={to} end style={({ isActive }) => ({
      padding: "9px 12px",
      borderRadius: 7,
      fontSize: 14,
      fontWeight: 500,
      color: isActive ? "var(--text)" : "var(--text-muted)",
      background: isActive ? "var(--panel-raised)" : "transparent",
    })}>
      {label}
    </NavLink>
  );
}
