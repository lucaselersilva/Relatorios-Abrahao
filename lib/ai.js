import Anthropic from "@anthropic-ai/sdk";

import { SEVERIDADES, severidadeValida } from "./narrativas.js";
import { formatMoeda } from "./diff.js";
import { pct } from "./alertas.js";

const MODEL = "claude-opus-4-8";

// Deriva um ponto de atenção objetivo a partir dos números já calculados, para o
// modo mock devolver algo plausível sem chave — os critérios espelham o que o
// system prompt pede à IA (semProvisao > 0, concentração por área).
function pontosDeAtencaoMock({ kpis, panorama }) {
  const pontos = [];
  if (kpis?.semProvisao > 0) {
    pontos.push({
      titulo: "Processos sem provisão adequada",
      texto: `[Modo mock] ${kpis.semProvisao} processo(s) com valor e sem provisão registrada — revisar a cobertura.`,
      severidade: kpis.semProvisao > 2 ? "alta" : "media",
    });
  }
  const top = panorama?.porArea?.[0];
  const total = kpis?.valorEnvolvidoNum ?? 0;
  if (top && total > 0 && top.valor / total >= 0.5) {
    pontos.push({
      titulo: `Concentração de risco em ${top.area}`,
      texto: `[Modo mock] ${Math.round((top.valor / total) * 100)}% do valor envolvido está concentrado na área ${top.area}.`,
      severidade: "media",
    });
  }
  return pontos;
}

function mockNarrativas({ movimentacoes = [], kpis, kpisAnterior, panorama }) {
  const destaques = movimentacoes.slice(0, 5).map((m) => ({
    titulo: `${m.tipo === "novo" ? "Novo processo" : m.tipo === "encerrado" ? "Baixa/encerramento" : "Movimentação"}: ${m.parte ?? "Parte não identificada"}`,
    texto: `[Modo mock — configure ANTHROPIC_API_KEY para análise real] ${m.resumo ?? ""}`,
    fonte: "Andamento da planilha (modo mock)",
  }));
  const variacaoTxt = kpisAnterior?.valorEnvolvido ? ` (era ${kpisAnterior.valorEnvolvido} no mês anterior)` : "";
  return {
    sumarioExecutivo:
      `[Modo mock — configure ANTHROPIC_API_KEY para análise real] No período foram detectadas ${movimentacoes.length} ` +
      `movimentação(ões) relevante(s); a carteira soma ${kpis?.valorEnvolvido ?? "—"}${variacaoTxt} em valor envolvido e ` +
      `${kpis?.provisao ?? "—"} em provisão.`,
    destaques,
    pontosDeAtencao: pontosDeAtencaoMock({ kpis, panorama }),
  };
}

// Um único destaque de reserva quando a regeneração falha (modo mock ou sem tool_use).
function mockDestaque(destaqueAtual, instrucao) {
  return {
    titulo: destaqueAtual?.titulo || "Destaque",
    texto:
      `[Modo mock — configure ANTHROPIC_API_KEY para regenerar de verdade] ` +
      (instrucao?.trim() ? `Instrução: ${instrucao.trim()}. ` : "") +
      (destaqueAtual?.texto ?? ""),
    fonte: destaqueAtual?.fonte || "Andamento da planilha (modo mock)",
  };
}

const DESTAQUE_SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string", description: "Título curto do destaque" },
    texto: { type: "string", description: "Parágrafo explicando o destaque, em português, tom executivo/jurídico" },
    fonte: { type: "string", description: "De onde veio a informação (planilha, documento anexado, etc.)" },
  },
  required: ["titulo", "texto", "fonte"],
};

const REGISTRAR_ANALISE_TOOL = {
  name: "registrar_analise",
  description:
    "Registra a análise do período — sumário executivo, destaques e pontos de atenção — para o relatório executivo.",
  input_schema: {
    type: "object",
    properties: {
      sumarioExecutivo: {
        type: "string",
        description:
          "4 a 6 frases, em português e tom executivo, sintetizando a situação da carteira no período: " +
          "evolução do valor envolvido e da provisão vs. mês anterior (com variação percentual quando houver), " +
          "volume/natureza das movimentações e o risco global. Não repetir o que já está nos destaques.",
      },
      destaques: {
        type: "array",
        description:
          "De 3 a 7 fatos — os que MAIS importam do período, não todos os que mudaram. Para cada um, explicar a " +
          "implicação para a carteira, não só descrever o que mudou. Citar a fonte.",
        items: DESTAQUE_SCHEMA,
      },
      pontosDeAtencao: {
        type: "array",
        description:
          "Riscos e desalinhamentos objetivos que a diretoria jurídica precisa acompanhar, qualificando os alertas " +
          "automáticos já fornecidos no contexto (não recalculá-los do zero). Lista vazia se não houver.",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título curto do ponto de atenção" },
            texto: { type: "string", description: "Explicação objetiva, citando números quando possível" },
            severidade: { type: "string", enum: SEVERIDADES, description: "Gravidade: alta | media | baixa" },
          },
          required: ["titulo", "texto", "severidade"],
        },
      },
    },
    required: ["sumarioExecutivo", "destaques", "pontosDeAtencao"],
  },
};

const REGISTRAR_DESTAQUE_TOOL = {
  name: "registrar_destaque",
  description: "Registra UM único destaque reescrito do relatório.",
  input_schema: { type: "object", properties: DESTAQUE_SCHEMA.properties, required: DESTAQUE_SCHEMA.required },
};

const SYSTEM_PROMPT =
  "Você é um assistente jurídico que escreve a seção analítica de um relatório executivo mensal de um escritório " +
  "de advocacia (leitor: diretoria jurídica do cliente). Escreva em português, tom executivo e direto.\n\n" +
  "Seu papel é de SÍNTESE, não de transcrição: o contexto que você recebe já traz KPIs, panorama, o diff completo " +
  "do mês e os alertas automáticos calculados por regras. Não repita esses dados linha a linha — julgue o que é " +
  "materialmente relevante para quem dirige o jurídico do cliente, explique POR QUE importa (risco, exposição " +
  "financeira, tendência da carteira) e deixe de fora o que é rotina.\n\n" +
  "Sempre responda pela ferramenta registrar_analise, com três blocos:\n" +
  "1. sumarioExecutivo: 4 a 6 frases sintetizando a carteira no período — evolução de valor/provisão vs. mês " +
  "anterior (cite a variação percentual quando houver mês anterior no contexto), volume e natureza das " +
  "movimentações, nível de risco global. Não repita frase por frase o que já está nos destaques.\n" +
  "2. destaques: de 3 a 7 fatos — os que MAIS importam do período, não uma lista de tudo que mudou. Priorize por " +
  "magnitude financeira, mudança de risco e significado estratégico (um acordo relevante importa mais que uma " +
  "correção de status menor). Para cada um, não só descreva o que mudou — explique a implicação para a carteira " +
  "do cliente. Cite a fonte de cada destaque (planilha, documento anexado, etc.).\n" +
  "3. pontosDeAtencao: riscos e desalinhamentos OBJETIVOS, cada um com severidade alta | media | baixa. O contexto " +
  "já traz 'Alertas automáticos' calculados por regras determinísticas (processos sem provisão, queda de provisão, " +
  "concentração por área, sumiço sem baixa) — sua tarefa aqui é QUALIFICAR e priorizar esses alertas (confirmar ou " +
  "ajustar a severidade, agregar os que têm a mesma causa raiz, dar contexto), não recalculá-los do zero. Você pode " +
  "acrescentar um ponto que os alertas não cobriram, desde que seja objetivo e citável a partir dos números " +
  "fornecidos. Se não houver ponto de atenção relevante, devolva pontosDeAtencao como lista vazia — não invente " +
  "riscos.\n\n" +
  "Regra de fidelidade: cite apenas números e fatos presentes no contexto fornecido. Nunca estime, arredonde de " +
  "forma que mude a ordem de grandeza, ou calcule algo que não esteja nos dados. Se um documento aparecer na lista " +
  "de itens que não puderam ser incluídos, ou tiver texto marcado como truncado, não afirme fatos sobre o conteúdo " +
  "que falta dele.\n\n" +
  "Exemplo do padrão de qualidade esperado (adapte ao caso real — não copie estes números):\n" +
  '"sumarioExecutivo": "A carteira encerrou o período com R$ 42,3 milhões em valor envolvido, alta de 8,4% em ' +
  "relação ao mês anterior, impulsionada principalmente pela entrada de dois processos tributários de alta " +
  "exposição. A provisão total acompanhou apenas parcialmente esse crescimento (+3,1%), ampliando o descasamento " +
  "entre risco e cobertura contábil. Das movimentações do período, destaca-se um acordo homologado na área " +
  "trabalhista que reduziu a exposição em R$ 1,2 milhão, e a concentração de risco em Tributário, que já responde " +
  'por 46% do valor da carteira. No conjunto, o risco global do período é moderado, com um ponto de atenção ' +
  'concreto sobre provisionamento."\n' +
  '{ "titulo": "Concentração crescente em Tributário", "texto": "A área Tributária passou a representar 46% do ' +
  "valor envolvido da carteira (era 38% no mês anterior), impulsionada pelos dois novos processos de alta " +
  "exposição. Isso eleva a sensibilidade do resultado financeiro do cliente a decisões dessa área específica, e " +
  'vale acompanhamento próximo caso a tendência continue.", "fonte": "Panorama da carteira e diff do mês" }\n\n' +
  "O que evitar: linguagem vaga (\"a carteira teve algumas alterações\"), transcrição mecânica do diff " +
  "(\"o processo X mudou de status Y para Z\") sem explicar a implicação, e redundância entre o sumário e os " +
  "destaques.";

// System prompt dedicado à regeneração de um único destaque — tarefa menor e
// diferente da análise completa, não reaproveita o few-shot/priorização do
// SYSTEM_PROMPT (que fala de escolher 3-7 fatos entre N; aqui o fato já foi
// escolhido, só a redação está sendo revisada).
const REGEN_SYSTEM_PROMPT =
  "Você é um assistente jurídico que revisa UM destaque de um relatório executivo mensal de um escritório de " +
  "advocacia (leitor: diretoria jurídica do cliente). Escreva em português, tom executivo e direto.\n\n" +
  "Você recebe o contexto do período (KPIs, panorama, movimentações) apenas como referência, o destaque atual e o " +
  "que o usuário pediu para ajustar. Responda pela ferramenta registrar_destaque só com o destaque reescrito " +
  "(titulo/texto/fonte) — não gere uma análise nova nem repita os outros destaques do relatório. Cite apenas " +
  "números e fatos presentes no contexto fornecido; nunca estime ou calcule valores que não estejam nele.";

const DOCUMENTO_TEXTO_TRUNCADO_AVISO = " [texto truncado — pode haver mais conteúdo não incluído aqui]";

function formatVariacao(atual, anterior) {
  const variacao = pct(atual, anterior);
  if (variacao == null) return "n/d";
  return `${variacao >= 0 ? "+" : ""}${variacao.toFixed(1)}%`;
}

function formatKpisBloco(kpis, kpisAnterior) {
  if (!kpis) return "(sem KPIs calculados)";
  const linhas = [`Processos ativos: ${kpis.processos}${kpisAnterior ? ` (era ${kpisAnterior.processos})` : ""}`];
  linhas.push(
    `Valor envolvido: ${kpis.valorEnvolvido ?? "—"}` +
      (kpisAnterior
        ? ` (era ${kpisAnterior.valorEnvolvido ?? "—"} no mês anterior — variação de ${formatVariacao(kpis.valorEnvolvidoNum, kpisAnterior.valorEnvolvidoNum)})`
        : " (sem mês anterior para comparar)")
  );
  linhas.push(
    `Provisão total: ${kpis.provisao ?? "—"}` +
      (kpisAnterior
        ? ` (era ${kpisAnterior.provisao ?? "—"} no mês anterior — variação de ${formatVariacao(kpis.provisaoNum, kpisAnterior.provisaoNum)})`
        : "")
  );
  linhas.push(`Processos com valor relevante e sem provisão registrada: ${kpis.semProvisao}`);
  return linhas.join("\n");
}

function formatPanoramaBloco(panorama) {
  if (!panorama?.porArea?.length) return null;
  const totalValor = panorama.porArea.reduce((acc, a) => acc + (a.valor ?? 0), 0);
  const porAreaTxt = panorama.porArea
    .map(
      (a) =>
        `- ${a.area}: ${formatMoeda(a.valor) ?? "—"} (${a.count} processo(s)${
          totalValor > 0 ? `, ${((a.valor / totalValor) * 100).toFixed(0)}% do valor total` : ""
        })`
    )
    .join("\n");
  const topTxt = (panorama.topExposicoes ?? [])
    .map(
      (p) =>
        `- ${p.parte ?? "Parte não identificada"} (${p.numero}): ${p.valorFormatado ?? formatMoeda(p.valor) ?? "—"}, ` +
        `área ${p.area ?? "não classificada"}, status "${p.status ?? "-"}"`
    )
    .join("\n");
  return `Valor por área do direito:\n${porAreaTxt}\n\nMaiores exposições da carteira:\n${topTxt}`;
}

function formatMovimentacoesBloco(movimentacoes) {
  if (!movimentacoes?.length) return "Nenhuma movimentação relevante detectada neste mês.";
  return movimentacoes
    .map(
      (m) =>
        `- [${m.tipo}${m.prioridade === "alta" ? ", prioridade alta" : ""}] ${m.parte ?? "Parte não identificada"} ` +
        `(${m.numero}, ${m.area ?? "área não classificada"}): ${m.resumo ?? "-"}`
    )
    .join("\n");
}

function formatAlertasBloco(alertas) {
  if (!alertas?.length) return null;
  return alertas.map((a) => `- [${a.severidade}] ${a.titulo}: ${a.texto}`).join("\n");
}

/**
 * Monta a mensagem do usuário: um bloco de texto legível (não JSON) com todo o
 * contexto — KPIs com variação vs. mês anterior, panorama, movimentações,
 * alertas automáticos já calculados, e documentos — e, quando houver PDFs sem
 * texto extraível (escaneados), cada um como bloco de documento nativo
 * (base64) para o modelo ler por visão.
 */
function montarContexto({
  cliente,
  mesReferencia,
  kpis,
  kpisAnterior,
  panorama,
  movimentacoes,
  alertas,
  documentosTexto,
  documentosPdf,
  documentosPulados,
  instrucao,
}) {
  const partes = [`Cliente: ${cliente}`, `Mês de referência: ${mesReferencia}`, `KPIs do mês:\n${formatKpisBloco(kpis, kpisAnterior)}`];

  const panoramaTxt = formatPanoramaBloco(panorama);
  if (panoramaTxt) partes.push(`Panorama da carteira:\n${panoramaTxt}`);

  partes.push(`Movimentações detectadas no mês (diff contra o mês anterior):\n${formatMovimentacoesBloco(movimentacoes)}`);

  const alertasTxt = formatAlertasBloco(alertas);
  if (alertasTxt) {
    partes.push(
      `Alertas automáticos já calculados pelo sistema (regras determinísticas — qualifique e priorize-os, não os recalcule do zero):\n${alertasTxt}`
    );
  }

  if (documentosTexto?.length) {
    partes.push(
      `Trechos de documentos anexados:\n${documentosTexto
        .map((d) => `--- ${d.processoNumero} (${d.fileName})${d.truncado ? DOCUMENTO_TEXTO_TRUNCADO_AVISO : ""} ---\n${d.texto}`)
        .join("\n\n")}`
    );
  } else {
    partes.push("Nenhum documento com texto extraído.");
  }

  if (documentosPdf?.length) {
    partes.push(`Além disso, ${documentosPdf.length} documento(s) PDF sem texto extraível seguem anexados como imagem para leitura direta.`);
  }

  if (documentosPulados?.length) {
    partes.push(
      `Documentos anexados que NÃO puderam ser incluídos nesta análise — não afirme fatos sobre o conteúdo deles:\n${documentosPulados
        .map((d) => `- ${d.processoNumero} (${d.fileName}): ${d.motivo}`)
        .join("\n")}`
    );
  }

  if (instrucao?.trim()) {
    partes.push(`Instruções adicionais do advogado responsável (priorize-as): ${instrucao.trim()}`);
  }

  const content = [{ type: "text", text: partes.join("\n\n") }];
  for (const pdf of documentosPdf ?? []) {
    content.push({ type: "text", text: `Documento anexado ao processo ${pdf.processoNumero} (${pdf.fileName}):` });
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 } });
  }
  return content;
}

/**
 * Gera a análise completa do período (sumário executivo + destaques + pontos de
 * atenção). Aceita KPIs do mês anterior (para comparação real), alertas
 * automáticos já calculados, texto extraído de anexos (documentosTexto), PDFs
 * escaneados como base64 (documentosPdf), documentos que não puderam ser
 * incluídos (documentosPulados) e uma instrução livre do usuário (instrucao).
 * Retorna o objeto canônico { sumarioExecutivo, destaques, pontosDeAtencao }.
 */
export async function gerarAnaliseIA({
  cliente,
  mesReferencia,
  kpis,
  kpisAnterior,
  panorama,
  movimentacoes,
  alertas,
  documentosTexto,
  documentosPdf,
  documentosPulados,
  instrucao,
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockNarrativas({ movimentacoes, kpis, kpisAnterior, panorama });
  }

  const client = new Anthropic();
  const content = montarContexto({
    cliente,
    mesReferencia,
    kpis,
    kpisAnterior,
    panorama,
    movimentacoes,
    alertas,
    documentosTexto,
    documentosPdf,
    documentosPulados,
    instrucao,
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 10000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: SYSTEM_PROMPT,
    tools: [REGISTRAR_ANALISE_TOOL],
    tool_choice: { type: "tool", name: "registrar_analise" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) return mockNarrativas({ movimentacoes, kpis, kpisAnterior, panorama });
  const { sumarioExecutivo = "", destaques = [], pontosDeAtencao = [] } = toolUse.input;
  return {
    sumarioExecutivo,
    destaques,
    pontosDeAtencao: pontosDeAtencao.map((p) => ({ ...p, severidade: severidadeValida(p.severidade) })),
  };
}

/**
 * Regenera UM destaque específico. Chamada focada (mais barata/rápida que rodar
 * a análise inteira): manda o mesmo contexto + o destaque atual + a instrução do
 * usuário e pede só o item reescrito. Roda no próprio request/response.
 */
export async function regenerarDestaque({
  cliente,
  mesReferencia,
  kpis,
  kpisAnterior,
  panorama,
  movimentacoes,
  documentosTexto,
  destaqueAtual,
  outrosDestaques,
  instrucao,
}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockDestaque(destaqueAtual, instrucao);
  }

  const client = new Anthropic();
  const content = montarContexto({ cliente, mesReferencia, kpis, kpisAnterior, panorama, movimentacoes, documentosTexto, instrucao });
  content.push({
    type: "text",
    text:
      `Reescreva APENAS o destaque abaixo, mantendo o formato (titulo/texto/fonte) e sem repetir os demais destaques do relatório.\n\n` +
      `Destaque atual:\n${JSON.stringify(destaqueAtual)}\n\n` +
      (outrosDestaques?.length ? `Demais destaques (não repita): ${JSON.stringify(outrosDestaques)}\n\n` : "") +
      (instrucao?.trim() ? `O que o usuário pediu para ajustar: ${instrucao.trim()}` : "Melhore a clareza e a precisão do destaque."),
  });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "medium" },
    system: REGEN_SYSTEM_PROMPT,
    tools: [REGISTRAR_DESTAQUE_TOOL],
    tool_choice: { type: "tool", name: "registrar_destaque" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) return mockDestaque(destaqueAtual, instrucao);
  const { titulo, texto, fonte } = toolUse.input;
  return { titulo, texto, fonte };
}
