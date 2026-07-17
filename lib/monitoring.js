import * as Sentry from "@sentry/node";

// Monitoramento de erros opcional. Segue o mesmo padrão do modo mock da IA:
// sem SENTRY_DSN definido, nada é inicializado e nada é enviado — o app
// funciona igual. Com a variável, os erros do backend vão para o Sentry.

let ativo = false;

export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0, // só captura de erros, sem tracing/performance
  });
  ativo = true;
}

export async function captureException(err) {
  if (!ativo) return;
  try {
    Sentry.captureException(err);
    // Em serverless o processo pode congelar logo após a resposta; força o
    // envio do evento antes de seguir (curto timeout para não travar a rota).
    await Sentry.flush(2000);
  } catch {
    // O monitoramento nunca deve derrubar a requisição principal.
  }
}
