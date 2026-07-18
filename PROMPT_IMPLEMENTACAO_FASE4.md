# Prompt de implementação — Fase 4 (Portal do cliente)

> Cole este prompt inteiro numa sessão do Claude Code (pode ser sessão nova,
> sem histórico de conversa anterior) rodando na raiz deste repositório. É
> autossuficiente, mas pressupõe que as **Fases 0, 1 e 2**
> (`PROMPT_IMPLEMENTACAO_FASE0.md`, `FASE1.md`, `FASE2.md`) já foram
> implementadas — em especial os contatos do cliente (F9) e o link seguro de
> visualização (F2), que esta fase reaproveita.

---

## Antes de tudo: confirme que esta fase deve acontecer

Esta é a fase de **maior esforço e maior mudança de modelo de acesso** do
plano (login próprio para clientes do escritório, com isolamento de dados
por tenant). O `PLANO_EVOLUCAO.md`, seção 6, marca isso como decisão de
produto em aberto: *"o portal do cliente é a visão do escritório para o
produto, ou o relatório enviado (Fase 2) já é o produto final?"*

**Não comece a codar sem antes perguntar ao usuário, em texto no chat** (não
use UI de pergunta — não renderiza para ele), se essa decisão já foi tomada
e confirmada. Se a resposta for "não" ou incerta, pare e não prossiga — as
fases anteriores já entregam valor sozinhas.

## O sistema

Hoje só existe um tipo de usuário (advogado/staff do escritório), autenticado
via Supabase Auth, com acesso total a todos os clientes (`lib/auth.js`,
`requireAuth`). Não há conceito de "usuário vinculado a um cliente
específico" em lugar nenhum do código.

## Por que isto é sensível

Um bug de isolamento aqui vaza processos jurídicos de um cliente do
escritório para outro — dado confidencial, com implicação de LGPD. Trate
esta fase com o rigor de uma mudança de segurança, não de uma feature comum.

## Regras gerais de execução

- Commits pequenos e focados por tarefa; não dê push sem confirmar antes.
- **Prefira rotas públicas do portal do cliente completamente separadas das
  rotas internas** (ex. `/api/portal/*` vs `/api/*`), em vez de adicionar
  filtro de tenant nas rotas internas existentes — é mais fácil garantir
  isolamento numa superfície nova e pequena do que auditar cada rota
  existente para não esquecer um filtro.
- Ao terminar as tarefas de acesso (1 e 2), rode explicitamente uma sessão de
  revisão de segurança focada em isolamento entre clientes antes de
  considerar a fase pronta (invoque o skill `security-review` deste projeto,
  ou faça uma revisão equivalente manual se não disponível) — não pule essa
  etapa mesmo sob pressão de prazo.
- Teste manualmente logado como dois clientes diferentes (ou um cliente e um
  usuário interno) confirmando que nenhum dado cruza.

## Tarefas (nesta ordem)

### 1. Modelo de acesso por cliente
- Defina como o vínculo usuário↔cliente é representado. Duas opções
  razoáveis — escolha uma e documente a razão:
  (a) tabela `ClientUser` (Prisma) ligando um `id` de usuário do Supabase Auth
  a um `clientId`, com papel (`role: "cliente"`) guardado em
  `user_metadata.role` no próprio Supabase Auth;
  (b) só `user_metadata` no Supabase Auth (`role` + `clientId`), sem tabela
  extra no Prisma. Prefira (a) se antever um cliente com múltiplos usuários
  ou um usuário associado a múltiplos clientes; (b) é mais simples se for
  sempre 1:1.
- Middleware novo (`lib/auth.js` ou arquivo dedicado) equivalente ao
  `requireAuth`, mas que resolve e expõe `req.clientId` para as rotas do
  portal do cliente, retornando 401/403 se o usuário não tiver vínculo.
- Como convidar/criar o acesso de um cliente: tela ou rota interna (staff)
  para gerar o convite/senha inicial do contato do cliente (reaproveite
  `Contact` da Fase 2 como candidato a virar usuário do portal).

### 2. Rotas e páginas do portal do cliente (read-only)
- Namespace de API novo, ex. `/api/portal/*`, cada rota já filtrando
  implicitamente por `req.clientId` do middleware (nunca aceitando
  `clientId` vindo do client-side sem cruzar com o da sessão):
  - `GET /api/portal/dashboard` — KPIs atuais + evolução (reaproveita a
    lógica de `GET /api/clients/:id` e F6 da Fase 2, mas escopado ao próprio
    cliente, sem exigir `requireAuth` interno);
  - `GET /api/portal/reports` — lista de versões do próprio cliente;
  - `GET /api/portal/reports/:id` — detalhe de um relatório (reaproveite
    `computeReportInsights`), com checagem extra de que aquele `report.clientId`
    é igual ao `req.clientId` da sessão antes de retornar qualquer dado;
  - download do `.docx`/PDF via URL assinada, mesma checagem de posse acima.
- Frontend: app ou seção de rotas nova (fora do `ProtectedRoute` interno em
  `App.jsx`), com layout próprio mais simples (sem a navegação de staff em
  `Layout.jsx`) — dashboard, lista de relatórios, visualização (reaproveita
  o miolo visual de `RelatorioVisualizar.jsx`), download.
- Login do cliente: pode reaproveitar `Login.jsx` com uma variação de rota,
  redirecionando para `/portal/*` quando o papel do usuário autenticado for
  `cliente` em vez de staff.

### 3. Página do processo (F7)
- Nova página (uso tanto interno quanto no portal do cliente): timeline de
  um número de processo específico através dos períodos — cruze todos os
  `Processo` com o mesmo `numero` pertencentes a `Upload`s do mesmo cliente,
  ordenados por `periodo`, mostrando evolução de valor/provisão/status e os
  anexos relacionados àquele número (via `Attachment.processoNumero`).
- Rota interna (`/processos/:numero?clientId=...`) e rota do portal
  (`/portal/processos/:numero`, escopada automaticamente ao `req.clientId`).

### 4. Auditoria de acesso
- Novo modelo `AccessLog` (Prisma): `userId`/`email`, `role`, `action`
  (ex. `"view_report"`, `"download"`), `clientId`, `reportId?`, `timestamp`.
- Registre pelo menos as ações do portal do cliente (visualização e
  download) — é o que mais importa para responder "quem viu o quê" numa
  eventual solicitação de titular de dados (LGPD).
- Tela interna simples para o staff consultar o log de um cliente
  específico (não precisa de UI sofisticada nesta fase).

## Critério de aceite da fase

- Um usuário do portal do cliente loga e só vê dados do próprio cliente —
  testado explicitamente tentando acessar (via URL direta) um relatório de
  outro cliente e recebendo 403/404.
- Dashboard, lista de relatórios, visualização, download e página do
  processo funcionam no portal do cliente com os mesmos dados que o staff vê
  internamente para aquele cliente.
- Toda visualização/download no portal do cliente fica registrada no log de
  auditoria.
- Uma revisão de segurança focada em isolamento entre tenants foi feita e
  não encontrou vazamento cross-client.
- `npm test` continua passando; fluxo interno do `COMO_TESTAR.md` continua
  íntegro (o portal do cliente é aditivo, não deve quebrar o fluxo do staff).

## Ao terminar

Resuma o que foi feito por tarefa (1–4), a decisão tomada no modelo de
acesso (item 1) e o resultado da revisão de segurança. Esta é a última fase
do `PLANO_EVOLUCAO.md` — não há próxima fase para perguntar, mas liste
qualquer item que ficou como dívida técnica ou stretch goal para o usuário
decidir se vale priorizar depois.
