// Alertas automáticos determinísticos (F13). Regras que NÃO dependem de IA,
// calculadas logo após o upload a partir do diff, dos KPIs do mês e dos KPIs do
// mês anterior. São exibidos no wizard e no dashboard e persistidos em
// Report.alertas para não recalcular e manter histórico do que foi alertado.

// Valor a partir do qual um processo novo/encerrado é "alta exposição" — mesmo
// critério de `prioridade: "alta"` usado em lib/diff.js.
export const VALOR_ALTO_LIMITE = 1_000_000;

// Queda percentual da provisão total vs. mês anterior que dispara alerta.
export const QUEDA_PROVISAO_PCT = 20;

// Status do mês anterior que já indicam encerramento legítimo — se o processo
// sumiu da planilha COM um desses status, não é um sumiço "silencioso".
const STATUS_ENCERRAMENTO = /acordo|homologad|encerr|baix|arquivad|extint|transitad|quitad|p[aá]g[ao]/i;

// Variação percentual de `curr` em relação a `prev`. Exportada para lib/ai.js
// reusar a mesma fórmula ao descrever a evolução dos KPIs no contexto da IA —
// garante que a % citada na análise bate com a dos alertas determinísticos.
export function pct(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

/**
 * Calcula os alertas determinísticos de um período.
 * @param {object} args
 * @param {Array}  args.movimentacoes  saída de computeDiff (atual vs. anterior)
 * @param {object} args.kpis           computeKpis do upload atual
 * @param {object|null} args.kpisAnterior computeKpis do upload anterior (ou null)
 * @param {number} [args.valorAltoLimite] limite configurável de "valor alto"
 * @returns {Array<{tipo,severidade,titulo,texto,processoNumero?}>}
 */
export function computeAlertas({ movimentacoes = [], kpis, kpisAnterior, valorAltoLimite = VALOR_ALTO_LIMITE }) {
  const alertas = [];

  // 1) Processo novo com valor >= limite.
  for (const m of movimentacoes) {
    if (m.tipo === "novo" && m.valor != null && m.valor >= valorAltoLimite) {
      alertas.push({
        tipo: "valor_alto",
        severidade: "alta",
        titulo: "Novo processo de alta exposição",
        texto: `${m.parte ?? "Parte não identificada"} entrou na carteira com ${m.valorFormatado ?? "valor relevante"}.`,
        processoNumero: m.numero,
      });
    }
  }

  // 2) Provisão total caiu mais que QUEDA_PROVISAO_PCT% vs. mês anterior.
  if (kpisAnterior) {
    const variacao = pct(kpis?.provisaoNum, kpisAnterior.provisaoNum);
    if (variacao != null && variacao <= -QUEDA_PROVISAO_PCT) {
      alertas.push({
        tipo: "queda_provisao",
        severidade: "alta",
        titulo: "Queda expressiva de provisão",
        texto: `A provisão total caiu ${Math.abs(variacao).toFixed(1)}% em relação ao mês anterior (de ${kpisAnterior.provisao ?? "—"} para ${kpis?.provisao ?? "—"}).`,
      });
    }
  }

  // 3) Processo sumiu da planilha sem status de encerramento (tipo "encerrado"
  //    da Fase 0, mas cujo status anterior não indicava baixa/acordo).
  for (const m of movimentacoes) {
    if (m.tipo !== "encerrado") continue;
    if (STATUS_ENCERRAMENTO.test(m.statusAnterior ?? "")) continue;
    alertas.push({
      tipo: "sumico_sem_encerramento",
      severidade: m.valor != null && m.valor >= valorAltoLimite ? "alta" : "media",
      titulo: "Processo sumiu sem confirmação de baixa",
      texto: `${m.parte ?? "Parte não identificada"} (${m.numero}) não consta mais na planilha, mas o último status era "${m.statusAnterior ?? "—"}" — confirme se houve baixa/acordo.`,
      processoNumero: m.numero,
    });
  }

  return alertas;
}
