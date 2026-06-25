// API client. In dev, Vite proxies /api -> http://localhost:8000.
const BASE = import.meta.env.VITE_API_BASE || "";

async function getJSON(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function postJSON(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const fetchHealth = () => getJSON("/api/health");

export const fetchSchema = (id) =>
  getJSON(`/api/schema${id ? `?dataset_id=${id}` : ""}`);

export const fetchStats = (id) =>
  getJSON(`/api/stats${id ? `?dataset_id=${id}` : ""}`);

export const fetchExamples = (id) =>
  getJSON(`/api/examples${id ? `?dataset_id=${id}` : ""}`);

export const fetchStatus = (id) => getJSON(`/api/datasets/${id}/status`);

export const startTraining = (id) => postJSON(`/api/datasets/${id}/train`, {});

export const loadSample = (train = false) => postJSON("/api/sample", { train });

export async function uploadCsv(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function runQuery(question, datasetId) {
  return postJSON("/api/query", { question, dataset_id: datasetId });
}

export async function executeSql(sql, datasetId) {
  return postJSON("/api/execute", { sql, dataset_id: datasetId });
}

export const fetchDatasets = () => getJSON("/api/datasets");

export const activateDataset = (id) =>
  postJSON(`/api/datasets/${id}/activate`, {});
