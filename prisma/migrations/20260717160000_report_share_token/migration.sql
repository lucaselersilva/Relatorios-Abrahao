-- Link seguro de visualização: token opaco e único + validade. Permite abrir o
-- relatório no navegador sem login enquanto o token for válido e não expirado.

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "shareToken" TEXT;
ALTER TABLE "Report" ADD COLUMN "shareTokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Report_shareToken_key" ON "Report"("shareToken");
