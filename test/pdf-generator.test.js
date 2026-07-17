import { describe, it, expect } from "vitest";

import { generateReportPdf } from "../lib/pdf-generator.js";

const kpis = {
  processos: 3,
  valorEnvolvidoNum: 3_000_000,
  provisaoNum: 800_000,
  valorEnvolvido: "R$ 3.000.000,00",
  provisao: "R$ 800.000,00",
  semProvisao: 1,
};

const kpisAnterior = {
  processos: 2,
  valorEnvolvidoNum: 2_000_000,
  provisaoNum: 900_000,
  valorEnvolvido: "R$ 2.000.000,00",
  provisao: "R$ 900.000,00",
  semProvisao: 0,
};

const panorama = {
  porArea: [
    { area: "Cível", valor: 2_000_000, count: 2 },
    { area: "Trabalhista", valor: 1_000_000, count: 1 },
  ],
  topExposicoes: [
    { numero: "1", parte: "Banco Beta", area: "Cível", valor: 2_000_000, valorFormatado: "R$ 2.000.000,00", status: "Distribuído" },
  ],
};

const movimentacoes = [
  { id: 1, tipo: "novo", numero: "1", parte: "Banco Beta", area: "Cível", valor: 2_000_000, valorFormatado: "R$ 2.000.000,00", deltaValor: null, statusAnterior: null, statusAtual: "Distribuído", prioridade: "alta" },
  { id: 2, tipo: "movimentacao", numero: "2", parte: "Empresa Delta", area: "Cível", valor: 250_000, valorFormatado: "R$ 250.000,00", deltaValor: 50_000, statusAnterior: "Inicial", statusAtual: "Instrução", prioridade: "media" },
  { id: 3, tipo: "encerrado", numero: "3", parte: "Maria Souza", area: "Cível", valor: 85_000, valorFormatado: "R$ 85.000,00", deltaValor: null, statusAnterior: "Em andamento", statusAtual: null, prioridade: "media" },
];

const narrativas = [{ titulo: "Destaque", texto: "Texto do destaque que descreve a movimentação do período em prosa.", fonte: "Andamento da planilha" }];

describe("generateReportPdf", () => {
  it("gera um PDF válido (assinatura %PDF e trailer %%EOF)", async () => {
    const buf = await generateReportPdf({
      cliente: "Construtora Alfa",
      mesReferencia: "Julho/2026",
      versao: 2,
      kpis,
      kpisAnterior,
      narrativas,
      movimentacoes,
      panorama,
      totalAnexos: 1,
    });

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(3000);
    // Assinatura de arquivo PDF.
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // O arquivo precisa estar finalizado (trailer no fim).
    expect(buf.subarray(-6).toString("latin1")).toContain("%%EOF");
  });

  it("não quebra com relatório mínimo (sem panorama, movimentações ou narrativas)", async () => {
    const buf = await generateReportPdf({
      cliente: "Cliente Sem Dados",
      mesReferencia: "Janeiro/2026",
      versao: 1,
      kpis: { processos: 0, valorEnvolvidoNum: 0, provisaoNum: 0, valorEnvolvido: "R$ 0,00", provisao: "R$ 0,00", semProvisao: 0 },
      kpisAnterior: null,
      narrativas: [],
      movimentacoes: [],
      panorama: { porArea: [], topExposicoes: [] },
      totalAnexos: 0,
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
