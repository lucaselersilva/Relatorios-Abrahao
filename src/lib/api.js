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
    const err = new Error(body.error || `Erro ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getDashboard: () => request("/api/dashboard"),

  listClients: () => request("/api/clients"),
  getClient: (id) => request(`/api/clients/${id}`),
  createClient: (nome) => request("/api/clients", { method: "POST", body: JSON.stringify({ nome }) }),
  updateClient: (id, data) => request(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  addContact: (clientId, data) =>
    request(`/api/clients/${clientId}/contacts`, { method: "POST", body: JSON.stringify(data) }),
  updateContact: (clientId, contactId, data) =>
    request(`/api/clients/${clientId}/contacts/${contactId}`, { method: "PATCH", body: JSON.stringify(data) }),
  removeContact: (clientId, contactId) =>
    request(`/api/clients/${clientId}/contacts/${contactId}`, { method: "DELETE" }),

  listReports: () => request("/api/reports"),
  getReport: (id) => request(`/api/reports/${id}`),

  uploadSpreadsheet: (clientId, periodo, mesReferencia, file, mapping) => {
    const form = new FormData();
    form.append("clientId", clientId);
    form.append("periodo", periodo);
    form.append("mesReferencia", mesReferencia);
    form.append("file", file);
    if (mapping && Object.keys(mapping).length) form.append("mapping", JSON.stringify(mapping));
    return request("/api/reports/upload", { method: "POST", body: form });
  },

  replaceSpreadsheet: (reportId, file, mapping) => {
    const form = new FormData();
    form.append("file", file);
    if (mapping && Object.keys(mapping).length) form.append("mapping", JSON.stringify(mapping));
    return request(`/api/reports/${reportId}/spreadsheet`, { method: "PUT", body: form });
  },

  deleteReport: (reportId) => request(`/api/reports/${reportId}`, { method: "DELETE" }),

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
  getPdfDownloadUrl: async (reportId) => (await request(`/api/reports/${reportId}/download-pdf`)).url,

  createShareLink: (reportId, dias) =>
    request(`/api/reports/${reportId}/share-link`, { method: "POST", body: JSON.stringify(dias ? { dias } : {}) }),
  revokeShareLink: (reportId) => request(`/api/reports/${reportId}/share-link`, { method: "DELETE" }),

  sendReportEmail: (reportId, { contactIds, to } = {}) =>
    request(`/api/reports/${reportId}/send-email`, {
      method: "POST",
      body: JSON.stringify({ contactIds, to, baseUrl: window.location.origin }),
    }),

  // Rotas públicas (sem login) — usadas pela página /r/:token.
  getPublicReport: (token) => request(`/api/public/reports/${token}`),
  getPublicPdfUrl: async (token) => (await request(`/api/public/reports/${token}/pdf`)).url,
};
