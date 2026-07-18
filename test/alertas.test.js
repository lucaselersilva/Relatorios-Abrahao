import { describe, it, expect } from "vitest";

import { computeAlertas } from "../lib/alertas.js";

const kpis = (over = {}) => ({ processos: 3, valorEnvolvidoNum: 3_000_000, provisaoNum: 800_000, valorEnvolvido: "R$ 3.000.000,00", provisao: "R$ 800.000,00", semProvisao: 0, ...over });

describe("computeAlertas", () => {
  it("alerta de valor alto para processo novo >= R$ 1mi", () => {
    const movs = [{ tipo: "novo", numero: "1", parte: "Banco Beta", valor: 2_000_000, valorFormatado: "R$ 2.000.000,00" }];
    const alertas = computeAlertas({ movimentacoes: movs, kpis: kpis(), kpisAnterior: null });
    expect(alertas).toHaveLength(1);
    expect(alertas[0]).toMatchObject({ tipo: "valor_alto", severidade: "alta", processoNumero: "1" });
  });

  it("não alerta valor alto para processo novo abaixo do limite", () => {
    const movs = [{ tipo: "novo", numero: "1", parte: "X", valor: 500_000 }];
    expect(computeAlertas({ movimentacoes: movs, kpis: kpis(), kpisAnterior: null })).toHaveLength(0);
  });

  it("alerta queda de provisão acima de 20% vs. mês anterior", () => {
    const kpisAnterior = kpis({ provisaoNum: 1_000_000, provisao: "R$ 1.000.000,00" });
    const atual = kpis({ provisaoNum: 700_000, provisao: "R$ 700.000,00" }); // -30%
    const alertas = computeAlertas({ movimentacoes: [], kpis: atual, kpisAnterior });
    expect(alertas.some((a) => a.tipo === "queda_provisao" && a.severidade === "alta")).toBe(true);
  });

  it("não alerta queda de provisão dentro da margem", () => {
    const kpisAnterior = kpis({ provisaoNum: 1_000_000 });
    const atual = kpis({ provisaoNum: 900_000 }); // -10%
    expect(computeAlertas({ movimentacoes: [], kpis: atual, kpisAnterior }).some((a) => a.tipo === "queda_provisao")).toBe(false);
  });

  it("alerta sumiço sem encerramento quando o status anterior não indica baixa", () => {
    const movs = [{ tipo: "encerrado", numero: "9", parte: "Empresa X", valor: 300_000, statusAnterior: "Em andamento" }];
    const alertas = computeAlertas({ movimentacoes: movs, kpis: kpis(), kpisAnterior: null });
    expect(alertas.some((a) => a.tipo === "sumico_sem_encerramento")).toBe(true);
  });

  it("NÃO alerta sumiço quando o status anterior já indicava acordo/baixa", () => {
    const movs = [{ tipo: "encerrado", numero: "9", parte: "Empresa X", valor: 300_000, statusAnterior: "Acordo homologado" }];
    expect(computeAlertas({ movimentacoes: movs, kpis: kpis(), kpisAnterior: null }).some((a) => a.tipo === "sumico_sem_encerramento")).toBe(false);
  });

  it("sumiço de alta exposição é severidade alta", () => {
    const movs = [{ tipo: "encerrado", numero: "9", parte: "Empresa X", valor: 2_000_000, statusAnterior: "Distribuído" }];
    const alerta = computeAlertas({ movimentacoes: movs, kpis: kpis(), kpisAnterior: null }).find((a) => a.tipo === "sumico_sem_encerramento");
    expect(alerta.severidade).toBe("alta");
  });
});
