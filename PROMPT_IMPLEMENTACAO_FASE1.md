# Prompt de implementação — Fase 1 (Confiança no dado + produtividade interna)

> Cole este prompt inteiro numa sessão do Claude Code (pode ser sessão nova,
> sem histórico de conversa anterior) rodando na raiz deste repositório. É
> autossuficiente, mas pressupõe que a **Fase 0** (`PROMPT_IMPLEMENTACAO_FASE0.md`)
> já foi implementada.

---

Você vai implementar a **Fase 1 ("Confiança no dado + produtividade
interna")** do plano de evolução deste projeto, descrito em
`PLANO_EVOLUCAO.md` (leia o arquivo inteiro antes de começar). Leia também
`COMO_TESTAR.md` para saber como rodar e validar o fluxo manualmente.

## Pré-requisitos — confira antes de começar

Esta fase assume que a Fase 0 já está pronta. Antes de escrever qualquer
código, verifique (via `git log`, leitura do schema e do código) que existem:
- Campo `periodo` (`"YYYY-MM"`) em `Upload`/`Report`, com o diff comparando
  pelo período anterior real (não pela data de upload).
- Tipo de movimentação `"encerrado"` no diff (`lib/diff.js`).
- Rotas de substituir planilha de um período e excluir relatório em rascunho.
- Suíte de testes (Vitest) e CI configurados.

Se algo faltar, **pare e avise o usuário em texto no chat** (não use UI de
pergunta — não renderiza para ele) qual pré-requisito está faltando, em vez
de assumir que existe ou reimplementá-lo por conta própria.

## O sistema

Portal interno (React + Vite + Tailwind, Express, Prisma + Postgres/Auth/
Storage do Supabase, Anthropic SDK) onde o escritório sobe a planilha mensal
de processos de cada cliente, o sistema faz o diff com o mês anterior, gera
destaques com IA e produz um `.docx` executivo versionado por cliente.
Arquivos centrais: `server/app.js`, `lib/xlsx-parser.js`, `lib/ai.js`,
`prisma/schema.prisma`, `src/pages/*.jsx`.

## Por que esta fase

Depois da Fase 0 o dado está correto, mas o sistema ainda exige que o
próprio desenvolvedor conserte planilhas com colunas fora do padrão e que a
análise de IA rode síncrona (risco de timeout). Esta fase resolve isso e dá
ao escritório uma visão de "o que falta fazer este mês" — sem ainda tocar na
experiência do cliente final (isso é Fase 2).

## Regras gerais de execução

- Commits pequenos e focados por tarefa, seguindo o estilo já usado no
  histórico (mensagens curtas, em português, focadas no efeito para quem usa).
- Não dê push sem confirmar antes com o usuário.
- Rode `npm run dev` e teste manualmente cada fluxo alterado, seguindo
  `COMO_TESTAR.md` — sobretudo o mapeador de colunas (item 1) e o polling da
  análise assíncrona (item 2), que são fluxos novos sem precedente na UI atual.
- Não implemente itens de outras fases (nada de envio por e-mail, PDF, portal
  do cliente, alertas de IA — isso é Fase 2/3/4).

## Tarefas (nesta ordem)

### 1. Conferência da leitura + mapeador de colunas (R3)
- Depois do parse (`parseSpreadsheet` em `lib/xlsx-parser.js`), adicione uma
  sub-etapa no wizard ("Confira a leitura"): mostra uma amostra das primeiras
  linhas lidas e quais colunas foram reconhecidas/ignoradas
  (`detectHeaderRow` já expõe `headersFound`/`columnIndex` — exponha isso na
  resposta da rota de upload em vez de descartar).
- Se faltar uma coluna esperada (ex.: `valor` não reconhecido), ofereça UI de
  mapeamento manual: dropdown "coluna da planilha" → "campo do sistema"
  (`numero`, `parte`, `area`, `valor`, `provisao`, `status`, `probabilidade`).
- Adicione `columnMapping Json?` em `Client` (`prisma/schema.prisma`) para
  guardar o mapeamento manual mais recente daquele cliente.
- Modifique `parseSpreadsheet` para aceitar um mapeamento explícito opcional
  que pula a autodetecção (`detectHeaderRow`) quando fornecido; ao subir uma
  planilha, se o cliente já tiver `columnMapping` salvo, aplique-o
  automaticamente antes de tentar a autodetecção — o usuário só mapeia uma
  vez por cliente, planilhas seguintes já vêm certas.
- Rota para salvar/atualizar o mapeamento (`PATCH /api/clients/:id` com
  `columnMapping`, ou rota dedicada).

### 2. Análise de IA fora do ciclo request/response (R4)
- Curto prazo: configure `maxDuration` da função da rota de análise na
  Vercel (`vercel.json` ou config da função em `api/index.js`) para o máximo
  permitido pelo plano do usuário — **pergunte ao usuário, em texto no chat,
  qual é o plano da Vercel** (Hobby/Pro/Enterprise) antes de assumir um valor,
  já que isso define o teto real.
- Estrutural: `POST /api/reports/:id/analyze` passa a responder imediatamente
  marcando o report com um novo campo `status: "analisando"` (adicione esse
  valor possível ao campo `status` do `Report`) e dispara a chamada à
  Anthropic. **Atenção a uma limitação real do ambiente serverless da
  Vercel**: o processo pode ser congelado assim que a resposta HTTP é
  enviada, então "continuar processando em background após responder" não é
  garantido nesse runtime. Antes de implementar, investigue e documente qual
  destas abordagens é viável no setup atual (`vercel.json`, versão do
  `@vercel/node` em uso):
  - `waitUntil` do runtime da Vercel, se disponível na versão usada;
  - separar a análise numa function própria disparada de forma assíncrona
    (ex.: a própria rota chama a si mesma via fetch "fire and forget" antes
    de responder, ou um endpoint separado acionado por webhook/fila leve);
  - se nenhuma for viável no prazo, documente a limitação claramente no
    código e no relatório final da fase, e entregue só o aumento de
    `maxDuration` (item acima) como mitigação temporária.
- Frontend (`NovoRelatorio.jsx`, step 4): ao rodar a análise, faça polling em
  `GET /api/reports/:id` até `narrativas` chegar ou `status` indicar erro,
  em vez de esperar a resposta da chamada original ficar pendurada.

### 3. Dashboard inicial com ciclo mensal (F5)
- Nova página (ex. `src/pages/Dashboard.jsx`) mostrando, para o período
  corrente (mês atual), o status de cada cliente: relatório pronto, em
  rascunho, ou sem relatório ainda naquele período — com atalho direto para
  continuar/gerar.
- Endpoint novo (ou extensão de `GET /api/clients`) que agrega, por cliente,
  o status do `Report` cujo `periodo` é o período corrente.
- Trocar a rota raiz (`App.jsx`, hoje `/` → `/historico`) para apontar para
  o novo dashboard; adicionar item de navegação em `Layout.jsx`.

### 4. Filtros no histórico + unificação do wizard (F8)
- `Historico.jsx`: adicionar filtro por período (`periodo`) e por status,
  além da busca por cliente já existente. Se o volume de dados ainda for
  pequeno, filtro client-side está OK (mesma abordagem já usada na busca por
  cliente); anote no código se isso deveria virar filtro no backend quando o
  histórico crescer.
- `NovoRelatorio.jsx`: unificar os steps 0 ("Cliente") e 1 ("Upload") em uma
  única tela — seleção de cliente + período + input de arquivo na mesma
  etapa. Ajuste o array `STEPS` de 6 para 5 passos.

### 5. Monitoramento de erros
- Adicionar Sentry (ou alternativa leve equivalente) no backend
  (`server/app.js`, no middleware de erro existente no fim do arquivo) e no
  frontend (`src/main.jsx`, via `ErrorBoundary.jsx` já existente).
- Deixar opcional via variável de ambiente (`SENTRY_DSN` vazio = desativado),
  seguindo o mesmo padrão de "modo mock sem quebrar" já usado para
  `ANTHROPIC_API_KEY` em `lib/ai.js`.

## Critério de aceite da fase

- Uma planilha com uma coluna de nome fora do padrão (ex.: "Valor da
  demanda") é resolvida pelo usuário na própria UI, sem precisar pedir ajuda
  ao desenvolvedor; a planilha seguinte do mesmo cliente já aplica o mapeamento
  salvo automaticamente.
- Uma análise de IA com muitos anexos/movimentações completa sem estourar o
  timeout da função serverless (ou, se a limitação de runtime não foi
  totalmente resolvida, isso está documentado com clareza).
- Ao abrir o portal, o usuário vê imediatamente quais clientes ainda faltam
  ter relatório gerado no mês corrente.
- Histórico filtra por mês e status; o wizard tem 5 passos em vez de 6.
- Erros em produção (backend e frontend) chegam ao monitoramento configurado.
- `npm test` continua passando; o fluxo completo do `COMO_TESTAR.md` continua
  funcionando de ponta a ponta.

## Ao terminar

Resuma o que foi feito por tarefa (1–5), o que ficou pendente (em especial
se a análise assíncrona não foi 100% resolvida por limitação de runtime), e
pergunte ao usuário — **em texto no chat** — se ele quer seguir para a Fase 2
(experiência do cliente final) do `PLANO_EVOLUCAO.md`.
