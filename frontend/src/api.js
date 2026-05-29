// Tiny API client. In dev, Vite proxies /api -> http://localhost:8000.
const BASE = import.meta.env.VITE_API_BASE || "";

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function fetchStats() {
  return getJSON("/api/stats");
}

export async function fetchExamples() {
  return getJSON("/api/examples");
}

export async function fetchHealth() {
  return getJSON("/api/health");
}

export async function runQuery(question) {
  const res = await fetch(`${BASE}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}
