# Como testar o portal com casos reais

Guia rápido para rodar o Portal de Relatórios localmente e testar o fluxo
completo: cliente → upload de planilha → o que mudou → documentos → análise da
IA → relatório final → página do cliente.

## 1. Pré-requisitos (uma vez)

O `.env` já vem preenchido com o banco e o Supabase do projeto. Falta só:

1. **Usuário de login.** No `.env`, preencha:
   ```
   SEED_USER_EMAIL="voce@exemplo.com"
   SEED_USER_PASSWORD="uma-senha-forte"
   ```
   e rode:
   ```
   npm run db:seed
   ```
   Isso cria (ou atualiza a senha de) esse usuário no Supabase Auth. É com ele
   que você faz login no portal.

2. **(Opcional) IA real.** Sem `ANTHROPIC_API_KEY`, a etapa "Análise da IA"
   roda em **modo mock** (texto de exemplo) — o fluxo funciona, mas os textos
   são de demonstração. Para análise real, coloque a chave no `.env`:
   ```
   ANTHROPIC_API_KEY="sk-ant-..."
   ```

3. **Bucket de Storage.** Não precisa criar à mão — o app cria o bucket privado
   `relatorios` automaticamente no primeiro upload, se ainda não existir.

4. **(Opcional) Monitoramento de erros (Sentry).** Desativado por padrão. Para
   ligar, preencha o DSN no `.env` — backend e frontend usam variáveis
   separadas (o frontend precisa do prefixo `VITE_`):
   ```
   SENTRY_DSN="https://...@...ingest.sentry.io/..."
   VITE_SENTRY_DSN="https://...@...ingest.sentry.io/..."
   ```
   Sem essas variáveis, nada é enviado e o app funciona igual.

## 2. Rodar

```
npm install      # se ainda não instalou
npm run dev      # sobe o frontend (Vite) e a API (Express) juntos
```

Abra a URL que o Vite mostrar (normalmente http://localhost:5173) e faça login
com o usuário do seed.

## 3. Planilhas de exemplo

Para testar sem depender de um export real, gere duas planilhas de um mesmo
cliente (dois meses, com mudanças propositais):

```
npm run exemplos
```

Isso cria em `exemplos/`:

- `Construtora_Alfa_Junho_2026.xlsx` — mês base
- `Construtora_Alfa_Julho_2026.xlsx` — mês seguinte, com: 1 valor alterado,
  1 acordo homologado, 1 processo novo e 2 processos sem mudança (que **não**
  devem aparecer no "o que mudou").
- `Relatorio_Construtora_Alfa_Julho_2026.docx` — **abra este arquivo no Word**
  para ver o novo layout do relatório final (capa, cards de KPI com variação
  vs. mês anterior, gráfico de rosca por área, ranking de maiores exposições,
  destaques da IA em cartões e tabela de movimentações com badges coloridos).
  Não precisa rodar o app para ver o design — este arquivo já é um exemplo
  gerado com dados fictícios.

## 4. Fluxo de teste sugerido

1. **Clientes → Novo relatório.** Cadastre o cliente "Construtora Alfa",
   mês de referência `Junho/2026`, e suba a planilha de **junho**.
   → Como é o primeiro mês, tudo aparece como "processo novo".
2. Rode a análise e gere o relatório (v1). Baixe o `.docx`.
3. **Novo relatório** de novo para o mesmo cliente, mês `Julho/2026`, subindo a
   planilha de **julho**.
   → Agora o "o que mudou" mostra só as 3 movimentações reais (valor, acordo,
   novo). Isso gera a **v2**.
4. Abra **Clientes → Construtora Alfa**: veja os KPIs atuais, o filtro de
   **movimentações por período** (3/6/12 meses) e a **linha do tempo das
   versões** (v1, v2) com download.

## 5. Entrega ao cliente (Fase 2)

Depois de finalizar um relatório (status **Pronto**), abra **Clientes → [o
cliente]** ou a tela do relatório para testar a entrega:

1. **Contatos.** Na página do cliente, cadastre um ou mais contatos (nome +
   e-mail); marque um como **principal**. São os destinatários do relatório.
2. **PDF.** Todo relatório finalizado agora sai também em **PDF** (mesmo visual
   do `.docx`, abre no celular sem Word). Botão "Baixar PDF" no fim do
   assistente, na página do cliente, no histórico e na tela do relatório.
3. **Link seguro.** Na tela do relatório, clique **"Gerar link para o cliente"**:
   gera uma URL `/r/…` que abre o relatório no navegador **sem login**, válida
   por 30 dias (dá para copiar, renovar e revogar). Abra o link numa aba
   anônima para conferir. Link inválido/expirado mostra "não encontrado".
4. **Enviar ao cliente.** Botão "Enviar ao cliente" (fim do assistente e na
   página do cliente). Escolha o(s) contato(s) e envie.
   - Sem provedor de e-mail configurado (padrão), o botão **abre o e-mail já
     preenchido no seu próprio cliente de e-mail** (Gmail/Outlook), com o link
     seguro — você revisa e envia. O envio fica registrado na linha do tempo do
     cliente.
   - Para envio automático pelo servidor (com o PDF anexado), veja
     `RESEND_API_KEY`/`EMAIL_FROM` no `.env.example`.
   - **Nunca** teste com o e-mail de um cliente real — use um endereço seu.
5. **Evolução da carteira.** Com dois ou mais meses enviados, a página do
   cliente mostra o gráfico de evolução mensal (valor envolvido, provisão e nº
   de processos).

## 6. Testando com planilhas reais

A planilha só precisa ter uma linha de cabeçalho com pelo menos uma coluna de
**número do processo**. O leitor reconhece variações comuns de nome de coluna
(ex.: "Processo", "Nº do processo", "CNJ", "Autos") e também "Parte", "Área",
"Valor da causa", "Provisão", "Status" e "Probabilidade". O cabeçalho pode não
estar na primeira linha (o leitor procura nas primeiras 15 linhas).

Se o upload falhar dizendo que não achou a coluna do processo, ajuste o nome do
cabeçalho na planilha ou me avise o nome real da coluna para eu adicionar como
sinônimo.
