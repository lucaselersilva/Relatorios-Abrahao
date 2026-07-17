import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import { parseSpreadsheet } from "../lib/xlsx-parser.js";

/** Monta um .xlsx em memória a partir de linhas (arrays de células). */
async function makeXlsx(rows, { preRows = [] } = {}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Processos");
  for (const r of preRows) ws.addRow(r);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("parseSpreadsheet", () => {
  it("reconhece os cabeçalhos padrão e lê todas as colunas", async () => {
    const buf = await makeXlsx([
      ["Processo", "Parte adversa", "Área", "Valor da causa", "Provisão", "Status", "Probabilidade"],
      ["0001234-56.2024.5.02.0001", "João da Silva", "Trabalhista", "1.234,56", "500,00", "Em andamento", "Possível"],
    ]);

    const rows = await parseSpreadsheet(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      numero: "0001234-56.2024.5.02.0001",
      parte: "João da Silva",
      area: "Trabalhista",
      valor: 1234.56,
      provisao: 500,
      status: "Em andamento",
      probabilidade: "Possível",
    });
  });

  it("reconhece variações de nome de cabeçalho (CNJ, Réu, Vara, ...)", async () => {
    const buf = await makeXlsx([
      ["CNJ", "Réu", "Vara", "Valor envolvido", "Valor provisionado", "Situação"],
      ["123", "Município X", "Fazenda Pública", "4.800.000,00", "1.200.000,00", "Aguardando julgamento"],
    ]);

    const rows = await parseSpreadsheet(buf);
    expect(rows[0]).toMatchObject({
      numero: "123",
      parte: "Município X",
      area: "Fazenda Pública",
      valor: 4800000,
      provisao: 1200000,
      status: "Aguardando julgamento",
    });
  });

  it("interpreta valores em formato BR (milhar com ponto, decimal com vírgula)", async () => {
    const buf = await makeXlsx([
      ["Processo", "Valor da causa"],
      ["A", "1.000.000,00"],
      ["B", "0,50"],
      ["C", "R$ 2.500,75"],
    ]);

    const rows = await parseSpreadsheet(buf);
    expect(rows.map((r) => r.valor)).toEqual([1000000, 0.5, 2500.75]);
  });

  it("acha o cabeçalho mesmo quando não está na primeira linha", async () => {
    const buf = await makeXlsx(
      [
        ["Processo", "Parte", "Valor da causa"],
        ["001", "João", "10,00"],
      ],
      { preRows: [["Relatório de acompanhamento processual"], ["Escritório — Junho/2026"], []] }
    );

    const rows = await parseSpreadsheet(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ numero: "001", parte: "João", valor: 10 });
  });

  it("ignora linhas sem número e não duplica o mesmo processo", async () => {
    const buf = await makeXlsx([
      ["Processo", "Parte"],
      ["001", "João"],
      ["", "Linha sem número"],
      ["001", "João (repetido)"],
      ["002", "Maria"],
    ]);

    const rows = await parseSpreadsheet(buf);
    expect(rows.map((r) => r.numero)).toEqual(["001", "002"]);
  });

  it("lança erro claro quando não há coluna de número do processo", async () => {
    const buf = await makeXlsx([
      ["Parte", "Valor da causa", "Status"],
      ["João", "10,00", "Em andamento"],
    ]);

    await expect(parseSpreadsheet(buf)).rejects.toThrow(/coluna do número do processo/i);
  });
});
