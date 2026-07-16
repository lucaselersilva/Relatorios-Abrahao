import express from "express";
import multer from "multer";

import { prisma } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { uploadFile, getSignedUrl } from "../lib/storage.js";
import { parseSpreadsheet } from "../lib/xlsx-parser.js";
import { computeDiff, computeKpis, formatMoeda } from "../lib/diff.js";
import { gerarAnaliseIA } from "../lib/ai.js";
import { generateReportDocx } from "../lib/docx-generator.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const app = express();
app.use(express.json());

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
  const porTipo = { novo: 0, movimentacao: 0, acordo: 0 };
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
  const { nome } = req.body ?? {};
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do cliente é obrigatório" });
  const client = await prisma.client.create({ data: { nome: nome.trim() } });
  res.status(201).json(client);
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
    include: { _count: { select: { attachments: true } } },
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
      totalAnexos: r._count.attachments,
      totalMovimentacoes: resumo.total,
      porTipo: resumo.porTipo,
      valorMovimentado: resumo.valor,
    };
  });

  // KPIs atuais = do upload mais recente do cliente.
  const ultimoUpload = await prisma.upload.findFirst({
    where: { clientId: client.id },
    orderBy: { uploadedAt: "desc" },
    include: { processos: true },
  });
  const kpisAtuais = ultimoUpload ? computeKpis(ultimoUpload.processos) : null;

  res.json({
    client: { id: client.id, nome: client.nome, createdAt: client.createdAt },
    kpisAtuais,
    versoes: [...versoes].reverse(), // mais recente primeiro para exibição
  });
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
      mes: r.mesReferencia,
      versao: versaoPorId[r.id],
      geradoEm: r.finalizedAt ?? r.createdAt,
      status: r.status,
      autor: r.createdByName || r.createdByEmail || "-",
    }))
  );
});

app.get("/api/reports/:id", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { client: true, attachments: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  // Versão = posição do relatório na sequência do cliente (v1 = o primeiro).
  const versao = await prisma.report.count({
    where: { clientId: report.clientId, createdAt: { lte: report.createdAt } },
  });

  const processos = await prisma.processo.findMany({ where: { uploadId: report.uploadId } });
  res.json({ ...report, versao, kpis: computeKpis(processos) });
});

// ---------------------------------------------------------------------------
// Upload de planilha -> cria Upload + Processos + Report (rascunho) com diff
// ---------------------------------------------------------------------------

app.post("/api/reports/upload", requireAuth, upload.single("file"), async (req, res) => {
  const { clientId, mesReferencia } = req.body ?? {};
  if (!clientId || !mesReferencia) return res.status(400).json({ error: "clientId e mesReferencia são obrigatórios" });
  if (!req.file) return res.status(400).json({ error: "Arquivo da planilha é obrigatório" });

  let processosAtuais;
  try {
    processosAtuais = await parseSpreadsheet(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const { key: fileKey } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

  const uploadAnterior = await prisma.upload.findFirst({
    where: { clientId, mesReferencia: { not: mesReferencia } },
    orderBy: { uploadedAt: "desc" },
    include: { processos: true },
  });

  const uploadAtual = await prisma.upload.create({
    data: {
      clientId,
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
      mesReferencia,
      status: "rascunho",
      movimentacoes,
      createdByEmail: req.userEmail,
      createdByName: req.userName,
    },
  });

  // Número da versão deste relatório na linha do tempo do cliente.
  const versao = await prisma.report.count({ where: { clientId } });

  res.status(201).json({ reportId: report.id, versao, kpis, movimentacoes });
});

// ---------------------------------------------------------------------------
// Anexos por movimentação
// ---------------------------------------------------------------------------

app.post("/api/reports/:id/attachments", requireAuth, upload.single("file"), async (req, res) => {
  const { processoNumero } = req.body ?? {};
  if (!processoNumero) return res.status(400).json({ error: "processoNumero é obrigatório" });
  if (!req.file) return res.status(400).json({ error: "Arquivo é obrigatório" });

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
  await prisma.attachment.delete({ where: { id: req.params.attachmentId } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Análise de IA
// ---------------------------------------------------------------------------

app.post("/api/reports/:id/analyze", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { client: true, attachments: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  const documentosTexto = report.attachments
    .filter((a) => a.extractedText)
    .map((a) => ({ processoNumero: a.processoNumero, fileName: a.fileName, texto: a.extractedText.slice(0, 6000) }));

  const kpis = computeKpis(
    await prisma.processo.findMany({ where: { uploadId: report.uploadId } })
  );

  const narrativas = await gerarAnaliseIA({
    cliente: report.client.nome,
    mesReferencia: report.mesReferencia,
    kpis,
    movimentacoes: report.movimentacoes,
    documentosTexto,
  });

  await prisma.report.update({ where: { id: report.id }, data: { narrativas } });
  res.json({ narrativas });
});

app.patch("/api/reports/:id", requireAuth, async (req, res) => {
  const { narrativas, selecionados } = req.body ?? {};
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
    include: { client: true, attachments: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  const kpis = computeKpis(await prisma.processo.findMany({ where: { uploadId: report.uploadId } }));

  const versao = await prisma.report.count({
    where: { clientId: report.clientId, createdAt: { lte: report.createdAt } },
  });

  const buffer = await generateReportDocx({
    cliente: report.client.nome,
    mesReferencia: report.mesReferencia,
    versao,
    kpis,
    narrativas: report.narrativas ?? [],
    movimentacoes: report.movimentacoes ?? [],
    totalAnexos: report.attachments.length,
  });

  const fileName = `Relatorio_${report.client.nome.replace(/\s+/g, "_")}_${report.mesReferencia.replace(/\//g, "-")}.docx`;
  const { key: docxKey } = await uploadFile(buffer, fileName, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { status: "pronto", docxKey, finalizedAt: new Date() },
  });

  res.json(updated);
});

app.get("/api/reports/:id/download", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report?.docxKey) return res.status(404).json({ error: "Relatório ainda não foi finalizado" });
  const url = await getSignedUrl(report.docxKey);
  res.json({ url });
});
