// "" (empty string) means "same origin as the page" — used when the
// frontend is served by the backend itself. Falls back to localhost
// only when the env var isn't set at all (local dev with separate
// frontend/backend servers).
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function getToken() {
  return localStorage.getItem("awa_token");
}

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!isForm) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  register: (payload) => request("/api/auth/register", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),

  listWorkflows: () => request("/api/workflows"),
  getWorkflow: (id) => request(`/api/workflows/${id}`),
  createWorkflow: (payload) => request("/api/workflows", { method: "POST", body: payload }),
  updateWorkflow: (id, payload) => request(`/api/workflows/${id}`, { method: "PUT", body: payload }),
  deleteWorkflow: (id) => request(`/api/workflows/${id}`, { method: "DELETE" }),

  listRuns: (workflowId) => request(`/api/runs${workflowId ? `?workflowId=${workflowId}` : ""}`),
  getRun: (id) => request(`/api/runs/${id}`),
  triggerRun: ({ workflowId, inputText, file }) => {
    if (file) {
      const form = new FormData();
      form.append("workflowId", workflowId);
      if (inputText) form.append("inputText", inputText);
      form.append("file", file);
      return request("/api/runs", { method: "POST", body: form, isForm: true });
    }
    return request("/api/runs", { method: "POST", body: { workflowId, inputText } });
  },
};

export { BASE_URL, getToken };
