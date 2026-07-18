-- Alertas determinísticos pós-upload (F13): novo processo de alta exposição,
-- queda expressiva de provisão e processo que sumiu da planilha sem status de
-- encerramento. Calculados sem IA e guardados para não recalcular e manter
-- histórico do que foi alertado. Ver lib/alertas.js.

-- AlterTable
ALTER TABLE "Report" ADD COLUMN "alertas" JSONB;
