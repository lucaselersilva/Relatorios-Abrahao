import { randomUUID } from "node:crypto";
import path from "node:path";
import { supabase, STORAGE_BUCKET } from "./supabase.js";

const SIGNED_URL_TTL = 60 * 60; // 1h

/**
 * Salva um arquivo (planilha, anexo, .docx gerado) no bucket privado do
 * Supabase Storage e retorna a key do objeto (não uma URL pública — os
 * documentos são de processos jurídicos de clientes).
 */
export async function uploadFile(buffer, originalName, contentType) {
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
 * previamente salvo com uploadFile.
 */
export async function getSignedUrl(key, expiresIn = SIGNED_URL_TTL) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(key, expiresIn);
  if (error) throw new Error(`Falha ao gerar URL assinada: ${error.message}`);
  return data.signedUrl;
}
