import { supabase } from "./supabaseClient.js";

async function request(path, options = {}) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;

  const headers = {
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listClients: () => request("/api/clients"),
  createClient: (nome) => request("/api/clients", { method: "POST", body: JSON.stringify({ nome }) }),

  listReports: () => request("/api/reports"),
  getReport: (id) => request(`/api/reports/${id}`),

  uploadSpreadsheet: (clientId, mesReferencia, file) => {
    const form = new FormData();
    form.append("clientId", clientId);
    form.append("mesReferencia", mesReferencia);
    form.append("file", file);
    return request("/api/reports/upload", { method: "POST", body: form });
  },

  uploadAttachment: (reportId, processoNumero, file) => {
    const form = new FormData();
    form.append("processoNumero", processoNumero);
    form.append("file", file);
    return request(`/api/reports/${reportId}/attachments`, { method: "POST", body: form });
  },

  removeAttachment: (reportId, attachmentId) =>
    request(`/api/reports/${reportId}/attachments/${attachmentId}`, { method: "DELETE" }),

  analyzeReport: (reportId) => request(`/api/reports/${reportId}/analyze`, { method: "POST" }),

  updateReport: (reportId, data) => request(`/api/reports/${reportId}`, { method: "PATCH", body: JSON.stringify(data) }),

  finalizeReport: (reportId) => request(`/api/reports/${reportId}/finalize`, { method: "POST" }),

  getDownloadUrl: async (reportId) => (await request(`/api/reports/${reportId}/download`)).url,
};
