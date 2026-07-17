// Decisões de layout/dados compartilhadas entre os renderizadores do relatório
// (gerador de .docx, gerador de PDF e a visualização web). Mantém cores,
// formatação de moeda e as agregações num só lugar para os três mostrarem
// exatamente os mesmos números e as mesmas cores.

// Paleta base (com "#", pronta para SVG/PDF/CSS). O gerador de .docx usa as
// mesmas cores sem o "#": ver docx-generator.js.
export const REPORT_COLORS = {
  navy: "#142B4B",
  navyLight: "#44546A",
  gold: "#9C7C38",
  goldSoft: "#C7A968",
  green: "#3F6B4F",
  red: "#A33B3B",
  slate: "#7A8394",
  line: "#E2E5EA",
  track: "#EDEFF3",
  zebra: "#FAFAFB",
};

// Cores cíclicas para categorias abertas (áreas do direito). Igual à ordem de
// lib/charts.js e ao CATEGORY_COLORS do frontend, para o donut/legenda baterem.
export const CATEGORY_COLORS = ["#142B4B", "#9C7C38", "#3F6B4F", "#6E5AA0", "#2E7D8C", "#A33B3B", "#7A8394", "#C7A968"];
export const categoryColor = (i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

/** Formata um número como moeda BRL. Por padrão sem centavos (como no relatório). */
export function money(v, { withDecimals = false } = {}) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: withDecimals ? 2 : 0 });
}

// Máximo de fatias do donut antes de agrupar o resto em "Outras áreas".
export const MAX_FATIAS = 6;

/**
 * Fatia o panorama por área em principais + "Outras áreas", já com as cores e
 * os dados prontos para o donut e a legenda. Mesma regra usada no .docx e na
 * visualização web.
 */
export function buildPanoramaView(panorama, kpis) {
  const porArea = panorama?.porArea ?? [];
  const topExposicoes = panorama?.topExposicoes ?? [];
  const totalValor = porArea.reduce((s, a) => s + a.valor, 0) || 1;
  const principais = porArea.slice(0, MAX_FATIAS);
  const outras = porArea.slice(MAX_FATIAS);
  const outrasValor = outras.reduce((s, a) => s + a.valor, 0);
  const outrasCount = outras.reduce((s, a) => s + a.count, 0);

  const legenda = principais.map((a, i) => ({
    area: a.area,
    valor: a.valor,
    count: a.count,
    color: categoryColor(i),
    pct: (a.valor / totalValor) * 100,
  }));
  if (outras.length > 0) {
    legenda.push({
      area: "Outras áreas",
      valor: outrasValor,
      count: outrasCount,
      color: REPORT_COLORS.slate,
      pct: (outrasValor / totalValor) * 100,
    });
  }
  const donutData = legenda.map((l) => ({ label: l.area, value: l.valor, color: l.color }));
  return { legenda, donutData, topExposicoes, totalValor, totalProcessos: kpis?.processos ?? 0 };
}

// Tipos de movimentação: rótulo e cor da barra, na ordem de exibição.
export const TIPOS = [
  { tipo: "novo", label: "Processos novos", color: REPORT_COLORS.navy },
  { tipo: "movimentacao", label: "Alterações relevantes", color: REPORT_COLORS.gold },
  { tipo: "acordo", label: "Acordos / homologações", color: REPORT_COLORS.green },
  { tipo: "encerrado", label: "Encerramentos / baixas", color: REPORT_COLORS.slate },
];

/** Conta as movimentações por tipo (novo/movimentacao/acordo/encerrado). */
export function countByTipo(movimentacoes) {
  const c = { novo: 0, movimentacao: 0, acordo: 0, encerrado: 0 };
  for (const m of movimentacoes ?? []) c[m.tipo] = (c[m.tipo] ?? 0) + 1;
  return c;
}

/** Ordena movimentações por prioridade (alta primeiro) e depois por valor. */
export function sortMovimentacoes(movimentacoes) {
  return [...(movimentacoes ?? [])].sort((a, b) => {
    const pa = a.prioridade === "alta" ? 1 : 0;
    const pb = b.prioridade === "alta" ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return (b.valor ?? 0) - (a.valor ?? 0);
  });
}

// Badge por tipo na tabela detalhada: rótulo, cor de fundo e cor do texto.
export const TIPO_BADGE = {
  novo: { label: "NOVO", fill: "#142B4B", color: "#FFFFFF" },
  movimentacao: { label: "ALTERAÇÃO", fill: "#EFE6D2", color: "#7A5F26" },
  acordo: { label: "ACORDO", fill: "#E4EDE7", color: "#2F5D45" },
  encerrado: { label: "ENCERRADO", fill: "#EEF0F3", color: "#44546A" },
};

/** Variação percentual de curr vs. prev; null quando indeterminada. */
export function pctChange(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}
