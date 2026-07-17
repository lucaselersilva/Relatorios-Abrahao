-- Mapeamento manual de colunas por cliente: guarda, em JSON, qual coluna da
-- planilha corresponde a cada campo do sistema quando o nome foge do padrão
-- (ex.: {"valor": "valor da demanda"}). É reaplicado automaticamente nos
-- próximos uploads daquele cliente, então cada planilha "estranha" só precisa
-- ser mapeada uma vez.

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "columnMapping" JSONB;
