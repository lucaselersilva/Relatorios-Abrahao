# Prompt de implementação — Fase 0 (Fundamentos)

> Cole este prompt inteiro numa sessão do Claude Code (pode ser uma sessão nova,
> sem histórico da conversa que gerou o plano) rodando na raiz deste repositório.
> Ele é autossuficiente: contém o contexto necessário para a Fase 0 do
> `PLANO_EVOLUCAO.md` sem depender de nada dito antes.

---

Você vai implementar a **Fase 0 ("Fundamentos")** do plano de evolução deste
projeto, descrito em `PLANO_EVOLUCAO.md` (leia o arquivo inteiro antes de
começar — este prompt resume as tarefas, mas o plano tem o diagnóstico
completo). Antes de tocar em código, leia também `COMO_TESTAR.md` para saber
como rodar e validar o fluxo manualmente.

## O sistema

Portal interno (React + Vite + Tailwind no front, Express na API, Prisma +
Postgres/Auth/Storage do Supabase, Anthropic SDK para a análise de IA) onde o
escritório sobe a planilha mensal de processos de cada cliente, o sistema
compara com o mês anterior (diff), gera destaques com IA e produz um
relatório executivo `.docx` versionado por cliente. Arquivos centrais:
`server/app.js` (rotas), `lib/diff.js`, `lib/xlsx-parser.js`, `lib/ai.js`,
`lib/docx-generator.js`, `prisma/schema.prisma`, `src/pages/*.jsx`.

## Por que esta fase primeiro

Nenhuma funcionalidade nova (portal do cliente, envio por e-mail, dashboards)
vale a pena construir em cima de um diff que compara o mês errado ou de um
repositório com dados de cliente vazados. A Fase 0 não é visível para
ninguém — é a base que torna as fases seguintes seguras.

## Regras gerais de execução

- **Commits pequenos e focados por tarefa**, nunca um commit gigante com tudo.
  Siga o estilo dos commits já existentes (`git log --oneline`): mensagens
  curtas, em português, descrevendo o efeito para quem usa o sistema.
- **Não dê push** sem confirmar com o usuário antes — o remoto é
  `github.com/lucaselersilva/Relatorios-Abrahao` e há trabalho em andamento lá.
- **Não rode nenhum comando que reescreva o histórico do git**
  (`filter-repo`, `filter-branch`, `push --force`) sem antes: (1) checar com
  o usuário, em texto no chat, se os arquivos em `uploads/` (`*.xlsx`, `*.docx`,
  `*.pdf`) são de clientes reais, e (2) informar que esse remoto já existe e
  perguntar se o repositório no GitHub é privado. Esses arquivos estão no
  commit inicial (`5f33387`) — se já foram enviados ao GitHub, o rewrite
  sozinho não resolve a exposição (pode já ter sido clonado/indexado); nesse
  caso é uma decisão do usuário, não sua, sobre como tratar o incidente.
  **Pergunte em texto no chat, não use a ferramenta de pergunta com UI** — ela
  não renderiza para este usuário.
- Rode `npm run dev` e teste manualmente os fluxos que você alterar (login →
  upload → diff → análise → finalizar), seguindo o roteiro do
  `COMO_TESTAR.md`. Type-check/testes automatizados verificam correção de
  código, não da experiência — teste a UI de verdade quando mexer nela.
- Não implemente nada das Fases 1–4 do plano (dashboard, portal do cliente,
  envio por e-mail, PDF, etc.) — fora de escopo aqui.

## Tarefas (nesta ordem)

### 1. Saneamento do repositório
- Remover `portal_prototype_1.jsx` (protótipo legado, não usado pelo app —
  confirme com `grep` que nada importa dele antes de apagar).
- Parar de versionar `uploads/` (adicionar ao `.gitignore`) e remover os
  arquivos do working tree do git (`git rm --cached`). Isso resolve o commit
  *daqui para frente*; o histórico existente só deve ser reescrito depois da
  conversa com o usuário descrita acima.
- Confirmar que `exemplos/*.docx` gerado por `npm run exemplos` realmente
  precisa estar versionado (o `COMO_TESTAR.md` assume que sim, como referência
  de layout) — pode manter, mas registre a dúvida se achar que deveria ser
  gerado sob demanda em vez de commitado.

### 2. Período como dado de verdade (resolve o diff comparar o mês errado)
- Adicionar campo `periodo` (string `"YYYY-MM"`) em `Upload` e `Report` no
  `prisma/schema.prisma`, mantendo `mesReferencia` só como rótulo de exibição.
- Migração Prisma que faz backfill de `periodo` a partir do `mesReferencia`
  existente (parseie os formatos já usados nos dados de exemplo/seed, ex.
  "Junho/2026" → "2026-06"; trate formatos que não derem para parsear sem
  quebrar a migração).
- `server/app.js`: todo lugar que hoje busca "o upload anterior" por
  `orderBy: { uploadedAt: "desc" }` (`computeReportInsights`, rota de
  upload) passa a filtrar/ordenar por `periodo < periodoAtual` — o mês
  anterior real, não o último upload por data de criação.
- `@@unique([clientId, mesReferencia])` em `Upload` vira
  `@@unique([clientId, periodo])`.
- Frontend (`NovoRelatorio.jsx`): trocar o input de texto livre de mês por um
  `<input type="month">` (ou seletor equivalente), gerando tanto `periodo`
  quanto o `mesReferencia` de exibição a partir dele.

### 3. Diff detecta processos encerrados
- Em `lib/diff.js`, `computeDiff` hoje só itera `processosAtuais` — adicione
  a detecção do caso inverso: processo presente em `processosAnteriores` e
  ausente em `processosAtuais` vira uma movimentação `tipo: "encerrado"`
  (resumo tipo "Processo não consta mais na carteira — provável
  encerramento/baixa.").
- Propague o novo tipo: badge no wizard (`NovoRelatorio.jsx`,
  `RelatorioVisualizar.jsx`), contagem em `resumirMovimentacoes`
  (`server/app.js`) e `porTipo` em `ClienteDetalhe.jsx`, e representação no
  `.docx` (`lib/docx-generator.js` — mesma tabela de movimentações, cor
  própria, coerente com a paleta existente).
- Decida a prioridade (`alta`/`media`) do tipo `encerrado` seguindo o
  critério já usado para os outros tipos (valor envolvido alto = prioridade
  alta) e documente a escolha no código só se não for óbvia.

### 4. Ciclo de vida do upload/relatório
- Nova rota para **substituir a planilha de um período já enviado**: recebe
  novo arquivo, re-parseia, refaz o diff contra o período anterior, atualiza
  `Upload`/`Processo` e volta o `Report` daquele período para
  `status: "rascunho"` (limpando `narrativas`/`docxKey` antigos, já que não
  valem mais). Reaproveite `parseSpreadsheet`/`computeDiff` — não duplique
  lógica da rota de upload original.
- Nova rota para **excluir um relatório em rascunho** (cascata: `Report` →
  `Attachment`s e arquivos correspondentes no Storage; se for o único report
  daquele `Upload`, apague o `Upload` e seus `Processo`s também). Bloqueie
  (400) a exclusão de relatórios com `status: "pronto"`.
- No frontend, quando o upload retornar 409 (mês duplicado), ofereça as duas
  opções na UI: "Substituir planilha deste período" (chama a rota nova) ou
  "Abrir o relatório existente" (navega para ele).

### 5. Testes automatizados + CI
- Adicionar Vitest ao projeto (`devDependencies`, script `npm test`).
- Testes de `lib/xlsx-parser.js`: variações de nome de cabeçalho, valores em
  formato BR (`1.234,56`), cabeçalho fora da primeira linha, planilha sem
  coluna de processo (deve lançar erro com mensagem clara).
- Testes de `lib/diff.js`: processo novo, alteração de valor/provisão/status,
  detecção de acordo pelo status, e o novo caso de encerramento (item 3).
- Teste de sanidade de `lib/docx-generator.js`: gera um buffer com dados de
  exemplo e valida que é um zip válido com as partes XML esperadas (não
  precisa validar o layout visualmente, só que não corrompe — releia o
  commit `f41ef4f` para entender o tipo de bug que já aconteceu aqui).
- GitHub Actions (`.github/workflows/ci.yml`): `npm ci` + `npm test` (+ lint,
  se houver) em push/PR.

### 6. Endurecimento da API
- `DELETE /api/reports/:id/attachments/:attachmentId`: validar que o anexo
  pertence ao `reportId` da URL antes de apagar (hoje apaga por
  `attachmentId` isolado).
- Validação de payload com zod (ou similar leve) nas rotas de escrita —
  pelo menos `PATCH /api/reports/:id` (`narrativas`/`selecionados`) e
  `POST /api/clients`.
- Allowlist de mimetype/extensão nos anexos (`POST
  /api/reports/:id/attachments`) — hoje aceita qualquer arquivo; restrinja a
  PDF/imagens/docx e rejeite o resto com mensagem clara.

## Critério de aceite da fase

- Um upload de mês antigo (backfill) compara corretamente contra o período
  anterior real, não contra o último upload por data.
- Um processo que sai da planilha aparece como "Encerrado" no diff, no
  wizard e no `.docx`.
- É possível substituir a planilha de um período já enviado e excluir um
  relatório em rascunho, tudo pela UI.
- `npm test` roda e passa localmente e no CI.
- Nenhum arquivo de cliente (`uploads/*`) é adicionado por commits novos;
  decisão sobre o histórico existente foi conversada com o usuário antes de
  qualquer rewrite.
- O fluxo completo do `COMO_TESTAR.md` (cliente → upload → diff → anexos →
  IA → relatório → página do cliente) continua funcionando de ponta a ponta
  depois de todas as mudanças.

## Ao terminar

Resuma o que foi feito por tarefa (1–6), liste o que ficou pendente ou foi
adiado e por quê, e pergunte ao usuário — **em texto no chat** — se ele quer
seguir para a Fase 1 (produtividade interna) ou Fase 2 (experiência do
cliente final) do `PLANO_EVOLUCAO.md`, já que essa ordem é uma decisão de
produto em aberto (seção 6 do plano).
