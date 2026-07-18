import { describe, it, expect } from "vitest";

import { normalizeNarrativas, emptyNarrativas, severidadeValida } from "../lib/narrativas.js";

describe("normalizeNarrativas", () => {
  it("nulo/undefined vira o objeto vazio canônico", () => {
    expect(normalizeNarrativas(null)).toEqual(emptyNarrativas());
    expect(normalizeNarrativas(undefined)).toEqual(emptyNarrativas());
  });

  it("shape legado (array de destaques) vira destaques, sem sumário nem pontos", () => {
    const legado = [{ titulo: "A", texto: "x", fonte: "planilha" }];
    expect(normalizeNarrativas(legado)).toEqual({ sumarioExecutivo: "", destaques: legado, pontosDeAtencao: [] });
  });

  it("shape novo passa direto, preenchendo campos faltantes", () => {
    const novo = { sumarioExecutivo: "Resumo", destaques: [{ titulo: "A", texto: "x", fonte: "f" }] };
    expect(normalizeNarrativas(novo)).toEqual({ sumarioExecutivo: "Resumo", destaques: novo.destaques, pontosDeAtencao: [] });
  });

  it("ignora tipos inesperados dos campos", () => {
    const bagunca = { sumarioExecutivo: 42, destaques: "não é array", pontosDeAtencao: null };
    expect(normalizeNarrativas(bagunca)).toEqual(emptyNarrativas());
  });
});

describe("severidadeValida", () => {
  it("mantém severidades válidas e usa 'media' como padrão", () => {
    expect(severidadeValida("alta")).toBe("alta");
    expect(severidadeValida("baixa")).toBe("baixa");
    expect(severidadeValida("qualquer")).toBe("media");
    expect(severidadeValida(undefined)).toBe("media");
  });
});
