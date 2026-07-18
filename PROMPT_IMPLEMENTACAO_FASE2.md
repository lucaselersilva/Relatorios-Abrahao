# Prompt de implementação — Fase 2 (Experiência do cliente final)

> Cole este prompt inteiro numa sessão do Claude Code (pode ser sessão nova,
> sem histórico de conversa anterior) rodando na raiz deste repositório. É
> autossuficiente, mas pressupõe que as **Fases 0 e 1**
> (`PROMPT_IMPLEMENTACAO_FASE0.md`, `PROMPT_IMPLEMENTACAO_FASE1.md`) já foram
> implementadas.

---

Você vai implementar a **Fase 2 ("Experiência do cliente final")** do plano
de evolução deste projeto, descrito em `PLANO_EVOLUCAO.md` (leia o arquivo
inteiro antes de começar). Leia também `COMO_TESTAR.md`.

## Pré-requisitos — confira antes de começar

Verifique no código que já existem: período normalizado (`periodo` em
`Upload`/`Report`), diff com tipo `"encerrado"`, mapeador de colunas por
cliente, e (idealmente) análise de IA assíncrona. Se algo essencial faltar,
avise o usuário em texto no chat antes de prosseguir — esta fase constrói
sobre esses dados.

## O sistema

Portal interno onde o escritório sobe a planilha mensal de processos, o
sistema faz o diff, gera destaques com IA e produz um `.docx` executivo
versionado por cliente (`server/app.js`, `lib/docx-generator.js`,
`lib/charts.js`, `src/pages/RelatorioVisualizar.jsx`). Hoje o relatório só
sai como arquivo baixado manualmente pelo advogado — esta fase é sobre
**o que acontece depois disso**, até chegar ao cliente do escritório.

## Por que esta fase é a de maior valor de produto

O gerador interno já funciona bem; o maior gargalo do produto é que o
relatório não chega ao cliente final de forma direta, rastreável e acessível
em qualquer dispositivo. Esta fase fecha esse ciclo.

## Decisões que exigem confirmação do usuário antes de codar

Pare e pergunte **em texto no chat** (não use UI de pergunta) antes de:
1. **Provedor de e-mail** (tarefa 4): pergunte se o usuário já tem conta em
   Resend, SES, Postmark ou outro, e peça a API key via variável de
   ambiente — não hardcode nem escolha um provedor sozinho sem confirmar.
2. **Estratégia de geração de PDF** (tarefa 2): a abordagem recomendada
   abaixo evita headless browser (Puppeteer/Chromium) por causa do custo e
   da fragilidade em função serverless da Vercel. Se, ao investigar, você
   achar que essa abordagem é inviável no prazo, explique o trade-off ao
   usuário antes de trocar de estratégia.

Nunca envie e-mail de teste para um endereço de cliente real durante o
desenvolvimento — use um endereço de teste/do próprio usuário. Esse é um
envio visível para terceiros; trate com o mesmo cuidado de qualquer ação que
"sai" do sistema.

## Regras gerais de execução

- Commits pequenos e focados por tarefa; não dê push sem confirmar antes.
- Teste manualmente cada fluxo novo (link público, PDF, envio de e-mail) —
  são user-facing e não dá para validar só com testes automatizados.
- Não implemente itens da Fase 3 (IA) ou Fase 4 (portal do cliente com login
  próprio) aqui — mesmo que pareçam relacionados.

## Tarefas (nesta ordem)

### 1. Contatos do cliente (F9)
- Novo modelo `Contact` no `prisma/schema.prisma`: `clientId`, `nome`,
  `email`, `principal` (bool, para saber quem recebe por padrão). Um cliente
  pode ter mais de um contato (ex.: financeiro + jurídico).
- UI em `ClienteDetalhe.jsx` (ou aba nova) para listar/adicionar/remover
  contatos. Isso é pré-requisito das tarefas 3 e 4 abaixo.

### 2. Exportação em PDF (F1)
- Objetivo: mesmo layout visual do `.docx` gerado hoje
  (`lib/docx-generator.js`), mas em PDF, para abrir em qualquer celular sem
  precisar do Word.
- **Abordagem recomendada**: criar `lib/pdf-generator.js` análogo ao
  `docx-generator.js`, reaproveitando os mesmos dados
  (`computeReportInsights` já usado em `server/app.js`) e as mesmas imagens
  de gráfico já geradas por `lib/charts.js` (`donutChartPng`), com uma
  biblioteca de PDF leve (ex. `pdf-lib` ou `pdfkit`) — evita depender de
  Chromium/Puppeteer dentro de uma função serverless da Vercel (custo de
  cold start e tamanho de bundle). Isso duplica parte da lógica de layout
  entre os dois geradores; se preferir eliminar a duplicação, extraia os
  dados/decisões de layout comuns (cores, formatação de moeda, agregações)
  para um módulo compartilhado antes de escrever os dois geradores.
- Nova rota `GET /api/reports/:id/download-pdf` (ou parâmetro no endpoint de
  download existente) retornando a URL assinada do PDF, gerado e salvo no
  Storage no momento da finalização (`POST /api/reports/:id/finalize`), do
  mesmo jeito que o `.docx` já é salvo hoje.
- Botão "Baixar PDF" ao lado do "Baixar (.docx)" existente em
  `NovoRelatorio.jsx` (step 5), `ClienteDetalhe.jsx` e `Historico.jsx`.

### 3. Link seguro de visualização (F2)
- A página `RelatorioVisualizar.jsx` já existe e é rica — hoje só é acessível
  logado. Adicione um modo de acesso público via token.
- Novo campo no `Report`: `shareToken String? @unique` +
  `shareTokenExpiresAt DateTime?`.
- Rota `POST /api/reports/:id/share-link` (autenticada, uso interno) que
  gera/renova o token com uma validade configurável (padrão: 30 dias) e
  retorna a URL pública.
- Rota pública `GET /api/public/reports/:token` (sem `requireAuth`) que
  retorna os mesmos dados de `GET /api/reports/:id` **desde que** o token
  seja válido e não expirado; expirado ou inválido → 404 genérico (não
  revele se o token existe ou não).
- Nova rota de frontend pública (ex. `/r/:token`, fora do `ProtectedRoute` em
  `App.jsx`) reaproveitando o layout visual de `RelatorioVisualizar.jsx` mas
  sem a navegação/sidebar interna (tela dedicada, sem exigir login).
- Botão "Gerar link para o cliente" em `RelatorioVisualizar.jsx` e/ou
  `ClienteDetalhe.jsx`, com opção de copiar o link e ver a validade.

### 4. Envio por e-mail na finalização (F3)
- Depois de confirmado o provedor com o usuário (ver seção de decisões
  acima), adicione um botão "Enviar ao cliente" na tela de relatório pronto
  (`NovoRelatorio.jsx` step 5 e/ou `ClienteDetalhe.jsx`), que:
  - Lista os contatos do cliente (tarefa 1) para escolher destinatário(s);
  - Envia e-mail com o PDF (tarefa 2) anexado e o link seguro (tarefa 3);
  - Registra o envio: novo modelo `EmailSend` (`reportId`, `sentTo`,
    `sentAt`, `status`, `errorMessage?`) para auditoria e exibição na linha
    do tempo de versões em `ClienteDetalhe.jsx`.
- Trate falha de envio de forma visível (mensagem de erro na UI, sem deixar
  o usuário achar que enviou quando não enviou).

### 5. Gráfico de evolução do cliente (F6)
- Endpoint novo (ou extensão de `GET /api/clients/:id`) retornando a série
  histórica por `periodo` de `valorEnvolvidoNum`, `provisaoNum` e `processos`
  (a partir dos `Upload`/`Processo` já existentes — nenhum dado novo
  necessário).
- Componente de gráfico de linha/barras em `ClienteDetalhe.jsx`. Mantenha a
  consistência visual com o `Donut` em SVG puro já usado em
  `RelatorioVisualizar.jsx` (mesma paleta `CATEGORY_COLORS`) — só adicione
  uma biblioteca de gráficos se um SVG customizado ficar
  desproporcionalmente complexo para múltiplas séries.
- Opcional/stretch: incluir uma versão simplificada do mesmo gráfico no
  `.docx`/PDF do relatório (não é obrigatório para o critério de aceite).

## Critério de aceite da fase

- Um relatório finalizado pode ser baixado em `.docx` **e** PDF, com o mesmo
  visual.
- Existe um link que abre o relatório no navegador sem exigir login, com
  validade configurável, e que não expõe dados de outro relatório se o token
  for adivinhado/expirado.
- Ao clicar "Enviar ao cliente", o(s) contato(s) cadastrado(s) recebem
  e-mail com o PDF anexado e o link; o envio fica registrado e visível na
  página do cliente.
- A página do cliente mostra a evolução mensal de valor envolvido/provisão/
  nº de processos.
- Nenhum e-mail de teste foi enviado a um endereço de cliente real durante o
  desenvolvimento.
- `npm test` continua passando; fluxo do `COMO_TESTAR.md` continua íntegro.

## Ao terminar

Resuma o que foi feito por tarefa (1–5), quais decisões de provedor/URL
pública foram tomadas com o usuário, e pergunte a ele — **em texto no
chat** — se quer seguir para a Fase 3 (inteligência, pode rodar em paralelo)
ou Fase 4 (portal do cliente) do `PLANO_EVOLUCAO.md`.
