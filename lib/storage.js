import { randomUUID } from "node:crypto";
import path from "node:path";
import { supabase, STORAGE_BUCKET } from "./supabase.js";

const SIGNED_URL_TTL = 60 * 60; // 1h

let bucketReady = false;

/**
 * Garante que o bucket privado existe. Roda uma vez por processo (na primeira
 * escrita) para que o primeiro upload não falhe caso o bucket ainda não tenha
 * sido criado manualmente no painel do Supabase.
 */
async function ensureBucket() {
  if (bucketReady) return;
  const { data } = await supabase.storage.getBucket(STORAGE_BUCKET);
  if (!data) {
    const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: false });
    // Ignora corrida em que o bucket foi criado entre o getBucket e o create.
    if (error && !/already exists|exists/i.test(error.message)) {
      throw new Error(`Falha ao criar o bucket "${STORAGE_BUCKET}" no Storage: ${error.message}`);
    }
  }
  bucketReady = true;
}

/**
 * Salva um arquivo (planilha, anexo, .docx gerado) no bucket privado do
 * Supabase Storage e retorna a key do objeto (não uma URL pública — os
 * documentos são de processos jurídicos de clientes).
 */
export async function uploadFile(buffer, originalName, contentType) {
  await ensureBucket();

  const ext = path.extname(originalName || "").slice(0, 20);
  const key = `${randomUUID()}${ext}`;

  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(key, buffer, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Falha ao enviar arquivo para o Storage: ${error.message}`);

  return { key };
}

/**
 * Gera uma URL assinada de curta duração para baixar/servir um arquivo
 * previamente salvo com uploadFile. Se `downloadName` for informado, o
 * download é acionado com esse nome de arquivo (em vez da key aleatória
 * usada internamente no Storage).
 */
export async function getSignedUrl(key, expiresIn = SIGNED_URL_TTL, downloadName) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(key, expiresIn, downloadName ? { download: downloadName } : undefined);
  if (error) throw new Error(`Falha ao gerar URL assinada: ${error.message}`);
  return data.signedUrl;
}
