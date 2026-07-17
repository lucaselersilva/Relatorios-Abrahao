-- Exportação em PDF: guarda a key do PDF gerado na finalização, do mesmo jeito
-- que docxKey guarda a do .docx.

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "pdfKey" TEXT;
