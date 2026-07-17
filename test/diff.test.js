import { describe, it, expect } from "vitest";

import { computeDiff } from "../lib/diff.js";

/** Processo de exemplo com defaults sobrescrevíveis. */
const P = (numero, over = {}) => ({
  numero,
  parte: `Parte ${numero}`,
  area: "Cível",
  valor: 1000,
  provisao: 100,
  status: "Em andamento",
  probabilidade: "Possível",
  ...over,
});

describe("computeDiff", () => {
  it("não gera movimentação para processo sem alteração", () => {
    const p = P("1");
    expect(computeDiff([{ ...p }], [{ ...p }])).toHaveLength(0);
  });

  it("marca processo novo (prioridade alta se valor >= R$ 1mi)", () => {
    const alta = computeDiff([P("9", { valor: 2_000_000 })], []);
    expect(alta[0]).toMatchObject({ tipo: "novo", numero: "9", prioridade: "alta" });

    const media = computeDiff([P("9", { valor: 500 })], []);
    expect(media[0]).toMatchObject({ tipo: "novo", prioridade: "media" });
  });

  it("detecta alteração de valor com delta e prioridade alta", () => {
    const movs = computeDiff([P("1", { valor: 2000 })], [P("1", { valor: 1000 })]);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ tipo: "movimentacao", prioridade: "alta", deltaValor: 1000 });
  });

  it("alteração só de provisão é movimentação de prioridade média (sem delta de valor)", () => {
    const movs = computeDiff([P("1", { provisao: 200 })], [P("1", { provisao: 100 })]);
    expect(movs[0]).toMatchObject({ tipo: "movimentacao", prioridade: "media", deltaValor: null });
  });

  it("classifica como acordo quando o status vira acordo/homologação", () => {
    const movs = computeDiff(
      [P("1", { status: "Acordo homologado" })],
      [P("1", { status: "Em andamento" })]
    );
    expect(movs[0]).toMatchObject({ tipo: "acordo", statusAnterior: "Em andamento", statusAtual: "Acordo homologado" });
  });

  it("detecta processo encerrado (sumiu da planilha atual)", () => {
    const anteriores = [P("1", { valor: 1_500_000, status: "Em andamento" }), P("2")];
    const atuais = [P("2")];

    const movs = computeDiff(atuais, anteriores);
    const enc = movs.find((m) => m.tipo === "encerrado");
    expect(enc).toBeTruthy();
    expect(enc).toMatchObject({
      numero: "1",
      prioridade: "alta", // exposição >= R$ 1mi
      valor: 1_500_000,
      statusAnterior: "Em andamento",
      statusAtual: null,
      deltaValor: null,
    });
    expect(enc.resumo).toMatch(/não consta mais na carteira/i);
    // o processo que permaneceu inalterado não vira movimentação
    expect(movs.some((m) => m.numero === "2")).toBe(false);
  });

  it("encerramento de baixa exposição é prioridade média", () => {
    const movs = computeDiff([], [P("1", { valor: 500 })]);
    expect(movs[0]).toMatchObject({ tipo: "encerrado", prioridade: "media" });
  });
});
