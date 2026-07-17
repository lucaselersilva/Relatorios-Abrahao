// Envio de e-mail com provedor plugável, sem dependência nova.
//
// Hoje o projeto não tem conta em nenhum provedor de e-mail. Então o envio
// funciona "com o que temos": o endpoint de envio devolve um `mailto:` e o
// próprio cliente de e-mail do advogado manda a mensagem (com o link seguro do
// relatório) — ver server/app.js. Nada precisa ser configurado.
//
// Se um dia for configurada a variável RESEND_API_KEY (Resend — https://resend.com,
// tem plano gratuito), o MESMO botão passa a enviar automaticamente pelo
// servidor, com o PDF anexado, sem mudar o código. Usamos só `fetch` — sem SDK.

export function emailProvider() {
  if (process.env.RESEND_API_KEY) return "resend";
  return null;
}

export function emailConfigurado() {
  return emailProvider() !== null;
}

function emailFrom() {
  // Remetente verificado no provedor. Sem EMAIL_FROM, usa o domínio de teste do
  // Resend (só entrega para o dono da conta — suficiente para validar).
  return process.env.EMAIL_FROM || "Relatórios <onboarding@resend.dev>";
}

/**
 * Envia um e-mail pelo provedor configurado. Lança se nenhum estiver
 * configurado (o chamador deve tratar caindo no fluxo de mailto).
 * `attachments`: [{ filename, content: Buffer }].
 */
export async function sendEmail({ to, subject, html, text, attachments }) {
  const provider = emailProvider();
  if (provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: emailFrom(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        attachments: (attachments ?? []).map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend respondeu ${res.status}: ${body.slice(0, 300)}`);
    }
    return res.json();
  }
  throw new Error("Nenhum provedor de e-mail configurado.");
}
