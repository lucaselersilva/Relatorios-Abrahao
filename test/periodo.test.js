import { describe, it, expect } from "vitest";

import { isPeriodoValido, periodoParaRotulo, periodoSeguinte } from "../lib/periodo.js";

describe("isPeriodoValido", () => {
  it("aceita 'YYYY-MM' com mês entre 01 e 12", () => {
    expect(isPeriodoValido("2026-06")).toBe(true);
    expect(isPeriodoValido("2026-01")).toBe(true);
    expect(isPeriodoValido("2026-12")).toBe(true);
  });

  it("rejeita formato ou mês inválido", () => {
    expect(isPeriodoValido("2026-13")).toBe(false);
    expect(isPeriodoValido("2026-00")).toBe(false);
    expect(isPeriodoValido("Junho/2026")).toBe(false);
    expect(isPeriodoValido("2026-6")).toBe(false);
    expect(isPeriodoValido("")).toBe(false);
    expect(isPeriodoValido(null)).toBe(false);
  });
});

describe("periodoParaRotulo", () => {
  it("converte período válido em rótulo em português", () => {
    expect(periodoParaRotulo("2026-06")).toBe("Junho/2026");
    expect(periodoParaRotulo("2026-01")).toBe("Janeiro/2026");
    expect(periodoParaRotulo("2026-12")).toBe("Dezembro/2026");
  });

  it("devolve o próprio valor quando não é um período válido", () => {
    expect(periodoParaRotulo("qualquer coisa")).toBe("qualquer coisa");
  });
});

describe("periodoSeguinte", () => {
  it("soma 1 mês dentro do mesmo ano", () => {
    expect(periodoSeguinte("2026-06")).toBe("2026-07");
  });

  it("trata a virada de ano", () => {
    expect(periodoSeguinte("2026-12")).toBe("2027-01");
  });

  it("devolve o próprio valor quando não é um período válido", () => {
    expect(periodoSeguinte("qualquer coisa")).toBe("qualquer coisa");
  });
});
