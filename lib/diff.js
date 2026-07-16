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
        resumo: "Processo novo na carteira.",
        prioridade: valorAtual != null && valorAtual >= 1_000_000 ? "alta" : "media",
      });
      continue;
    }

    const mudancas = [];
    if (!valoresIguais(anterior.valor, atual.valor))
      mudancas.push(`valor de ${formatMoeda(anterior.valor) ?? "-"} para ${formatMoeda(atual.valor) ?? "-"}`);
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
    valorEnvolvido: formatMoeda(valorEnvolvido),
    provisao: formatMoeda(provisao),
    semProvisao,
  };
}
