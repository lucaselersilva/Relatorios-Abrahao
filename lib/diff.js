// Valores podem chegar como number (planilha recém-lida) ou Decimal (Prisma).
// Normalizamos tudo para number antes de comparar/formatar.
function toNumber(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function formatMoeda(valor) {
  const n = toNumber(valor);
  if (n == null) return null;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Igualdade monetária tolerante a tipo (Decimal x number) e a arredondamento
// de casas decimais (o banco guarda com 2 casas).
function valoresIguais(a, b) {
  const na = toNumber(a);
  const nb = toNumber(b);
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  return na.toFixed(2) === nb.toFixed(2);
}

function textosIguais(a, b) {
  return String(a ?? "").trim() === String(b ?? "").trim();
}

/**
 * Compara os processos do upload atual com os do upload anterior (mesmo
 * cliente) e retorna a lista de movimentações relevantes: processos novos e
 * processos existentes cujo valor, provisão ou status mudou.
 *
 * Além do resumo em texto (usado como contexto para a IA), cada movimentação
 * traz campos estruturados (deltaValor, statusAnterior/statusAtual) para que
 * o relatório final consiga exibir colunas objetivas em vez de só prosa.
 */
export function computeDiff(processosAtuais, processosAnteriores) {
  const anterioresPorNumero = new Map(processosAnteriores.map((p) => [p.numero, p]));
  const movimentacoes = [];
  let idSeq = 1;

  for (const atual of processosAtuais) {
    const anterior = anterioresPorNumero.get(atual.numero);
    const valorAtual = toNumber(atual.valor);

    if (!anterior) {
      movimentacoes.push({
        id: idSeq++,
        tipo: "novo",
        numero: atual.numero,
        parte: atual.parte,
        area: atual.area,
        valor: valorAtual,
        valorFormatado: formatMoeda(valorAtual),
        deltaValor: null,
        statusAnterior: null,
        statusAtual: atual.status,
        resumo: "Processo novo na carteira.",
        prioridade: valorAtual != null && valorAtual >= 1_000_000 ? "alta" : "media",
      });
      continue;
    }

    const valorAnterior = toNumber(anterior.valor);
    const mudancas = [];
    const valorMudou = !valoresIguais(anterior.valor, atual.valor);
    if (valorMudou) mudancas.push(`valor de ${formatMoeda(anterior.valor) ?? "-"} para ${formatMoeda(atual.valor) ?? "-"}`);
    if (!valoresIguais(anterior.provisao, atual.provisao))
      mudancas.push(`provisão de ${formatMoeda(anterior.provisao) ?? "-"} para ${formatMoeda(atual.provisao) ?? "-"}`);
    if (!textosIguais(anterior.status, atual.status))
      mudancas.push(`status de "${anterior.status ?? "-"}" para "${atual.status ?? "-"}"`);

    if (mudancas.length > 0) {
      const isAcordo = /acordo|homologad/i.test(atual.status ?? "");
      movimentacoes.push({
        id: idSeq++,
        tipo: isAcordo ? "acordo" : "movimentacao",
        numero: atual.numero,
        parte: atual.parte,
        area: atual.area,
        valor: valorAtual,
        valorFormatado: formatMoeda(valorAtual),
        deltaValor: valorMudou && valorAnterior != null && valorAtual != null ? valorAtual - valorAnterior : null,
        statusAnterior: anterior.status,
        statusAtual: atual.status,
        resumo: `Alteração: ${mudancas.join("; ")}.`,
        prioridade: mudancas.some((m) => m.startsWith("valor")) ? "alta" : "media",
      });
    }
  }

  return movimentacoes;
}

export function computeKpis(processosAtuais) {
  const processos = processosAtuais.length;
  const valorEnvolvido = processosAtuais.reduce((acc, p) => acc + (toNumber(p.valor) ?? 0), 0);
  const provisao = processosAtuais.reduce((acc, p) => acc + (toNumber(p.provisao) ?? 0), 0);
  const semProvisao = processosAtuais.filter((p) => p.valor != null && !p.provisao).length;

  return {
    processos,
    valorEnvolvidoNum: valorEnvolvido,
    provisaoNum: provisao,
    valorEnvolvido: formatMoeda(valorEnvolvido),
    provisao: formatMoeda(provisao),
    semProvisao,
  };
}

const AREA_SEM_CLASSIFICACAO = "Não classificado";

/**
 * Agregados de carteira usados no relatório visual: distribuição de valor por
 * área do direito (para o gráfico de rosca) e as maiores exposições (para o
 * ranking de barras). Recebe a lista de processos do upload atual.
 */
export function computePanorama(processosAtuais, { topN = 5 } = {}) {
  const porAreaMap = new Map();
  for (const p of processosAtuais) {
    const area = p.area?.trim() || AREA_SEM_CLASSIFICACAO;
    const valor = toNumber(p.valor) ?? 0;
    const atual = porAreaMap.get(area) ?? { area, valor: 0, count: 0 };
    atual.valor += valor;
    atual.count += 1;
    porAreaMap.set(area, atual);
  }
  const porArea = [...porAreaMap.values()].sort((a, b) => b.valor - a.valor);

  const topExposicoes = [...processosAtuais]
    .map((p) => ({ ...p, valorNum: toNumber(p.valor) ?? 0 }))
    .sort((a, b) => b.valorNum - a.valorNum)
    .slice(0, topN)
    .map((p) => ({
      numero: p.numero,
      parte: p.parte,
      area: p.area,
      valor: p.valorNum,
      valorFormatado: formatMoeda(p.valorNum),
      status: p.status,
    }));

  return { porArea, topExposicoes };
}
