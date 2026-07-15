async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (email, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),

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

  downloadUrl: (reportId) => `/api/reports/${reportId}/download`,
};
