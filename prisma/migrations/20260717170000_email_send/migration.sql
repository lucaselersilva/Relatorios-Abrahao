-- Registro de envio do relatório por e-mail (auditoria + linha do tempo).
-- status: "enviado" | "erro" | "manual" (preparado via mailto no cliente de
-- e-mail do próprio advogado).

-- CreateTable
CREATE TABLE "EmailSend" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "EmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSend_reportId_idx" ON "EmailSend"("reportId");

-- AddForeignKey
ALTER TABLE "EmailSend" ADD CONSTRAINT "EmailSend_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
