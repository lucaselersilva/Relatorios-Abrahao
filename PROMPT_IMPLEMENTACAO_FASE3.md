# Prompt de implementação — Fase 3 (Inteligência)

> Cole este prompt inteiro numa sessão do Claude Code (pode ser sessão nova,
> sem histórico de conversa anterior) rodando na raiz deste repositório. É
> autossuficiente, mas pressupõe que a **Fase 0** já foi implementada
> (`PROMPT_IMPLEMENTACAO_FASE0.md`). Pode ser feita em paralelo à Fase 2 —
> não depende dela.

---

Você vai implementar a **Fase 3 ("Inteligência")** do plano de evolução
deste projeto, descrito em `PLANO_EVOLUCAO.md` (leia o arquivo inteiro antes
de começar). Leia também `COMO_TESTAR.md`.

## Pré-requisitos — confira antes de começar

Verifique que existem: período normalizado (`periodo`), diff com tipo
`"encerrado"` (`lib/diff.js`), e idealmente o mapeador de colunas da Fase 1.
Se algo essencial faltar, avise o usuário em texto no chat antes de seguir.

## O sistema

A análise de IA hoje vive inteira em `lib/ai.js`: monta um contexto em texto
com KPIs, movimentações e trechos de PDF extraídos via `pdf-parse`
(`server/app.js`, `extractPdfText`), chama `claude-opus-4-8` com tool use
forçado (`REGISTRAR_ANALISE_TOOL`) e recebe uma lista de destaques
(`titulo`/`texto`/`fonte`). O usuário revisa/edita esses destaques em
`NovoRelatorio.jsx` (step 4) antes de finalizar.

## Por que esta fase

O diff e o relatório já são objetivos (números, tabelas); esta fase é sobre
tornar a leitura da IA mais completa (lê mais tipos de documento, inclusive
PDFs escaneados) e mais útil (aponta o que importa, não só descreve o que
mudou) e dar controle ao usuário sobre o resultado.

## Regras gerais de execução

- Commits pequenos e focados por tarefa; não dê push sem confirmar antes.
- Ao mexer no prompt/system message da IA (`lib/ai.js`), teste com
  `ANTHROPIC_API_KEY` real pelo menos uma vez por tarefa — o modo mock não
  valida a qualidade do texto gerado nem o schema da tool.
- Cuidado com custo/latência: anexos e PDFs enviados à API aumentam tokens
  de entrada — mantenha os limites de tamanho já existentes (`.slice(6000)`
  em `server/app.js`) como referência, ajustando se necessário, mas não
  remova limites sem substituir por outro.
- Não implemente itens de outras fases (portal do cliente, envio de e-mail,
  dashboard) aqui.

## Tarefas (nesta ordem)

### 1. Sumário executivo + pontos de atenção (F10)
- Estenda o schema da tool `REGISTRAR_ANALISE_TOOL` em `lib/ai.js`: além de
  `destaques`, adicione `sumarioExecutivo` (string, parágrafo de abertura) e
  `pontosDeAtencao` (array de `{ titulo, texto, severidade }`, ex.: provisão
  desalinhada, alto valor sem provisão, concentração de risco por área).
- Ajuste o `system` prompt para pedir explicitamente esses dois blocos, com
  critério objetivo do que conta como "ponto de atenção" (ligue com os dados
  que `computeKpis`/`computePanorama` já calculam — ex.: `semProvisao > 0`,
  concentração por área acima de X% do `valorEnvolvido`).
- Atualize `mockNarrativas` (modo sem `ANTHROPIC_API_KEY`) para retornar uma
  estrutura equivalente, para não quebrar quem desenvolve sem chave.
- Persista os novos campos no `Report` (`prisma/schema.prisma` — pode reusar
  o campo `narrativas` Json existente ampliando seu formato, documentando a
  mudança de shape) e renderize as duas seções novas em
  `lib/docx-generator.js` e `src/pages/RelatorioVisualizar.jsx`, seguindo o
  estilo visual já usado nos cartões de destaque.

### 2. Ler anexos .docx e PDFs escaneados (F11)
- `.docx`: adicione `mammoth` como dependência; em `server/app.js`, ao lado
  de `extractPdfText`, crie `extractDocxText(buffer)` usando
  `mammoth.extractRawText`; aplique quando o mimetype do anexo for
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- PDFs escaneados (sem texto extraível via `pdf-parse` — checar
  `result.text?.trim()` vazio): em vez de descartar o anexo, envie o PDF
  original como bloco de documento nativo para a API da Anthropic (o SDK
  `@anthropic-ai/sdk` na versão instalada suporta content blocks do tipo
  `document` com PDF em base64 — confirme a sintaxe exata na versão do SDK
  presente no `package.json` antes de implementar). Ajuste `gerarAnaliseIA`
  em `lib/ai.js` para aceitar tanto texto extraído quanto buffers de PDF
  brutos na mensagem enviada ao modelo.
- Atenção ao limite de tamanho de mensagem/tokens da API ao anexar PDFs
  inteiros — trate arquivos muito grandes com um aviso claro na UI em vez de
  falhar silenciosamente.

### 3. Regenerar destaque individual + instruções customizadas (F12)
- `NovoRelatorio.jsx` (step 4): adicione um botão "Regenerar" em cada cartão
  de destaque, e um campo de texto livre "Instruções para a IA" antes de
  rodar a análise (step 3, ao lado do botão "Rodar análise da IA").
- Backend: estenda `gerarAnaliseIA` para aceitar uma instrução extra do
  usuário, incluída no contexto enviado ao modelo. Para regenerar um destaque
  específico, decida entre (a) reenviar todo o contexto pedindo para
  substituir apenas aquele item, ou (b) uma chamada menor focada só naquele
  destaque — prefira (b) se for viável sem duplicar muita lógica, já que é
  mais barato e rápido; documente a escolha se não for óbvia.

### 4. Alertas automáticos determinísticos (F13)
- Regras que **não dependem de IA**, calculadas logo após o upload
  (`server/app.js`, na rota de upload, usando os dados já calculados por
  `computeDiff`/`computeKpis`/`computePanorama`):
  - novo processo com valor ≥ um limite configurável (reaproveite o mesmo
    critério de `prioridade: "alta"` já usado em `lib/diff.js` como ponto de
    partida, ou parametrize por cliente se fizer sentido);
  - provisão total caiu mais que Y% em relação ao período anterior;
  - processo com status que não indica encerramento mas que sumiu da
    planilha (cruzando com o tipo `"encerrado"` da Fase 0 — sinalizar quando
    isso acontecer sem confirmação explícita de baixa/acordo).
- Guarde os alertas gerados (`alertas Json?` no `Report`, ou computados sob
  demanda — prefira persistir para não recalcular toda hora e para manter
  histórico do que foi alertado).
- Exiba os alertas no wizard (step 2, "O que mudou") e, se a Fase 1 já tiver
  sido implementada, também no dashboard inicial (`F5`).

## Critério de aceite da fase

- O relatório final tem um parágrafo de sumário executivo e uma seção de
  pontos de atenção, calculados a partir de critérios objetivos + IA.
- Um anexo `.docx` tem seu texto lido pela análise; um PDF escaneado (sem
  texto) ainda contribui para a análise via visão do modelo, em vez de ser
  ignorado silenciosamente.
- O usuário consegue regenerar um destaque individual e guiar a análise com
  uma instrução livre.
- Alertas determinísticos (valor alto, queda de provisão, sumiço sem
  encerramento) aparecem automaticamente após o upload, sem depender da IA.
- `npm test` continua passando; fluxo do `COMO_TESTAR.md` continua íntegro.

## Ao terminar

Resuma o que foi feito por tarefa (1–4), quaisquer limites de tamanho/custo
que precisaram de ajuste, e pergunte ao usuário — **em texto no chat** — se
quer seguir para a Fase 4 (portal do cliente) do `PLANO_EVOLUCAO.md`.
