import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

function mockNarrativas(movimentacoes) {
  return movimentacoes.slice(0, 5).map((m) => ({
    titulo: `${m.tipo === "novo" ? "Novo processo" : "Movimentação"}: ${m.parte}`,
    texto: `[Modo mock — configure ANTHROPIC_API_KEY para análise real] ${m.resumo}`,
    fonte: "Andamento da planilha (modo mock)",
  }));
}

const REGISTRAR_ANALISE_TOOL = {
  name: "registrar_analise",
  description: "Registra os destaques da análise do período para o relatório executivo.",
  input_schema: {
    type: "object",
    properties: {
      destaques: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título curto do destaque" },
            texto: { type: "string", description: "Parágrafo explicando o destaque, em português, tom executivo/jurídico" },
            fonte: { type: "string", description: "De onde veio a informação (planilha, documento anexado, etc.)" },
          },
          required: ["titulo", "texto", "fonte"],
        },
      },
    },
    required: ["destaques"],
  },
};

export async function gerarAnaliseIA({ cliente, mesReferencia, kpis, movimentacoes, documentosTexto }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return mockNarrativas(movimentacoes);
  }

  const client = new Anthropic();

  const contexto = [
    `Cliente: ${cliente}`,
    `Mês de referência: ${mesReferencia}`,
    `KPIs do mês: ${JSON.stringify(kpis)}`,
    `Movimentações detectadas (diff contra o mês anterior): ${JSON.stringify(movimentacoes)}`,
    documentosTexto?.length
      ? `Trechos de documentos anexados:\n${documentosTexto.map((d) => `--- ${d.processoNumero} (${d.fileName}) ---\n${d.texto}`).join("\n\n")}`
      : "Nenhum documento anexado — baseie-se apenas no andamento da planilha.",
  ].join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system:
      "Você é um assistente jurídico que escreve a seção 'Análise do período' de um relatório executivo mensal para um escritório de advocacia. Escreva em português, tom executivo e direto, destacando o que realmente importa para quem lê (variação de valor envolvido, risco, mudanças de instância, provisões desalinhadas). Cite a fonte de cada destaque.",
    tools: [REGISTRAR_ANALISE_TOOL],
    tool_choice: { type: "tool", name: "registrar_analise" },
    messages: [{ role: "user", content: contexto }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse) return mockNarrativas(movimentacoes);
  return toolUse.input.destaques;
}
