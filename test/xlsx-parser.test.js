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

    const { processos: rows } = await parseSpreadsheet(buf);
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

  it("aplica um mapeamento manual para colunas com nome fora do padrão", async () => {
    const buf = await makeXlsx([
      ["Processo", "Valor da demanda"],
      ["001", "1.500,00"],
    ]);

    // Sem mapeamento, "Valor da demanda" não é reconhecido e o valor fica nulo.
    const semMapa = await parseSpreadsheet(buf);
    expect(semMapa.processos[0].valor).toBeNull();
    expect(semMapa.leitura.camposFaltando).toContain("valor");

    // Com o mapeamento manual, a coluna passa a ser lida como "valor".
    const comMapa = await parseSpreadsheet(buf, { mapping: { valor: "Valor da demanda" } });
    expect(comMapa.processos[0].valor).toBe(1500);
    expect(comMapa.leitura.camposReconhecidos.valor).toBe("Valor da demanda");
  });

  it("expõe a leitura: linha do cabeçalho, colunas reconhecidas e amostra", async () => {
    const buf = await makeXlsx([
      ["Processo", "Parte", "Coluna estranha"],
      ["001", "João", "xyz"],
    ]);

    const { leitura } = await parseSpreadsheet(buf);
    expect(leitura.headerRow).toBe(1);
    expect(leitura.camposReconhecidos).toMatchObject({ numero: "Processo", parte: "Parte" });
    expect(leitura.colunas).toContainEqual({ index: 3, nome: "Coluna estranha", campo: null });
    expect(leitura.amostra).toHaveLength(1);
  });

  it("reconhece variações de nome de cabeçalho (CNJ, Réu, Vara, ...)", async () => {
    const buf = await makeXlsx([
      ["CNJ", "Réu", "Vara", "Valor envolvido", "Valor provisionado", "Situação"],
      ["123", "Município X", "Fazenda Pública", "4.800.000,00", "1.200.000,00", "Aguardando julgamento"],
    ]);

    const { processos: rows } = await parseSpreadsheet(buf);
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

    const { processos: rows } = await parseSpreadsheet(buf);
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

    const { processos: rows } = await parseSpreadsheet(buf);
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

    const { processos: rows } = await parseSpreadsheet(buf);
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
