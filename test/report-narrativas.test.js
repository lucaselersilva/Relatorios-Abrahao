import { describe, it, expect } from "vitest";
import JSZip from "jszip";

import { generateReportDocx } from "../lib/docx-generator.js";
import { generateReportPdf } from "../lib/pdf-generator.js";

const kpis = { processos: 3, valorEnvolvidoNum: 3_000_000, provisaoNum: 800_000, valorEnvolvido: "R$ 3.000.000,00", provisao: "R$ 800.000,00", semProvisao: 1 };
const panorama = { porArea: [{ area: "Cível", valor: 3_000_000, count: 3 }], topExposicoes: [] };
const movimentacoes = [{ id: 1, tipo: "novo", numero: "1", parte: "Banco Beta", area: "Cível", valor: 2_000_000, valorFormatado: "R$ 2.000.000,00", deltaValor: null, statusAnterior: null, statusAtual: "Distribuído", prioridade: "alta" }];

// Shape novo (F10): objeto com sumário executivo, destaques e pontos de atenção.
const narrativas = {
  sumarioExecutivo: "A carteira encerrou o mês com exposição concentrada e um processo relevante sem provisão.",
  destaques: [{ titulo: "Novo processo relevante", texto: "Banco Beta entrou com alta exposição.", fonte: "Andamento da planilha" }],
  pontosDeAtencao: [
    { titulo: "Exposição sem provisão", texto: "Um processo de alto valor está sem provisão registrada.", severidade: "alta" },
    { titulo: "Concentração de risco", texto: "100% do valor está na área Cível.", severidade: "media" },
  ],
};

const dados = { cliente: "Construtora Alfa", mesReferencia: "Julho/2026", versao: 2, kpis, kpisAnterior: null, narrativas, movimentacoes, panorama, totalAnexos: 0 };

describe("geradores com o shape novo de narrativas (F10)", () => {
  it(".docx inclui sumário executivo e pontos de atenção com severidade", async () => {
    const buf = await generateReportDocx(dados);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml").async("string");
    expect(xml).toContain("SUMÁRIO EXECUTIVO");
    expect(xml).toContain("exposição concentrada"); // texto do sumário
    expect(xml).toContain("PONTOS DE ATENÇÃO");
    expect(xml).toContain("SEVERIDADE ALTA");
  });

  it("PDF gera arquivo válido com o shape novo", async () => {
    const buf = await generateReportPdf(dados);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.subarray(-6).toString("latin1")).toContain("%%EOF");
  });
});
