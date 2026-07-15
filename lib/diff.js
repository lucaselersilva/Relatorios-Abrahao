function formatMoeda(valor) {
  if (valor == null) return null;
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

    if (!anterior) {
      movimentacoes.push({
        id: idSeq++,
        tipo: "novo",
        numero: atual.numero,
        parte: atual.parte,
        area: atual.area,
        valor: atual.valor,
        valorFormatado: formatMoeda(atual.valor),
        resumo: "Processo novo na carteira.",
        prioridade: atual.valor != null && atual.valor >= 1_000_000 ? "alta" : "media",
      });
      continue;
    }

    const mudancas = [];
    if (anterior.valor !== atual.valor) mudancas.push(`valor de ${formatMoeda(anterior.valor)} para ${formatMoeda(atual.valor)}`);
    if (anterior.provisao !== atual.provisao) mudancas.push(`provisão de ${formatMoeda(anterior.provisao)} para ${formatMoeda(atual.provisao)}`);
    if (anterior.status !== atual.status) mudancas.push(`status de "${anterior.status ?? "-"}" para "${atual.status ?? "-"}"`);

    if (mudancas.length > 0) {
      const isAcordo = /acordo|homologad/i.test(atual.status ?? "");
      movimentacoes.push({
        id: idSeq++,
        tipo: isAcordo ? "acordo" : "movimentacao",
        numero: atual.numero,
        parte: atual.parte,
        area: atual.area,
        valor: atual.valor,
        valorFormatado: formatMoeda(atual.valor),
        resumo: `Alteração: ${mudancas.join("; ")}.`,
        prioridade: mudancas.some((m) => m.startsWith("valor")) ? "alta" : "media",
      });
    }
  }

  return movimentacoes;
}

export function computeKpis(processosAtuais) {
  const processos = processosAtuais.length;
  const valorEnvolvido = processosAtuais.reduce((acc, p) => acc + (p.valor ?? 0), 0);
  const provisao = processosAtuais.reduce((acc, p) => acc + (p.provisao ?? 0), 0);
  const semProvisao = processosAtuais.filter((p) => p.valor != null && !p.provisao).length;

  return {
    processos,
    valorEnvolvido: formatMoeda(valorEnvolvido),
    provisao: formatMoeda(provisao),
    semProvisao,
  };
}
