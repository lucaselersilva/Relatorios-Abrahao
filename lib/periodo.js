// Período da carteira normalizado como "YYYY-MM". É a fonte da verdade para
// ordenar/comparar meses; mesReferencia é só o rótulo de exibição derivado.

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** true se `periodo` é uma string "YYYY-MM" com mês entre 01 e 12. */
export function isPeriodoValido(periodo) {
  if (typeof periodo !== "string" || !/^\d{4}-\d{2}$/.test(periodo)) return false;
  const mes = Number(periodo.slice(5, 7));
  return mes >= 1 && mes <= 12;
}

/** Período do mês corrente ("YYYY-MM"). Usa UTC — estável no meio do mês. */
export function periodoAtual(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

/** "2026-06" -> "Junho/2026". Devolve o próprio valor se não for um período válido. */
export function periodoParaRotulo(periodo) {
  if (!isPeriodoValido(periodo)) return periodo ?? "";
  const [ano, mes] = periodo.split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

/** Período seguinte a `periodo` ("YYYY-MM" -> "YYYY-MM", tratando virada de ano). */
export function periodoSeguinte(periodo) {
  if (!isPeriodoValido(periodo)) return periodo ?? "";
  const [ano, mes] = periodo.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes, 1)); // mes (1-12) já aponta para o próximo mês em índice 0-based
  return data.toISOString().slice(0, 7);
}
