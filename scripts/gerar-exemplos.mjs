/**
 * Gera planilhas de exemplo (dois meses do mesmo cliente) para testar o portal
 * de ponta a ponta e, de quebra, verifica o pipeline offline
 * (parse -> diff -> KPIs -> .docx) sem tocar no banco nem no Storage.
 *
 *   node scripts/gerar-exemplos.mjs
 *
 * As diferenças entre o mês 1 e o mês 2 são propositais para exercitar o diff:
 *  - Processo 1: valor da causa muda        -> movimentação (prioridade alta)
 *  - Processo 2: sem alteração               -> NÃO deve aparecer no diff
 *  - Processo 3: status vira "Acordo homolog"-> acordo
 *  - Processo 4: sem alteração               -> NÃO deve aparecer no diff
 *  - Processo 5: só existe no mês 2           -> processo novo (prioridade alta)
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";

import { parseSpreadsheet } from "../lib/xlsx-parser.js";
import { computeDiff, computeKpis, computePanorama } from "../lib/diff.js";
import { generateReportDocx } from "../lib/docx-generator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "exemplos");

const HEADERS = ["Processo", "Parte adversa", "Área", "Valor da causa", "Valor provisionado", "Status", "Probabilidade"];

const MES_1 = [
  ["0001234-56.2024.5.02.0001", "João da Silva", "Trabalhista", "1.250.000,00", "300.000,00", "Em andamento", "Possível"],
  ["0007777-88.2023.8.26.0100", "Município de São Paulo", "Tributário", "4.800.000,00", "1.200.000,00", "Aguardando julgamento", "Provável"],
  ["0003210-99.2022.8.26.0002", "Maria Souza", "Cível", "85.000,00", "", "Em andamento", "Remota"],
  ["0005555-11.2024.5.02.0033", "Pedro Santos", "Trabalhista", "220.000,00", "50.000,00", "Instrução", "Possível"],
];

const MES_2 = [
  // valor sobe de 1.250.000 -> 1.500.000
  ["0001234-56.2024.5.02.0001", "João da Silva", "Trabalhista", "1.500.000,00", "300.000,00", "Em andamento", "Possível"],
  // sem alteração
  ["0007777-88.2023.8.26.0100", "Município de São Paulo", "Tributário", "4.800.000,00", "1.200.000,00", "Aguardando julgamento", "Provável"],
  // status vira acordo homologado
  ["0003210-99.2022.8.26.0002", "Maria Souza", "Cível", "85.000,00", "", "Acordo homologado", "—"],
  // sem alteração
  ["0005555-11.2024.5.02.0033", "Pedro Santos", "Trabalhista", "220.000,00", "50.000,00", "Instrução", "Possível"],
  // processo novo
  ["0009999-00.2025.8.26.0500", "Banco Beta S/A", "Cível", "2.000.000,00", "500.000,00", "Distribuído", "Provável"],
];

async function montarPlanilha(linhas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Processos");
  ws.addRow(HEADERS);
  ws.getRow(1).font = { bold: true };
  for (const l of linhas) ws.addRow(l);
  ws.columns.forEach((c) => (c.width = 24));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const buf1 = await montarPlanilha(MES_1);
  const buf2 = await montarPlanilha(MES_2);
  const f1 = path.join(OUT_DIR, "Construtora_Alfa_Junho_2026.xlsx");
  const f2 = path.join(OUT_DIR, "Construtora_Alfa_Julho_2026.xlsx");
  await fs.writeFile(f1, buf1);
  await fs.writeFile(f2, buf2);
  console.log("✓ Planilhas geradas em exemplos/:");
  console.log("   - Construtora_Alfa_Junho_2026.xlsx (mês base)");
  console.log("   - Construtora_Alfa_Julho_2026.xlsx (mês seguinte, com mudanças)\n");

  // --- Verificação offline do pipeline ---
  const mes1 = await parseSpreadsheet(buf1);
  const mes2 = await parseSpreadsheet(buf2);
  console.log(`Parse: mês 1 = ${mes1.length} processos, mês 2 = ${mes2.length} processos`);

  const kpis = computeKpis(mes2);
  console.log("KPIs (mês 2):", kpis);

  const movs = computeDiff(mes2, mes1);
  console.log(`\nDiff (mês 2 vs mês 1) -> ${movs.length} movimentação(ões):`);
  for (const m of movs) console.log(`   [${m.tipo}/${m.prioridade}] ${m.parte} — ${m.resumo}`);

  // Checagens do comportamento esperado (o bug antigo marcava tudo como alterado)
  const numeros = movs.map((m) => m.numero);
  const esperadoAusente = ["0007777-88.2023.8.26.0100", "0005555-11.2024.5.02.0033"];
  const ok =
    movs.length === 3 &&
    esperadoAusente.every((n) => !numeros.includes(n)) &&
    movs.some((m) => m.tipo === "novo") &&
    movs.some((m) => m.tipo === "acordo") &&
    movs.some((m) => m.tipo === "movimentacao");
  console.log(`\nComportamento do diff: ${ok ? "OK ✓ (processos sem mudança foram ignorados)" : "FALHOU ✗"}`);

  const kpisAnterior = computeKpis(mes1);
  const panorama = computePanorama(mes2);
  console.log("\nPanorama por área:", panorama.porArea.map((a) => `${a.area} (${a.count})`).join(", "));
  console.log("Top exposições:", panorama.topExposicoes.map((p) => `${p.parte} — ${p.valorFormatado}`).join(" | "));

  const narrativasExemplo = [
    {
      titulo: "Aumento de exposição em processo trabalhista relevante",
      texto:
        "O processo movido por João da Silva teve o valor da causa atualizado de R$ 1.250.000,00 para R$ 1.500.000,00, um incremento de 20% que ainda não está refletido na provisão atual. Recomenda-se revisão da provisão junto ao departamento financeiro.",
      fonte: "Andamento da planilha",
    },
    {
      titulo: "Acordo homologado — processo de Maria Souza",
      texto:
        "O processo cível de Maria Souza foi encerrado por acordo homologado neste período, encerrando uma exposição de R$ 85.000,00 sem necessidade de provisão adicional.",
      fonte: "Andamento da planilha",
    },
    {
      titulo: "Novo processo distribuído — Banco Beta S/A",
      texto:
        "Entrou na carteira um novo processo cível envolvendo o Banco Beta S/A, com valor da causa de R$ 2.000.000,00 e provisão inicial de R$ 500.000,00. Por se tratar do maior valor individual do mês, recomenda-se acompanhamento prioritário.",
      fonte: "Andamento da planilha",
    },
  ];

  const docx = await generateReportDocx({
    cliente: "Construtora Alfa",
    mesReferencia: "Julho/2026",
    versao: 2,
    kpis,
    kpisAnterior,
    narrativas: narrativasExemplo,
    movimentacoes: movs,
    panorama,
    totalAnexos: 2,
  });
  console.log(`\n.docx gerado: ${docx.length} bytes ${docx.length > 0 ? "✓" : "✗"}`);

  const docxPath = path.join(OUT_DIR, "Relatorio_Construtora_Alfa_Julho_2026.docx");
  await fs.writeFile(docxPath, docx);
  console.log(`Salvo em: ${docxPath}`);

  if (!ok || docx.length === 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
