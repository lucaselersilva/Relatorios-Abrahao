// Monitoramento de erros opcional no frontend. Sem VITE_SENTRY_DSN definido,
// nada é carregado (o Sentry entra por import dinâmico só quando há DSN, então
// não pesa no bundle da maioria dos casos). Mesmo espírito do modo mock da IA.

let sentry = null;

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/react");
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0,
    });
    sentry = Sentry;
  } catch {
    // Falha ao carregar o monitoramento não pode impedir o app de subir.
  }
}

export function captureError(error, info) {
  if (!sentry) return;
  try {
    sentry.captureException(error, info ? { contexts: { react: info } } : undefined);
  } catch {
    /* ignore */
  }
}
