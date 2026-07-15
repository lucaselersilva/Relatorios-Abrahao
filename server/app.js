import express from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../lib/db.js";
import { hashPassword, comparePassword, signSession, cookieOptions, requireAuth, COOKIE_NAME } from "../lib/auth.js";
import { uploadFile, localUploadsDir } from "../lib/storage.js";
import { parseSpreadsheet } from "../lib/xlsx-parser.js";
import { computeDiff, computeKpis } from "../lib/diff.js";
import { gerarAnaliseIA } from "../lib/ai.js";
import { generateReportDocx } from "../lib/docx-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(localUploadsDir()));

async function extractPdfText(buffer) {
  try {
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);
    return result.text?.trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const token = signSession(user);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ id: user.id, email: user.email, name: user.name });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
  res.json({ ok: true });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Não autenticado" });
  res.json({ id: user.id, email: user.email, name: user.name });
});

// ---------------------------------------------------------------------------
// Clientes
// ---------------------------------------------------------------------------

app.get("/api/clients", requireAuth, async (req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { nome: "asc" } });
  res.json(clients);
});

app.post("/api/clients", requireAuth, async (req, res) => {
  const { nome } = req.body ?? {};
  if (!nome?.trim()) return res.status(400).json({ error: "Nome do cliente é obrigatório" });
  const client = await prisma.client.create({ data: { nome: nome.trim() } });
  res.status(201).json(client);
});

// ---------------------------------------------------------------------------
// Relatórios — histórico
// ---------------------------------------------------------------------------

app.get("/api/reports", requireAuth, async (req, res) => {
  const reports = await prisma.report.findMany({
    include: { client: true, createdBy: true },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    reports.map((r) => ({
      id: r.id,
      cliente: r.client.nome,
      mes: r.mesReferencia,
      geradoEm: r.finalizedAt ?? r.createdAt,
      status: r.status,
      autor: r.createdBy?.name || r.createdBy?.email || "-",
    }))
  );
});

app.get("/api/reports/:id", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({
    where: { id: req.params.id },
    include: { client: true, attachments: true },
  });
  if (!report) return res.status(404).json({ error: "Relatório não encontrado" });

  const processos = await prisma.processo.findMany({ where: { uploadId: report.uploadId } });
  res.json({ ...report, kpis: computeKpis(processos) });
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

  const { url: fileUrl } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

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
      fileUrl,
      uploadedById: req.userId,
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
      createdById: req.userId,
    },
  });

  res.status(201).json({ reportId: report.id, kpis, movimentacoes });
});

// ---------------------------------------------------------------------------
// Anexos por movimentação
// ---------------------------------------------------------------------------

app.post("/api/reports/:id/attachments", requireAuth, upload.single("file"), async (req, res) => {
  const { processoNumero } = req.body ?? {};
  if (!processoNumero) return res.status(400).json({ error: "processoNumero é obrigatório" });
  if (!req.file) return res.status(400).json({ error: "Arquivo é obrigatório" });

  const { url: fileUrl } = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const extractedText = req.file.mimetype === "application/pdf" ? await extractPdfText(req.file.buffer) : null;

  const attachment = await prisma.attachment.create({
    data: {
      reportId: req.params.id,
      processoNumero,
      fileName: req.file.originalname,
      fileUrl,
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

  const buffer = await generateReportDocx({
    cliente: report.client.nome,
    mesReferencia: report.mesReferencia,
    kpis,
    narrativas: report.narrativas ?? [],
    movimentacoes: report.movimentacoes ?? [],
    totalAnexos: report.attachments.length,
  });

  const fileName = `Relatorio_${report.client.nome.replace(/\s+/g, "_")}_${report.mesReferencia.replace(/\//g, "-")}.docx`;
  const { url: docxUrl } = await uploadFile(buffer, fileName, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: { status: "pronto", docxUrl, finalizedAt: new Date() },
  });

  res.json(updated);
});

app.get("/api/reports/:id/download", requireAuth, async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report?.docxUrl) return res.status(404).json({ error: "Relatório ainda não foi finalizado" });
  res.redirect(report.docxUrl);
});
