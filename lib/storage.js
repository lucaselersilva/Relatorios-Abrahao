import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

function useBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Salva um arquivo (planilha, anexo, .docx gerado) e retorna a URL pública.
 * Usa Vercel Blob se BLOB_READ_WRITE_TOKEN estiver configurado; caso
 * contrário, salva em disco local (pasta /uploads) — só para desenvolvimento,
 * já que funções serverless na Vercel não têm disco persistente.
 */
export async function uploadFile(buffer, originalName, contentType) {
  const ext = path.extname(originalName || "").slice(0, 20);
  const key = `${randomUUID()}${ext}`;

  if (useBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, buffer, {
      access: "public",
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return { url: blob.url, key };
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, key), buffer);
  return { url: `/uploads/${key}`, key };
}

export function localUploadsDir() {
  return UPLOADS_DIR;
}
