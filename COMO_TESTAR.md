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

## 5. Testando com planilhas reais

A planilha só precisa ter uma linha de cabeçalho com pelo menos uma coluna de
**número do processo**. O leitor reconhece variações comuns de nome de coluna
(ex.: "Processo", "Nº do processo", "CNJ", "Autos") e também "Parte", "Área",
"Valor da causa", "Provisão", "Status" e "Probabilidade". O cabeçalho pode não
estar na primeira linha (o leitor procura nas primeiras 15 linhas).

Se o upload falhar dizendo que não achou a coluna do processo, ajuste o nome do
cabeçalho na planilha ou me avise o nome real da coluna para eu adicionar como
sinônimo.
