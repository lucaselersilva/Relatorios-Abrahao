import path from "node:path";
import { randomBytes } from "node:crypto";

import express from "express";
import multer from "multer";
import { z } from "zod";
import { waitUntil } from "@vercel/functions";

import { Prisma } from "@prisma/client";

import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { uploadFile, getSignedUrl, removeFiles, downloadFile } from "../lib/storage.js";
import { emailProvider, sendEmail } from "../lib/email.js";
import { parseSpreadsheet, normalizeMapping, CAMPOS_SISTEMA } from "../lib/xlsx-parser.js";
import { computeDiff, computeKpis, computePanorama, formatMoeda } from "../lib/diff.js";
import { isPeriodoValido, periodoParaRotulo, periodoAtual } from "../lib/periodo.js";
import { gerarAnaliseIA } from "../lib/ai.js";
import { generateReportDocx } from "../lib/docx-generator.js";
import { generateReportPdf } from "../lib/pdf-generator.js";
import { initMonitoring, captureException } from "../lib/monitoring.js";

initMonitoring();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Anexos: só documentos de apoio jurídico fazem sentido aqui. Restringimos por
// extensão (o mimetype do navegador é pouco confiável para .docx).
const EXTENSOES_ANEXO_PERMITIDAS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx"]);
const MENSAGEM_ANEXO_INVALIDO = "Tipo de arquivo não suportado. Envie PDF, imagem (PNG/JPG/WEBP) ou documento Word (.doc/.docx).";

// Schemas de validação das rotas de escrita.
const clientSchema = z.object({ nome: z.string().trim().min(1, "Nome do cliente é obrigatório") });
// Mapeamento manual de colunas: objeto { campo: nomeColuna } com campos válidos.
const columnMappingSchema = z.record(z.enum(CAMPOS_SISTEMA), z.string()).nullable();
const patchClientSchema = z
  .object({ nome: z.string().trim().min(1).optional(), columnMapping: columnMappingSchema.optional() })
  .refine((v) => v.nome !== undefined || v.columnMapping !== undefined, "Nada para atualizar");
const contactSchema = z.object({
  nome: z.string().trim().min(1, "Nome do contato é obrigatório"),
  email: z.string().trim().email("E-mail inválido"),
  principal: z.boolean().optional(),
});
const patchContactSchema = z
  .object({
    nome: z.string().trim().min(1).optional(),
    email: z.string().trim().email("E-mail inválido").optional(),
    principal: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "Nada para atualizar");
const narrativaSchema = z.object({ titulo: z.string(), texto: z.string(), fonte: z.string() });
const patchReportSchema = z.object({
  narrativas: z.array(narrativaSchema).optional(),
  selecionados: z.array(z.string()).optional(),
});

export const app = express();
app.use(express.json());

/**
 * Lê o campo `mapping` de um upload multipart (chega como string JSON) e devolve
 * um objeto { campo: nomeColuna } normalizado. Entrada inválida vira {}.
 */
function parseMappingBody(raw) {
  if (!raw) return {};
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
    return normalizeMapping(obj);
  } catch {
    return {};
  }
}

/**
 * Executa uma tarefa fora do ciclo request/response.
 *
 * No runtime serverless da Vercel o processo pode ser congelado assim que a
 * resposta HTTP sai — então "continuar processando depois de responder" não é
 * garantido. `waitUntil` (do @vercel/node, exposto por @vercel/functions) diz
 * ao runtime para manter a função viva até a promise terminar, respeitando o
 * teto de `maxDuration` da função (ver vercel.json). Fora da Vercel (dev local)
 * `waitUntil` é inócuo e a promise simplesmente roda no próprio processo.
 */
function runInBackground(promise) {
  // Uma falha aqui não pode virar unhandled rejection nem derrubar o processo.
  const guarded = Promise.resolve(promise).catch((err) => console.error("Tarefa em background falhou:", err));
  try {
    waitUntil(guarded);
  } catch {
    // Sem contexto de request da Vercel: a promise já está rodando localmente.
  }
}

async function extractPdfText(buffer) {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text?.trim() || null;
  } catch {
    return null;
  }
}

/** Conta as movimentações de uma lista de relatórios, quebrando por tipo. */
function resumirMovimentacoes(relatorios) {
  const porTipo = { novo: 0, movimentacao: 0, acordo: 0, encerrado: 0 };
  let total = 0;
  let valor = 0;
  for (const r of relatorios) {
    for (const m of r.movimentacoes ?? []) {
      total += 1;
      porTipo[m.tipo] = (porTipo[m.tipo] ?? 0) + 1;
      if (typeof m.valor === "number") valor += m.valor;
    }
  }
  return { total, porTipo, valor };
}

/**
 * KPIs atuais, KPIs do mês anterior (para as setas de variação) e panorama
 * da carteira (por área + maiores exposições) de um relatório. Usado tanto na
 * finalização (.docx) quanto na visualização em tela do relatório — as duas
 * telas mostram exatamente os mesmos números. `report` precisa incluir `upload`.
 */
/**
 * O upload do período imediatamente anterior deste cliente. Compara pelo
 * `periodo` real ("YYYY-MM"), não pela data de criação — assim um mês enviado
 * fora de ordem (backfill) ainda compara contra o mês certo. Registros antigos
 * sem `periodo` (backfill que não deu para parsear) caem no comportamento
 * legado por data de upload.
 */
async function findUploadAnterior(clientId, periodoAtual, uploadedAtAtual) {
  if (periodoAtual) {
    return prisma.upload.findFirst({
      where: { clientId, periodo: { lt: periodoAtual } },
      orderBy: { periodo: "desc" },
      include: { processos: true },
    });
  }
  return prisma.upload.findFirst({
    where: { clientId, uploadedAt: { lt: uploadedAtAtual } },
    orderBy: { uploadedAt: "desc" },
    include: { processos: true },
  });
}

async function computeReportInsights(report) {
  const processosAtuais = await prisma.processo.findMany({ where: { uploadId: report.uploadId } });
  const kpis = computeKpis(processosAtuais);
  const panorama = computePanorama(processosAtuais);

  const uploadAnterior = await findUploadAnterior(
    report.clientId,
    report.periodo ?? report.upload.periodo,
    report.upload.uploadedAt
  );
  const kpisAnterior = uploadAnterior ? computeKpis(uploadAnterior.processos) : null;

  return { kpis, kpisAnterior, panorama };
}

/** Nome de arquivo amigável para o relatório final: cliente + mês + extensão. */
function reportFileName(cliente, mesReferencia, ext = "docx") {
  return `Relatorio_${cliente.replace(/\s+/g, "_")}_${mesReferencia.replace(/\//g, "-")}.${ext}`;
}

/**
 * Número da versão do relatório na linha do tempo do cliente + os insights
 * (KPIs, KPIs do mês anterior, panorama). Usado na visualização interna e na
 * pública. `report` precisa incluir `upload`.
 */
async function buildReportView(report) {
  const versao = await prisma.report.count({
    where: { clientId: report.clientId, createdAt: { lte: report.createdAt } },
  });
  const { kpis, kpisAnterior, panorama } = await computeReportInsights(report);
  return { versao, kpis, kpisAnterior, panorama };
}

/**
 * Payload seguro do relatório para o link público: só os dados que a tela do
 * cliente precisa mostrar. Omite chaves de arquivo, texto extraído de anexos,
 * e-mail do autor, ids internos etc. `report` precisa incluir client/attachments.
 */
function publicReportPayload(report, view) {
  return {
    client: { nome: report.client.nome },
    mesReferencia: report.mesReferencia,
    versao: view.versao,
    status: report.status,
    kpis: view.kpis,
    kpisAnterior: view.kpisAnterior,
    panorama: view.panorama,
    movimentacoes: report.movimentacoes ?? [],
    narrativas: report.narrativas ?? [],
    attachmentsCount: report.attachments.length,
    hasPdf: !!report.pdfKey,
    finalizedAt: report.finalizedAt,
  };
}

/** True se o report tem link ativo (token presente e não expirado). */
function shareTokenValido(report) {
  return !!report?.shareTokenExpiresAt && report.shareTokenExpiresAt > new Date();
}

/**
 * URL base pública para montar links (ex.: /r/:token) em e-mails. Ordem de
 * preferência: PUBLIC_APP_URL (env), a origem enviada pelo frontend, e por fim
 * a origem da requisição. Roda no Vercel sem configurar nada.
 */
function publicBaseUrl(req, override) {
  const valid = (u) => typeof u === "string" && /^https?:\/\/[^\s/]+/.test(u);
  if (valid(process.env.PUBLIC_APP_URL)) return process.env.PUBLIC_APP_URL.replace(/\/$/, "");
  if (valid(override)) return override.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`.replace(/\/$/, "");
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function emailAssunto(report) {
  return `Relatório executivo — ${report.client.nome} — ${report.mesReferencia}`;
}

function emailTexto(report, shareUrl) {
  return [
    "Prezado(a),",
    "",
    `Segue o relatório executivo de ${report.client.nome} referente a ${report.mesReferencia}.`,
    "",
    "Acesse pelo link abaixo (abre no navegador, em qualquer dispositivo, sem necessidade de login):",
    shareUrl,
    "",
    "Atenciosamente,",
    "Abrahão Advogados",
  ].join("\n");
}

function emailHtml(report, shareUrl, comPdf) {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1C2430;font-size:14px;line-height:1.55">
    <p>Prezado(a),</p>
    <p>Segue o <strong>relatório executivo de ${escapeHtml(report.client.nome)}</strong> referente a <strong>${escapeHtml(report.mesReferencia)}</strong>.</p>
    <p><a href="${escapeHtml(shareUrl)}" style="display:inline-block;background:#142B4B;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:bold">Abrir relatório</a></p>
    <p style="color:#7A8394;font-size:12px">Ou copie e cole no navegador:<br/>${escapeHtml(shareUrl)}<br/>O link abre em qualquer dispositivo, sem necessidade de login.${comPdf ? " O PDF do relatório segue em anexo." : ""}</p>
    <p style="margin-top:22px">Atenciosamente,<br/><strong>Abrahão Advogados</strong></p>
  </div>`;
}

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

app.get("/api/clients", requireAuth, async (req, res) => {
  const clients = await prisma.client.findMany({
    orderBy: { nome: "asc" },
    include: {
      _count: { select: { reports: true } },
      reports: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { mesReferencia: true, status: true, createdAt: true, finalizedAt: true },
      },
    },
  });

  res.json(
    clients.map((c) => ({
      id: c.id,
      nome: c.nome,
      createdAt: c.createdAt,
      totalVersoes: c._count.reports,
      ultimaVersao: c.reports[0]
        ? {
            mes: c.reports[0].mesReferencia,
            status: c.reports[0].status,
            em: c.reports[0].finalizedAt ?? c.reports[0].createdAt,
          }
        : null,
    }))
  );
});

app.post("/api/clients", requireAuth, async (req, res) => {
  const parsed = clientSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
  const client = await prisma.client.create({ data: { nome: parsed.data.nome } });
  res.status(201).json(client);
});

// Atualiza o cliente — hoje usado para salvar/limpar o mapeamento manual de
// colunas (columnMapping) e, opcionalmente, renomear.
app.patch("/api/clients/:id", requireAuth, async (req, res) => {
  const parsed = patchClientSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });
  const data = {};
  if (parsed.data.nome !== undefined) data.nome = parsed.data.nome;
  if (parsed.data.columnMapping !== undefined) {
    // null limpa o mapeamento; objeto é normalizado antes de guardar.
    data.columnMapping = parsed.data.columnMapping === null ? Prisma.DbNull : normalizeMapping(parsed.data.columnMapping);
  }
  try {
    const client = await prisma.client.update({ where: { id: req.params.id }, data });
    res.json(client);
  } catch {
    res.status(404).json({ error: "Cliente não encontrado" });
  }
});

// ---------------------------------------------------------------------------
// Dashboard — ciclo do mês corrente: status do relatório de cada cliente
// ---------------------------------------------------------------------------

app.get("/api/dashboard", requireAuth, async (req, res) => {
  const periodo = periodoAtual();

  // Para cada cliente, o relatório do período corrente (se houver).
  const clients = await prisma.client.findMany({
    orderBy: { nome: "asc" },
    include: {
      reports: {
        where: { periodo },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true, finalizedAt: true },
      },
    },
  });

  const clientes = clients.map((c) => {
    const r = c.reports[0];
    return {
      id: c.id,
      nome: c.nome,
      status: r?.status ?? "sem_relatorio",
      reportId: r?.id ?? null,
      atualizadoEm: r?.finalizedAt ?? r?.createdAt ?? null,
    };
  });

  const emAndamento = ["rascunho", "analisando", "erro"];
  const resumo = {
    total: clientes.length,
    prontos: clientes.filter((c) => c.status === "pronto").length,
    emAndamento: clientes.filter((c) => emAndamento.includes(c.status)).length,
    semRelatorio: clientes.filter((c) => c.status === "sem_relatorio").length,
  };

  res.json({ periodo, mesReferencia: periodoParaRotulo(periodo), resumo, clientes });
});

// ---------------------------------------------------------------------------
// Página do cliente — versões do relatório + movimentações ao longo do tempo
// ---------------------------------------------------------------------------

app.get("/api/clients/:id", requireAuth, async (req, res) => {
  const client = await prisma.client.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

  // Ordem crescente para numerar as versões (v1 = primeiro relatório do cliente).
  const reports = await prisma.report.findMany({
    where: { clientId: client.id },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { attachments: true } },
      emailSends: { orderBy: { sentAt: "desc" } },
    },
  });

  const versoes = reports.map((r, i) => {
    const resumo = resumirMovimentacoes([r]);
    return {
      id: r.id,
      versao: i + 1,
      mesReferencia: r.mesReferencia,
      status: r.status,
      createdAt: r.createdAt,
      finalizedAt: r.finalizedAt,
      autor: r.createdByName || r.createdByEmail || "-",
      docxDisponivel: !!r.docxKey,
      pdfDisponivel: !!r.pdfKey,
      totalAnexos: r._count.attachments,
      totalMovimentacoes: resumo.total,
      porTipo: resumo.porTipo,
      valorMovimentado: resumo.valor,
      envios: r.emailSends.map((e) => ({ sentTo: e.sentTo, sentAt: e.sentAt, status: e.status })),
    };
  });

  // KPIs atuais = do período mais recente do cliente (não o último upload por
  // data — assim um mês antigo enviado por backfill não vira "situação atual").
  // Registros legados sem período caem no comportamento por data de upload.
  const ultimoUpload =
    (await prisma.upload.findFirst({
      where: { clientId: client.id, periodo: { not: null } },
      orderBy: { periodo: "desc" },
      include: { processos: true },
    })) ??
    (await prisma.upload.findFirst({
      where: { clientId: client.id },
      orderBy: { uploadedAt: "desc" },
      include: { processos: true },
    }));
  const kpisAtuais = ultimoUpload ? computeKpis(ultimoUpload.processos) : null;

  const contacts = await prisma.contact.findMany({
    where: { clientId: client.id },
    orderBy: [{ principal: "desc" }, { nome: "asc" }],
  });

  // Série histórica por período (para o gráfico de evolução): valor envolvido,
  // provisão e nº de processos, um ponto por mês, do mais antigo ao mais recente.
  const uploadsSerie = await prisma.upload.findMany({
    where: { clientId: client.id, periodo: { not: null } },
    orderBy: { periodo: "asc" },
    include: { processos: true },
  });
  const evolucao = uploadsSerie.map((u) => {
    const k = computeKpis(u.processos);
    return {
      periodo: u.periodo,
      mesReferencia: periodoParaRotulo(u.periodo),
      processos: k.processos,
      valorEnvolvido: k.valorEnvolvidoNum,
      provisao: k.provisaoNum,
    };
  });

  res.json({
    client: { id: client.id, nome: client.nome, createdAt: client.createdAt },
    kpisAtuais,
    contacts,
    evolucao,
    versoes: [...versoes].reverse(), // mais recente primeiro para exibição
  });
});

// ---------------------------------------------------------------------------
// Contatos do cliente (destinatários dos relatórios — pré-requisito do envio)
// ---------------------------------------------------------------------------

app.post("/api/clients/:id/contacts", requireAuth, async (req, res) => {
  const parsed = contactSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });

  const client = await prisma.client.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!client) return res.status(404).json({ error: "Cliente não encontrado" });

  const contact = await prisma.$transaction(async (tx) => {
    // Só um principal por cliente: marcar este desmarca os demais.
    if (parsed.data.principal) {
      await tx.contact.updateMany({ where: { clientId: client.id }, data: { principal: false } });
    }
    return tx.contact.create({
      data: {
        clientId: client.id,
        nome: parsed.data.nome,
        email: parsed.data.email,
        principal: parsed.data.principal ?? false,
      },
    });
  });
  res.status(201).json(contact);
});

app.patch("/api/clients/:id/contacts/:contactId", requireAuth, async (req, res) => {
  const parsed = patchContactSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Payload inválido" });

  const existing = await prisma.contact.findUnique({ where: { id: req.params.contactId } });
  if (!existing || existing.clientId !== req.params.id) {
    return res.status(404).json({ error: "Contato não encontrado neste cliente" });
  }

  const contact = await prisma.$transaction(async (tx) => {
    if (parsed.data.principal) {
      await tx.contact.updateMany({ where: { clientId: existing.clientId }, data: { principal: false } });
    }
    return tx.contact.update({ where: { id: existing.id }, data: parsed.data });
  });
  res.json(contact);
});

app.delete("/api/clients/:id/contacts/:contactId", requireAuth, async (req, res) => {
  const existing = await prisma.contact.findUnique({ where: { id: req.params.contactId } });
  if (!existing || existing.clientId !== req.params.id) {
    return res.status(404).json({ error: "Contato não encontrado neste cliente" });
  }
  await prisma.contact.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Relatórios — histórico
// ---------------------------------------------------------------------------

app.get("/api/reports", requireAuth, async (req, res) => {
  // Ordem crescente para numerar as versões por cliente antes de exibir desc.
  const reports = await prisma.report.findMany({
    include: { client: true },
    orderBy: { createdAt: "asc" },
  });

  const versaoPorId = {};
  const contador = {};
  for (const r of reports) {
    contador[r.clientId] = (contador[r.clientId] ?? 0) + 1;
    versaoPorId[r.id] = contador[r.clientId];
  }

  res.json(
    [...reports].reverse().map((r) => ({
      id: r.id,
      clienteId: r.clientId,
      cliente: r.client.nome,
      periodo: r.periodo,
      mes: r.mesReferencia,
      versao: versaoPorId[r.id],
      geradoEm: r.finalizedAt ?? r.createdAt,
      status: r.status,
      autor: r.createdByName || r.createdByEmail || "-",
      docx: !!r.docxKey,
      pdf: !!r.pdfKey,
    }))
  );
});

app.get("/api/reports/:id", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { client: true, attachments: true, upload: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  const { versao, kpis, kpisAnterior, panorama } = await buildReportView(report);
  res.json({ ...report, versao, kpis, kpisAnterior, panorama, shareAtivo: shareTokenValido(report) });
});

// ---------------------------------------------------------------------------
// Link seguro de visualização (link público por token)
// ---------------------------------------------------------------------------

// Gera/renova o token público do relatório com validade configurável (padrão
// 30 dias). Autenticado — uso interno do escritório. Só para relatório pronto.
app.post("/api/reports/:id/share-link", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, select: { id: true, status: true } });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });
  if (report.status !== "pronto") {
    return res.status(400).json({ error: "Finalize o relatório antes de gerar o link para o cliente." });
  }

  const diasReq = Number(req.body?.dias);
  const dias = Number.isFinite(diasReq) && diasReq > 0 ? Math.min(Math.round(diasReq), 365) : 30;
  const token = randomBytes(24).toString("base64url"); // opaco, ~32 chars, URL-safe
  const expiresAt = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

  await prisma.report.update({ where: { id: report.id }, data: { shareToken: token, shareTokenExpiresAt: expiresAt } });
  // O frontend monta a URL absoluta com a própria origem (window.location.origin).
  res.json({ token, path: `/r/${token}`, expiresAt, dias });
});

// Revoga o link público (opcional — o token deixa de valer).
app.delete("/api/reports/:id/share-link", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });
  await prisma.report.update({ where: { id: report.id }, data: { shareToken: null, shareTokenExpiresAt: null } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Rotas públicas (SEM requireAuth) — só acessíveis com um token válido
// ---------------------------------------------------------------------------

app.get("/api/public/reports/:token", async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { shareToken: req.params.token },
    include: { client: true, attachments: true, upload: true },
  });
  // Token inválido OU expirado -> 404 genérico (não revela se o token existe).
  if (!shareTokenValido(report)) return res.status(404).json({ error: "Relatório não encontrado" });

  const view = await buildReportView(report);
  res.json(publicReportPayload(report, view));
});

app.get("/api/public/reports/:token/pdf", async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { shareToken: req.params.token },
    include: { client: true },
  });
  if (!shareTokenValido(report) || !report.pdfKey) return res.status(404).json({ error: "Relatório não encontrado" });
  const fileName = reportFileName(report.client.nome, report.mesReferencia, "pdf");
  const url = await getSignedUrl(report.pdfKey, undefined, fileName);
  res.json({ url });
});

// ---------------------------------------------------------------------------
// Envio do relatório por e-mail ao contato do cliente (+ registro)
// ---------------------------------------------------------------------------

app.post("/api/reports/:id/send-email", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });
  if (report.status !== "pronto") return res.status(400).json({ error: "Finalize o relatório antes de enviar ao cliente." });

  // Destinatários: por contactIds (contatos do cliente) ou e-mails avulsos.
  const { contactIds, to, baseUrl } = req.body ?? {};
  let destinatarios = [];
  if (Array.isArray(contactIds) && contactIds.length) {
    const contatos = await prisma.contact.findMany({ where: { id: { in: contactIds }, clientId: report.clientId } });
    destinatarios = contatos.map((c) => ({ nome: c.nome, email: c.email }));
  } else if (Array.isArray(to) && to.length) {
    destinatarios = to.filter((e) => typeof e === "string" && /.+@.+\..+/.test(e)).map((email) => ({ email }));
  }
  if (!destinatarios.length) return res.status(400).json({ error: "Selecione ao menos um contato/destinatário válido." });

  // Garante um link seguro ativo (renova por 30 dias se não houver um válido).
  let shareToken = report.shareToken;
  if (!shareTokenValido(report)) {
    shareToken = randomBytes(24).toString("base64url");
    await prisma.report.update({
      where: { id: report.id },
      data: { shareToken, shareTokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
  }
  const shareUrl = `${publicBaseUrl(req, baseUrl)}/r/${shareToken}`;
  const assunto = emailAssunto(report);
  const texto = emailTexto(report, shareUrl);
  const emails = destinatarios.map((d) => d.email);

  // Sem provedor configurado: registra como envio "manual" e devolve um mailto
  // para o advogado enviar pelo próprio cliente de e-mail (com o link seguro).
  if (!emailProvider()) {
    await prisma.emailSend.createMany({ data: emails.map((e) => ({ reportId: report.id, sentTo: e, status: "manual" })) });
    const mailto = `mailto:${encodeURIComponent(emails.join(","))}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
    return res.json({ configured: false, mailto, to: emails, subject: assunto, shareUrl });
  }

  // Provedor configurado: envia pelo servidor com o PDF anexado.
  let attachments = [];
  if (report.pdfKey) {
    const pdf = await downloadFile(report.pdfKey);
    attachments = [{ filename: reportFileName(report.client.nome, report.mesReferencia, "pdf"), content: pdf }];
  }
  const html = emailHtml(report, shareUrl, attachments.length > 0);
  const results = [];
  for (const d of destinatarios) {
    try {
      await sendEmail({ to: d.email, subject: assunto, html, text: texto, attachments });
      await prisma.emailSend.create({ data: { reportId: report.id, sentTo: d.email, status: "enviado" } });
      results.push({ email: d.email, status: "enviado" });
    } catch (err) {
      const errorMessage = String(err?.message ?? err).slice(0, 500);
      await prisma.emailSend.create({ data: { reportId: report.id, sentTo: d.email, status: "erro", errorMessage } });
      results.push({ email: d.email, status: "erro", error: errorMessage });
    }
  }
  const houveErro = results.some((r) => r.status === "erro");
  res.status(houveErro ? 207 : 200).json({ configured: true, results, shareUrl });
});

// ---------------------------------------------------------------------------
// Upload de planilha -> cria Upload + Processos + Report (rascunho) com diff
// ---------------------------------------------------------------------------

app.post("/api/reports/upload", requireAuth, upload.single("file"), async (req, res) => {
  const { clientId, periodo } = req.body ?? {};
  if (!clientId || !periodo) return res.status(400).json({ error: "clientId e periodo são obrigatórios" });
  if (!isPeriodoValido(periodo)) return res.status(400).json({ error: 'periodo deve estar no formato "YYYY-MM".' });
  if (!req.file) return res.status(400).json({ error: "Arquivo da planilha é obrigatório" });

  // mesReferencia é só rótulo — deriva do período se o cliente não mandou um.
  const mesReferencia = req.body.mesReferencia?.trim() || periodoParaRotulo(periodo);

  const duplicado = await prisma.upload.findUnique({
    where: { clientId_periodo: { clientId, periodo } },
  });
  if (duplicado) {
    // Devolve o relatório existente para a UI oferecer "substituir" ou "abrir".
    const reportExistente = await prisma.report.findFirst({
      where: { uploadId: duplicado.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    return res.status(409).json({
      error: `Já existe uma planilha enviada para este cliente em ${mesReferencia}.`,
      periodo,
      reportId: reportExistente?.id ?? null,
    });
  }

  // Mapeamento de colunas: o salvo no cliente é reaplicado automaticamente e o
  // que veio na requisição (mapeamento manual desta vez) tem prioridade.
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  const mappingRequest = parseMappingBody(req.body.mapping);
  const mappingFinal = normalizeMapping({ ...(client?.columnMapping ?? {}), ...mappingRequest });

  let processosAtuais;
  let leitura;
  try {
    ({ processos: processosAtuais, leitura } = await parseSpreadsheet(req.file.buffer, { mapping: mappingFinal }));
  } catch (err) {
    // Devolve as colunas lidas (err.leitura) para a UI oferecer o mapeador manual.
    return res.status(400).json({ error: err.message, leitura: err.leitura ?? null });
  }

  const { key: fileKey } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

  const uploadAnterior = await findUploadAnterior(clientId, periodo, new Date());

  const uploadAtual = await prisma.upload.create({
    data: {
      clientId,
      periodo,
      mesReferencia,
      fileName: req.file.originalname,
      fileKey,
      uploadedByEmail: req.userEmail,
      uploadedByName: req.userName,
      processos: { create: processosAtuais },
    },
    include: { processos: true },
  });

  const movimentacoes = computeDiff(processosAtuais, uploadAnterior?.processos ?? []);
  const kpis = computeKpis(processosAtuais);

  const report = await prisma.report.create({
    data: {
      clientId,
      uploadId: uploadAtual.id,
      periodo,
      mesReferencia,
      status: "rascunho",
      movimentacoes,
      createdByEmail: req.userEmail,
      createdByName: req.userName,
    },
  });

  // Mapeou colunas manualmente? Guarda no cliente para os próximos meses já
  // virem certos sem o usuário precisar mapear de novo.
  if (Object.keys(mappingRequest).length > 0) {
    await prisma.client.update({ where: { id: clientId }, data: { columnMapping: mappingFinal } });
  }

  // Número da versão deste relatório na linha do tempo do cliente.
  const versao = await prisma.report.count({ where: { clientId } });

  res.status(201).json({ reportId: report.id, versao, kpis, movimentacoes, leitura });
});

// ---------------------------------------------------------------------------
// Substituir a planilha de um período já enviado (upload errado)
// -> re-parseia, refaz o diff contra o período anterior e volta o report a
//    rascunho (as narrativas/.docx antigos não valem mais).
// ---------------------------------------------------------------------------

app.put("/api/reports/:id/spreadsheet", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Arquivo da planilha é obrigatório" });

  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { upload: true, client: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  const mappingRequest = parseMappingBody(req.body.mapping);
  const mappingFinal = normalizeMapping({ ...(report.client.columnMapping ?? {}), ...mappingRequest });

  let processosNovos;
  let leitura;
  try {
    ({ processos: processosNovos, leitura } = await parseSpreadsheet(req.file.buffer, { mapping: mappingFinal }));
  } catch (err) {
    return res.status(400).json({ error: err.message, leitura: err.leitura ?? null });
  }

  const { key: novoFileKey } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

  const uploadAnterior = await findUploadAnterior(report.clientId, report.upload.periodo, report.upload.uploadedAt);
  const movimentacoes = computeDiff(processosNovos, uploadAnterior?.processos ?? []);
  const kpis = computeKpis(processosNovos);

  // Chaves antigas a limpar do Storage depois de trocar os registros.
  const chavesAntigas = [report.upload.fileKey, report.docxKey].filter(Boolean);

  await prisma.upload.update({
    where: { id: report.uploadId },
    data: {
      fileName: req.file.originalname,
      fileKey: novoFileKey,
      // Troca por completo a carteira daquele mês.
      processos: { deleteMany: {}, create: processosNovos },
    },
  });

  await prisma.report.update({
    where: { id: report.id },
    data: {
      movimentacoes,
      status: "rascunho",
      narrativas: Prisma.DbNull,
      docxKey: null,
      finalizedAt: null,
    },
  });

  if (Object.keys(mappingRequest).length > 0) {
    await prisma.client.update({ where: { id: report.clientId }, data: { columnMapping: mappingFinal } });
  }

  await removeFiles(chavesAntigas);
  res.json({ reportId: report.id, kpis, movimentacoes, leitura });
});

// ---------------------------------------------------------------------------
// Excluir um relatório em rascunho (upload errado que se quer descartar)
// -> apaga o Report (cascata nos Attachments) e, se for o único report daquele
//    Upload, apaga o Upload e seus Processos. Arquivos correspondentes saem do
//    Storage. Relatórios finalizados ("pronto") não podem ser excluídos.
// ---------------------------------------------------------------------------

app.delete("/api/reports/:id", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { attachments: true, upload: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });
  if (report.status === "pronto") {
    return res.status(400).json({ error: "Não é possível excluir um relatório finalizado. Substitua a planilha do período se precisar refazê-lo." });
  }

  const reportsDoUpload = await prisma.report.count({ where: { uploadId: report.uploadId } });
  const soReportDoUpload = reportsDoUpload === 1;

  const chaves = [
    ...report.attachments.map((a) => a.fileKey),
    report.docxKey,
    soReportDoUpload ? report.upload.fileKey : null,
  ];

  // Report primeiro (cascata nos Attachments); só então o Upload pode sair
  // (a FK Report->Upload é RESTRICT).
  await prisma.report.delete({ where: { id: report.id } });
  if (soReportDoUpload) {
    await prisma.upload.delete({ where: { id: report.uploadId } });
  }

  await removeFiles(chaves);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Anexos por movimentação
// ---------------------------------------------------------------------------

app.post("/api/reports/:id/attachments", requireAuth, upload.single("file"), async (req, res) => {
  const { processoNumero } = req.body ?? {};
  if (!processoNumero) return res.status(400).json({ error: "processoNumero é obrigatório" });
  if (!req.file) return res.status(400).json({ error: "Arquivo é obrigatório" });

  const ext = path.extname(req.file.originalname || "").toLowerCase();
  if (!EXTENSOES_ANEXO_PERMITIDAS.has(ext)) {
    return res.status(400).json({ error: MENSAGEM_ANEXO_INVALIDO });
  }

  const { key: fileKey } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const extractedText = req.file.mimetype === "application/pdf" ? await extractPdfText(req.file.buffer) : null;

  const attachment = await prisma.attachment.create({
    data: {
      reportId: req.params.id,
      processoNumero,
      fileName: req.file.originalname,
      fileKey,
      extractedText,
    },
  });

  res.status(201).json(attachment);
});

app.delete("/api/reports/:id/attachments/:attachmentId", requireAuth, async (req, res) => {
  // Confere que o anexo pertence mesmo ao report da URL antes de apagar.
  const attachment = await prisma.attachment.findUnique({ where: { id: req.params.attachmentId } });
  if (!attachment || attachment.reportId !== req.params.id) {
    return res.status(404).json({ error: "Anexo não encontrado neste relatório" });
  }
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await removeFiles([attachment.fileKey]);
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Análise de IA
// ---------------------------------------------------------------------------

/**
 * Roda a análise de IA e grava o resultado no report. Feita fora do request
 * (via runInBackground) porque a chamada ao Claude (Opus, effort alto) pode
 * demorar. Marca o status conforme o resultado: "rascunho" (concluída) ou
 * "erro" (falhou) — o frontend acompanha por polling em GET /api/reports/:id.
 */
async function analisarReportEmBackground(reportId) {
  try {
    const report = await prisma.report.findUnique({
      where: { id: reportId },
      include: { client: true, attachments: true },
    });
    if (!report) return;

    const documentosTexto = report.attachments
      .filter((a) => a.extractedText)
      .map((a) => ({ processoNumero: a.processoNumero, fileName: a.fileName, texto: a.extractedText.slice(0, 6000) }));

    const kpis = computeKpis(await prisma.processo.findMany({ where: { uploadId: report.uploadId } }));

    const narrativas = await gerarAnaliseIA({
      cliente: report.client.nome,
      mesReferencia: report.mesReferencia,
      kpis,
      movimentacoes: report.movimentacoes,
      documentosTexto,
    });

    await prisma.report.update({ where: { id: reportId }, data: { narrativas, status: "rascunho" } });
  } catch (err) {
    console.error("Falha na análise de IA:", err);
    await prisma.report.update({ where: { id: reportId }, data: { status: "erro" } }).catch(() => {});
  }
}

app.post("/api/reports/:id/analyze", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  // Marca "analisando" e limpa a análise anterior antes de responder, para o
  // polling do frontend saber que uma nova análise está em andamento.
  await prisma.report.update({ where: { id: report.id }, data: { status: "analisando", narrativas: Prisma.DbNull } });

  // Dispara a análise fora do request e responde na hora (o frontend faz polling).
  runInBackground(analisarReportEmBackground(report.id));
  res.status(202).json({ status: "analisando" });
});

app.patch("/api/reports/:id", requireAuth, async (req, res) => {
  const parsed = patchReportSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "Payload inválido", detalhes: parsed.error.issues });
  const { narrativas, selecionados } = parsed.data;
  const report = await prisma.report.update({
    where: { id: req.params.id },
    data: {
      ...(narrativas ? { narrativas } : {}),
      ...(selecionados ? { selecionados } : {}),
    },
  });
  res.json(report);
});

// ---------------------------------------------------------------------------
// Finalização — gera .docx
// ---------------------------------------------------------------------------

app.post("/api/reports/:id/finalize", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { client: true, attachments: true, upload: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  const versao = await prisma.report.count({
    where: { clientId: report.clientId, createdAt: { lte: report.createdAt } },
  });

  const { kpis, kpisAnterior, panorama } = await computeReportInsights(report);

  // Mesmos dados alimentam os dois formatos (.docx e PDF) — mesmo visual.
  const dadosRelatorio = {
    cliente: report.client.nome,
    mesReferencia: report.mesReferencia,
    versao,
    kpis,
    kpisAnterior,
    narrativas: report.narrativas ?? [],
    movimentacoes: report.movimentacoes ?? [],
    panorama,
    totalAnexos: report.attachments.length,
  };

  const [docxBuffer, pdfBuffer] = await Promise.all([generateReportDocx(dadosRelatorio), generateReportPdf(dadosRelatorio)]);

  const [{ key: docxKey }, { key: pdfKey }] = await Promise.all([
    uploadFile(docxBuffer, reportFileName(report.client.nome, report.mesReferencia, "docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    uploadFile(pdfBuffer, reportFileName(report.client.nome, report.mesReferencia, "pdf"), "application/pdf"),
  ]);

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { status: "pronto", docxKey, pdfKey, finalizedAt: new Date() },
  });

  res.json(updated);
});

app.get("/api/reports/:id/download", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!report?.docxKey) return res.status(404).json({ error: "Relatório ainda não foi finalizado" });
  const fileName = reportFileName(report.client.nome, report.mesReferencia, "docx");
  const url = await getSignedUrl(report.docxKey, undefined, fileName);
  res.json({ url });
});

app.get("/api/reports/:id/download-pdf", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { client: true } });
  if (!report?.pdfKey) return res.status(404).json({ error: "PDF ainda não foi gerado para este relatório" });
  const fileName = reportFileName(report.client.nome, report.mesReferencia, "pdf");
  const url = await getSignedUrl(report.pdfKey, undefined, fileName);
  res.json({ url });
});

// ---------------------------------------------------------------------------
// Tratamento de erros — sempre responde JSON (facilita o diagnóstico nos testes)
// ---------------------------------------------------------------------------

// eslint-disable-next-line no-unused-vars
app.use(async (err, req, res, next) => {
  console.error("Erro não tratado:", err);
  await captureException(err);
  if (res.headersSent) return next(err);
  const isMulter = err?.name === "MulterError";
  const status = isMulter ? 400 : 500;
  const message = isMulter
    ? err.code === "LIMIT_FILE_SIZE"
      ? "Arquivo excede o limite de 25 MB."
      : `Erro no upload do arquivo: ${err.message}`
    : err?.message || "Erro interno do servidor.";
  res.status(status).json({ error: message });
});
