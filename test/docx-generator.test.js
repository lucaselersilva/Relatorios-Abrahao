import { describe, it, expect } from "vitest";
import JSZip from "jszip";

import { generateReportDocx } from "../lib/docx-generator.js";

const kpis = {
  processos: 3,
  valorEnvolvidoNum: 3_000_000,
  provisaoNum: 800_000,
  valorEnvolvido: "R$ 3.000.000,00",
  provisao: "R$ 800.000,00",
  semProvisao: 1,
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
  { id: 1, tipo: "novo", numero: "1", parte: "Banco Beta", area: "Cível", valor: 2_000_000, valorFormatado: "R$ 2.000.000,00", deltaValor: null, statusAnterior: null, statusAtual: "Distribuído", resumo: "Processo novo na carteira.", prioridade: "alta" },
  { id: 2, tipo: "encerrado", numero: "2", parte: "Maria Souza", area: "Cível", valor: 85_000, valorFormatado: "R$ 85.000,00", deltaValor: null, statusAnterior: "Em andamento", statusAtual: null, resumo: "Processo não consta mais na carteira — provável encerramento/baixa.", prioridade: "media" },
];

const narrativas = [{ titulo: "Destaque", texto: "Texto do destaque.", fonte: "Andamento da planilha" }];

describe("generateReportDocx", () => {
  it("gera um .docx que é um zip válido com as partes XML esperadas", async () => {
    const buf = await generateReportDocx({
      cliente: "Construtora Alfa",
      mesReferencia: "Julho/2026",
      versao: 2,
      kpis,
      kpisAnterior: null,
      narrativas,
      movimentacoes,
      panorama,
      totalAnexos: 1,
    });

    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(2000);
    // Assinatura de arquivo ZIP ("PK").
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");

    const zip = await JSZip.loadAsync(buf);
    for (const part of ["[Content_Types].xml", "word/document.xml", "word/footer1.xml"]) {
      expect(zip.file(part), `parte ausente: ${part}`).toBeTruthy();
    }

    // O corpo precisa ser XML bem-formado (o bug do commit f41ef4f corrompia
    // justamente o XML e o Word recusava abrir o arquivo).
    const documentXml = await zip.file("word/document.xml").async("string");
    expect(documentXml.startsWith("<?xml")).toBe(true);
    expect(documentXml).toContain("</w:document>");
    expect(documentXml).toContain("CONSTRUTORA ALFA"); // capa
    expect(documentXml).toContain("ENCERRADO"); // badge do tipo novo propagado

    // O rodapé (onde o número de página quebrou antes) também precisa ser válido.
    const footerXml = await zip.file("word/footer1.xml").async("string");
    expect(footerXml.startsWith("<?xml")).toBe(true);
    expect(footerXml).toContain("</w:ftr>");
  });
});
