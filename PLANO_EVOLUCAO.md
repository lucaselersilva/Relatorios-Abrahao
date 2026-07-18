# Plano de Evolução — Portal de Relatórios Abrahão

> Análise profunda do sistema em 17/07/2026, com reestruturações, novas
> funcionalidades e um roteiro faseado. Companheiro do `COMO_TESTAR.md`.

## 1. O sistema hoje (diagnóstico)

**O que é:** portal interno do escritório para transformar a planilha mensal de
acompanhamento processual de cada cliente em um relatório executivo `.docx`,
com diff automático mês a mês, análise de IA (Claude) e versionamento por
cliente.

**Fluxo:** Cliente → Upload da planilha → "O que mudou" (diff) → Documentos de
apoio (PDFs) → Análise da IA → Relatório final (.docx) → Histórico/página do
cliente.

**Stack:** React 18 + Vite + Tailwind · Express 5 (função serverless na
Vercel) · Prisma 7 + Postgres/Auth/Storage do Supabase · Anthropic SDK
(claude-opus-4-8) · docx + sharp (relatório visual) · exceljs (parser) ·
pdf-parse (anexos).

**Pontos fortes:** wizard claro e enxuto; diff estruturado (novo / alteração /
acordo, com prioridade); relatório final visual de qualidade; versionamento
por cliente com linha do tempo; modo mock da IA para desenvolver sem chave;
código limpo, comentado e consistente.

**Limitação estrutural:** o produto termina no download do `.docx`. Toda a
experiência do cliente final (quem recebe o relatório) acontece fora do
sistema — envio manual, sem visualização online, sem histórico acessível a
ele. É a maior oportunidade de evolução.

## 2. Problemas encontrados (por gravidade)

### Críticos — corrigir antes de qualquer funcionalidade nova

| # | Problema | Onde | Efeito |
|---|----------|------|--------|
| C1 | `mesReferencia` é texto livre e o "mês anterior" do diff é escolhido por `uploadedAt`, não pelo período real | `server/app.js` (upload, `computeReportInsights`), `NovoRelatorio.jsx` | Meses enviados fora de ordem (backfill) comparam contra a base errada; formatos inconsistentes ("Junho/2026" vs "06/2026") quebram a unicidade por mês |
| C2 | Diff não detecta **processos encerrados/baixados** (presentes no mês anterior, ausentes no atual) | `lib/diff.js` | Encerramento — informação juridicamente relevante — simplesmente some do relatório |
| C3 | Sem caminho de correção: mês duplicado retorna 409 sem opção de substituir; não há excluir rascunho/upload errado | `server/app.js` | Um upload errado trava o mês do cliente para sempre |
| C4 | Usuário não confere o que o parser leu; coluna não reconhecida (ex.: "Valor da demanda") vira dado nulo silencioso | `lib/xlsx-parser.js`, wizard | KPIs errados (R$ 0) sem aviso; hoje o fallback é "avisar o dev para adicionar sinônimo" |
| C5 | Análise da IA (Opus, effort high) roda dentro de uma função serverless — pode estourar o timeout da Vercel | `api/index.js`, `lib/ai.js` | Análise falha em produção com planilhas/anexos maiores |
| C6 | Arquivos reais de clientes versionados no git (`uploads/*.xlsx/.docx/.pdf`, resquício do storage local) | repo | Risco de vazamento de dados de processos; estão no histórico do git |

### Importantes

- **Segurança/robustez da API:** `DELETE .../attachments/:attachmentId` não
  valida que o anexo pertence ao report; `PATCH /api/reports/:id` aceita
  qualquer JSON em `narrativas`/`selecionados` sem validação; anexos aceitam
  qualquer tipo de arquivo (só PDFs são lidos, sem aviso ao usuário).
- **Zero testes automatizados** justamente nas partes mais frágeis e puras
  (parser de planilha, diff, geração do docx — que já teve bug de corrupção,
  commit `f41ef4f`).
- **Sem monitoramento:** erros só em `console.error`; em produção ninguém
  sabe quando a análise ou o upload falhou.
- **Limpeza de repo:** `portal_prototype_1.jsx` (protótipo legado na raiz),
  pasta `uploads/` morta, `.docx` de exemplo versionado.

### Menores

- Histórico só busca por cliente (sem filtro de mês/status).
- Layout não responsivo (sidebar fixa, grids de 4–5 colunas).
- Etapas 0 e 1 do wizard poderiam ser uma só tela.
- Sem paginação (ok na escala atual; anotar para o futuro).

## 3. Reestruturações propostas

### R1. Período como dado de verdade (resolve C1)
- Novo campo `periodo` (ex.: `"2026-06"`) em `Upload`/`Report`; `mesReferencia`
  vira só rótulo de exibição derivado.
- Month picker no wizard (`<input type="month">` estilizado).
- Diff e KPIs "vs. mês anterior" passam a buscar o **período imediatamente
  anterior**, não o último upload.
- Migração: backfill dos registros existentes parseando `mesReferencia`.

### R2. Ciclo de vida completo do upload/relatório (resolve C3)
- Rota `PUT /api/reports/:id/spreadsheet` (substituir planilha do mês, refaz
  diff e volta o report para rascunho).
- `DELETE` de report em rascunho (cascata: upload + processos + anexos +
  arquivos no Storage).
- No 409 de mês duplicado, o frontend oferece "Substituir planilha deste mês"
  ou "Abrir o relatório existente".

### R3. Conferência da leitura + mapeador de colunas (resolve C4)
- Após o parse, nova sub-etapa "Confira a leitura": amostra das primeiras
  linhas lidas + colunas reconhecidas/ignoradas.
- Se faltar coluna esperada, UI de mapeamento manual (dropdown coluna da
  planilha → campo do sistema).
- Mapeamento salvo por cliente (`Client.columnMapping` JSON) e reaplicado nos
  meses seguintes — cada planilha "estranha" só precisa ser mapeada uma vez.

### R4. Análise da IA fora do request/response (resolve C5)
- Curto prazo: `maxDuration` na função da Vercel + retry no frontend.
- Estrutural: análise vira job assíncrono — `POST /analyze` marca
  `status: "analisando"` e retorna; frontend faz polling (`GET /api/reports/:id`)
  até `narrativas` chegar. Sem infra nova (o próprio Postgres guarda o estado).

### R5. Saneamento do repositório (resolve C6)
- Remover `uploads/` do índice e do histórico do git (`git filter-repo`),
  adicionar ao `.gitignore`. **Antes: confirmar se os arquivos são de clientes
  reais** — se sim, tratar como incidente (histórico já foi para o remoto?).
- Remover `portal_prototype_1.jsx`; mover `.docx` de exemplo para fora do git
  ou gerar sob demanda (`npm run exemplos`).

### R6. Rede de segurança de qualidade
- Vitest + fixtures reais: parser (variações de cabeçalho, valores BR,
  linhas de título antes do header), diff (novo/alterado/acordo/encerrado),
  KPIs/panorama.
- Teste de sanidade do docx (gera e valida estrutura do zip/XML).
- Validação de payload com zod nas rotas de escrita; checagem de vínculo
  report↔anexo no delete; allowlist de extensões nos anexos.
- GitHub Actions (lint + testes) e Sentry (ou similar) na API e no frontend.

## 4. Novas funcionalidades

### Experiência do cliente final (maior salto de valor)
| # | Funcionalidade | Descrição | Valor |
|---|----------------|-----------|-------|
| F1 | **Exportar PDF** além do .docx | Mesmo layout; cliente abre no celular sem Word | Alto, esforço médio |
| F2 | **Link seguro de visualização** | URL assinada e com validade para a versão web do relatório (a página `RelatorioVisualizar` já existe!) — sem login para o cliente | Alto, esforço baixo/médio |
| F3 | **Envio por e-mail na finalização** | Relatório (PDF + link) enviado ao contato do cliente, com registro de envio | Alto |
| F4 | **Portal do cliente** | Login próprio (role `cliente` no Supabase Auth vinculado a `clientId`), dashboard read-only: KPIs, evolução, histórico de relatórios, download | Muito alto, esforço alto — transforma o produto em serviço |

### Experiência interna
| # | Funcionalidade | Descrição |
|---|----------------|-----------|
| F5 | **Dashboard home + ciclo mensal** | Visão do mês corrente: "Julho: 3 de 8 clientes com relatório pronto", rascunhos pendentes, atalhos. Substitui o Histórico como página inicial |
| F6 | **Gráfico de evolução do cliente** | Série mensal de valor envolvido/provisão/nº de processos na página do cliente (dados já existem nos uploads) e no próprio relatório |
| F7 | **Página do processo** | Timeline de um processo (por número) através dos meses: valores, status, anexos — os dados já estão em `Processo` por upload |
| F8 | **Filtros no histórico** | Por mês de referência e status, além da busca por cliente |
| F9 | **Contatos do cliente** | Nome/e-mail dos destinatários no cadastro (pré-requisito de F3/F4) |

### Inteligência
| # | Funcionalidade | Descrição |
|---|----------------|-----------|
| F10 | **Sumário executivo em prosa + recomendações** | Além dos destaques em cartões, um parágrafo de abertura e uma seção "Pontos de atenção" (provisão desalinhada, alto valor sem provisão, concentração por área) |
| F11 | **Ler anexos .docx e PDFs escaneados** | mammoth para .docx; PDFs sem texto extraível vão direto para a API do Claude (suporte nativo a PDF/visão) em vez de `pdf-parse` |
| F12 | **Regenerar destaque / instrução custom** | Botão "regenerar" por cartão e campo "instruções para a IA" antes da análise |
| F13 | **Alertas automáticos** | Regras determinísticas pós-upload (novo processo ≥ R$ X, provisão caiu > Y%, processo sumiu sem status de encerramento) exibidas no wizard e no dashboard |
| F14 | **Perguntas sobre a carteira** (futuro) | Chat "quais processos trabalhistas acima de R$ 500 mil pioraram no trimestre?" sobre os dados estruturados |

## 5. Roteiro faseado

### Fase 0 — Fundamentos (1 sprint, ~1 semana)
Pré-requisito de tudo; nada aqui é visível para o cliente final, mas elimina
os riscos de dado errado/vazamento.
1. R5 saneamento do repo (primeiro — quanto mais commits, pior o rewrite).
2. R1 período normalizado + month picker + migração.
3. C2 diff de encerrados (`tipo: "encerrado"`, badge própria, entra no docx).
4. R2 substituir/excluir upload.
5. R6 testes de parser/diff/KPIs + CI.
6. Endurecimento da API (zod, vínculo anexo↔report, allowlist de anexos).

**Aceite:** backfill de mês antigo compara com o período certo; upload errado
é substituível pela UI; processo removido da planilha aparece como
"Encerrado"; `npm test` verde no CI; nenhum arquivo de cliente no git.

### Fase 1 — Confiança no dado + produtividade interna (~1–2 semanas)
1. R3 conferência da leitura + mapeador de colunas com template por cliente.
2. R4 análise assíncrona + `maxDuration`.
3. F5 dashboard home com ciclo mensal.
4. F8 filtros do histórico; unificar etapas 0–1 do wizard.
5. Sentry/monitoramento.

**Aceite:** planilha com coluna fora do padrão é resolvida pelo usuário sem
tocar em código; análise de um caso grande completa sem timeout; ao abrir o
portal o usuário vê o que falta gerar no mês.

### Fase 2 — Experiência do cliente final (~2 semanas)
1. F9 contatos do cliente.
2. F1 exportação PDF (mesmo layout do docx).
3. F2 link seguro de visualização web do relatório.
4. F3 envio por e-mail na finalização (Resend/SES) com registro.
5. F6 gráfico de evolução na página do cliente e no relatório.

**Aceite:** ao finalizar, o advogado clica "Enviar ao cliente" e o cliente
recebe e-mail com PDF + link que abre no celular; a página do cliente mostra
a evolução mensal da carteira.

### Fase 3 — Inteligência (~2 semanas, paralelizável com a Fase 2)
1. F10 sumário executivo + pontos de atenção no relatório.
2. F11 leitura de .docx e PDFs escaneados.
3. F12 regenerar destaque / instruções custom.
4. F13 alertas automáticos pós-upload.

### Fase 4 — Portal do cliente (F4) (~3–4 semanas, decisão de produto)
1. Modelo de acesso: role `cliente` + vínculo `userId↔clientId`; toda rota
   passa a filtrar por tenant (e/ou RLS no Supabase).
2. Área logada read-only: dashboard, relatórios, download.
3. F7 página do processo (vale para os dois públicos).
4. Auditoria de acesso (quem viu o quê, quando) — relevante para LGPD.

## 6. Decisões em aberto (para o Lucas)

1. **Prioridade de produto:** depois da Fase 0, o que vem primeiro — melhorar
   a operação interna (Fase 1) ou a experiência do cliente final (Fase 2)?
   O plano assume interna primeiro porque a confiança no dado precede o envio
   automático, mas dá para inverter parcialmente.
2. **Formato de entrega ao cliente:** o `.docx` editável é requisito (o
   escritório retoca antes de enviar?) ou o PDF/web pode virar o formato
   principal?
3. **Plano da Vercel:** qual é o limite de duração das funções hoje? Define se
   o `maxDuration` resolve ou se a análise assíncrona é urgente.
4. **`uploads/` no git:** os arquivos são de clientes reais? Se sim, o rewrite
   do histórico e a rotação do remoto viram prioridade imediata.
5. **Portal do cliente:** é a visão do escritório para o produto (justifica a
   Fase 4) ou o relatório enviado é o produto final?
