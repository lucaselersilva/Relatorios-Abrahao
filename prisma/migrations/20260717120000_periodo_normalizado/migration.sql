-- Período como dado de verdade: novo campo "periodo" ("YYYY-MM") em Upload e
-- Report. mesReferencia continua existindo apenas como rótulo de exibição.

-- AlterTable
ALTER TABLE "Upload" ADD COLUMN "periodo" TEXT;
ALTER TABLE "Report" ADD COLUMN "periodo" TEXT;

-- Função temporária de parse: converte o mesReferencia livre em "YYYY-MM".
-- Cobre "2026-06", "06/2026", "6-2026", "2026/06" e "Junho/2026"/"junho 2026".
-- Formatos irreconhecíveis viram NULL — não quebram a migração.
CREATE FUNCTION pg_temp._parse_periodo(m text) RETURNS text AS $$
DECLARE
  s text;
  ano text;
  mes text;
  nome text;
  meses text[] := ARRAY['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  i int;
BEGIN
  IF m IS NULL THEN RETURN NULL; END IF;
  s := lower(btrim(m));
  IF s = '' THEN RETURN NULL; END IF;
  s := translate(s, 'ãáàâäçéèêëíìîïóòôöõúùûü', 'aaaaaceeeeiiiiooooouuuu');

  -- Já em "YYYY-MM"
  IF s ~ '^[0-9]{4}-[0-9]{2}$' THEN
    RETURN s;
  END IF;
  -- "MM/YYYY", "M-YYYY", "MM.YYYY", "MM YYYY"
  IF s ~ '^[0-9]{1,2}[/. -][0-9]{4}$' THEN
    mes := lpad((regexp_match(s, '^([0-9]{1,2})'))[1], 2, '0');
    ano := (regexp_match(s, '([0-9]{4})$'))[1];
    RETURN ano || '-' || mes;
  END IF;
  -- "YYYY/MM"
  IF s ~ '^[0-9]{4}[/. -][0-9]{1,2}$' THEN
    ano := (regexp_match(s, '^([0-9]{4})'))[1];
    mes := lpad((regexp_match(s, '([0-9]{1,2})$'))[1], 2, '0');
    RETURN ano || '-' || mes;
  END IF;
  -- "Junho/2026", "junho 2026", "Junho de 2026"
  nome := (regexp_match(s, '([a-z]+)'))[1];
  ano := (regexp_match(s, '([0-9]{4})'))[1];
  IF nome IS NOT NULL AND ano IS NOT NULL THEN
    FOR i IN 1..12 LOOP
      IF meses[i] = nome THEN
        RETURN ano || '-' || lpad(i::text, 2, '0');
      END IF;
    END LOOP;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

UPDATE "Upload" SET "periodo" = pg_temp._parse_periodo("mesReferencia");
UPDATE "Report" SET "periodo" = pg_temp._parse_periodo("mesReferencia");

-- Se o backfill colapsar formatos inconsistentes no mesmo mês para um cliente
-- (ex.: "Junho/2026" e "06/2026"), mantém o upload mais recente e anula os
-- demais para não violar a nova unicidade.
UPDATE "Upload" u
SET "periodo" = NULL
WHERE u."periodo" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Upload" v
    WHERE v."clientId" = u."clientId"
      AND v."periodo" = u."periodo"
      AND v."uploadedAt" > u."uploadedAt"
  );

-- Troca a unicidade: o mês real (periodo) no lugar do rótulo livre.
DROP INDEX "Upload_clientId_mesReferencia_key";
CREATE UNIQUE INDEX "Upload_clientId_periodo_key" ON "Upload"("clientId", "periodo");
