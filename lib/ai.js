import Anthropic from "@anthropic-ai/sdk";

import { SEVERIDADES, severidadeValida } from "./narrativas.js";

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

function mockNarrativas({ movimentacoes = [], kpis, panorama }) {
  const destaques = movimentacoes.slice(0, 5).map((m) => ({
    titulo: `${m.tipo === "novo" ? "Novo processo" : m.tipo === "encerrado" ? "Baixa/encerramento" : "Movimentação"}: ${m.parte ?? "Parte não identificada"}`,
    texto: `[Modo mock — configure ANTHROPIC_API_KEY para análise real] ${m.resumo ?? ""}`,
    fonte: "Andamento da planilha (modo mock)",
  }));
  return {
    sumarioExecutivo:
      `[Modo mock — configure ANTHROPIC_API_KEY para análise real] No período foram detectadas ${movimentacoes.length} ` +
      `movimentação(ões) relevante(s); a carteira soma ${kpis?.valorEnvolvido ?? "—"} em valor envolvido e ` +
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
          "UM parágrafo de abertura, em português e tom executivo, sintetizando a situação da carteira no período: " +
          "evolução do valor envolvido e da provisão vs. mês anterior, volume/natureza das movimentações e o risco global.",
      },
      destaques: {
        type: "array",
        description: "Os fatos que mais importam do período. Cite a fonte de cada um.",
        items: DESTAQUE_SCHEMA,
      },
      pontosDeAtencao: {
        type: "array",
        description:
          "Riscos e desalinhamentos objetivos que a diretoria jurídica precisa acompanhar. Lista vazia se não houver.",
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
  "de advocacia (leitor: diretoria jurídica do cliente). Escreva em português, tom executivo e direto, destacando " +
  "o que realmente importa (variação de valor envolvido, risco, mudanças de instância, provisões desalinhadas).\n\n" +
  "Sempre responda pela ferramenta registrar_analise, com três blocos:\n" +
  "1. sumarioExecutivo: um único parágrafo de abertura sintetizando a carteira no período (evolução de valor/provisão " +
  "vs. mês anterior, volume e natureza das movimentações, nível de risco global).\n" +
  "2. destaques: os fatos mais relevantes do período (variação de valor, novos processos de alta exposição, " +
  "acordos/homologações, encerramentos, mudanças de instância). Cite a fonte de cada destaque.\n" +
  "3. pontosDeAtencao: riscos e desalinhamentos OBJETIVOS, cada um com severidade alta | media | baixa, a partir dos " +
  "KPIs e do panorama fornecidos, por exemplo:\n" +
  "   - processos com valor relevante e sem provisão registrada (KPI semProvisao > 0) — quanto maior o número/%, maior a severidade;\n" +
  "   - provisão total muito abaixo do valor envolvido (subprovisionamento da carteira);\n" +
  "   - concentração de risco: uma única área do direito concentrando parcela relevante (acima de ~40%) do valor envolvido;\n" +
  "   - exposição individual alta que saiu da carteira sem acordo/homologação explícito.\n" +
  "   Se não houver ponto de atenção relevante, devolva pontosDeAtencao como lista vazia — não invente riscos.";

/**
 * Monta a mensagem do usuário: um bloco de texto com todo o contexto e, quando
 * houver PDFs sem texto extraível (escaneados), cada um como bloco de documento
 * nativo (base64) para o modelo ler por visão.
 */
function montarContexto({ cliente, mesReferencia, kpis, panorama, movimentacoes, documentosTexto, documentosPdf, instrucao }) {
  const texto = [
    `Cliente: ${cliente}`,
    `Mês de referência: ${mesReferencia}`,
    `KPIs do mês: ${JSON.stringify(kpis)}`,
    panorama ? `Panorama da carteira (valor por área + maiores exposições): ${JSON.stringify(panorama)}` : null,
    `Movimentações detectadas (diff contra o mês anterior): ${JSON.stringify(movimentacoes)}`,
    documentosTexto?.length
      ? `Trechos de documentos anexados:\n${documentosTexto.map((d) => `--- ${d.processoNumero} (${d.fileName}) ---\n${d.texto}`).join("\n\n")}`
      : "Nenhum documento com texto extraído.",
    documentosPdf?.length
      ? `Além disso, ${documentosPdf.length} documento(s) PDF sem texto extraível seguem anexados como imagem para leitura direta.`
      : null,
    instrucao?.trim() ? `Instruções adicionais do advogado responsável (priorize-as): ${instrucao.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content = [{ type: "text", text: texto }];
  for (const pdf of documentosPdf ?? []) {
    content.push({ type: "text", text: `Documento anexado ao processo ${pdf.processoNumero} (${pdf.fileName}):` });
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 } });
  }
  return content;
}

/**
 * Gera a análise completa do período (sumário executivo + destaques + pontos de
 * atenção). Aceita texto extraído de anexos (documentosTexto), PDFs escaneados
 * como base64 (documentosPdf) e uma instrução livre do usuário (instrucao).
 * Retorna o objeto canônico { sumarioExecutivo, destaques, pontosDeAtencao }.
 */
export async function gerarAnaliseIA({ cliente, mesReferencia, kpis, panorama, movimentacoes, documentosTexto, documentosPdf, instrucao }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockNarrativas({ movimentacoes, kpis, panorama });
  }

  const client = new Anthropic();
  const content = montarContexto({ cliente, mesReferencia, kpis, panorama, movimentacoes, documentosTexto, documentosPdf, instrucao });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: SYSTEM_PROMPT,
    tools: [REGISTRAR_ANALISE_TOOL],
    tool_choice: { type: "tool", name: "registrar_analise" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) return mockNarrativas({ movimentacoes, kpis, panorama });
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
export async function regenerarDestaque({ cliente, mesReferencia, kpis, panorama, movimentacoes, documentosTexto, destaqueAtual, outrosDestaques, instrucao }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockDestaque(destaqueAtual, instrucao);
  }

  const client = new Anthropic();
  const content = montarContexto({ cliente, mesReferencia, kpis, panorama, movimentacoes, documentosTexto, instrucao });
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
    system: SYSTEM_PROMPT,
    tools: [REGISTRAR_DESTAQUE_TOOL],
    tool_choice: { type: "tool", name: "registrar_destaque" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) return mockDestaque(destaqueAtual, instrucao);
  const { titulo, texto, fonte } = toolUse.input;
  return { titulo, texto, fonte };
}
