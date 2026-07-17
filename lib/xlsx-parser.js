import ExcelJS from "exceljs";

// Campos do sistema, na ordem em que aparecem na UI de mapeamento manual.
export const CAMPOS_SISTEMA = ["numero", "parte", "area", "valor", "provisao", "status", "probabilidade"];

// Rótulos amigáveis dos campos (para mensagens e para o mapeador manual no frontend).
export const CAMPO_LABELS = {
  numero: "Número do processo",
  parte: "Parte",
  area: "Área",
  valor: "Valor envolvido",
  provisao: "Provisão",
  status: "Status",
  probabilidade: "Probabilidade",
};

const COLUMN_ALIASES = {
  numero: ["processo", "numero", "numero do processo", "nº processo", "n° processo", "nro processo", "numero processo", "num processo", "cnj", "numero cnj", "autos"],
  parte: ["parte", "parte adversa", "parte contraria", "reu", "reclamante", "autor", "cliente", "nome"],
  area: ["area", "vara", "ramo", "materia", "area do direito", "natureza", "tipo de acao"],
  valor: ["valor", "valor envolvido", "valor da causa", "valor da acao", "valor causa", "valor total", "valor pedido"],
  provisao: ["provisao", "valor provisionado", "provisao total", "provisionado", "valor provisao"],
  status: ["status", "andamento", "situacao", "ultimo andamento", "fase", "fase processual", "situacao atual"],
  probabilidade: ["probabilidade", "chance de exito", "risco", "prognostico", "probabilidade de exito", "chance", "exito"],
};

export function normalizeHeader(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Normaliza um mapeamento manual { campo: nomeColuna } deixando os nomes de
 * coluna no mesmo formato (sem acento, minúsculo) usado para comparar
 * cabeçalhos. Descarta campos desconhecidos e valores vazios.
 */
export function normalizeMapping(mapping) {
  const out = {};
  if (!mapping || typeof mapping !== "object") return out;
  for (const campo of CAMPOS_SISTEMA) {
    const nome = mapping[campo];
    if (typeof nome === "string" && nome.trim()) out[campo] = normalizeHeader(nome);
  }
  return out;
}

/**
 * Extrai texto de uma célula do ExcelJS, que pode ser um valor simples ou um
 * objeto (fórmula, rich text, hyperlink) em exportações reais.
 */
function cellText(cell) {
  const v = cell?.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((t) => t.text).join("");
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.hyperlink != null) return String(v.hyperlink);
    if (v instanceof Date) return v.toISOString();
    return "";
  }
  return String(v);
}

function parseValorBR(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value.result != null && typeof value.result === "number") return value.result;
  const str = String(value).replace(/[^\d.,-]/g, "");
  if (!str) return null;
  let normalized = str;
  if (str.includes(",") && str.includes(".")) {
    normalized = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    normalized = str.replace(",", ".");
  }
  const num = parseFloat(normalized);
  return Number.isNaN(num) ? null : num;
}

/**
 * Procura, nas primeiras linhas, a que melhor casa com os cabeçalhos esperados.
 * Exportações reais frequentemente têm linhas de título/logotipo antes da linha
 * de cabeçalho de verdade.
 *
 * `mapping` (campo -> nome de coluna normalizado) é o mapeamento manual salvo
 * por cliente: entra como sinônimo extra, então uma coluna com nome fora do
 * padrão ("Valor da demanda") passa a ser reconhecida sem tocar no código.
 *
 * Retorna `{ best, fallback }`: `best` é a melhor linha que reconheceu o número
 * do processo; `fallback` é a linha com mais cabeçalhos (usada só para oferecer
 * as colunas ao mapeador manual quando nem o número foi reconhecido).
 */
function detectHeaderRow(sheet, mapping = {}) {
  const maxScan = Math.min(sheet.rowCount, 15);
  let best = null;
  let fallback = null;

  for (let i = 1; i <= maxScan; i++) {
    const row = sheet.getRow(i);
    const columnIndex = {};
    const headersFound = []; // [{ index, nome, normalizado }]
    let matches = 0;

    row.eachCell((cell, colNumber) => {
      const nome = cellText(cell).trim();
      const normalized = normalizeHeader(nome);
      if (normalized) headersFound.push({ index: colNumber, nome, normalizado: normalized });
      for (const field of CAMPOS_SISTEMA) {
        if (columnIndex[field]) continue;
        const aliases = COLUMN_ALIASES[field];
        const mapped = mapping[field];
        if ((mapped && mapped === normalized) || aliases.includes(normalized)) {
          columnIndex[field] = colNumber;
          matches += 1;
        }
      }
    });

    if (headersFound.length > (fallback?.headersFound.length ?? 0)) {
      fallback = { rowNumber: i, columnIndex, matches, headersFound };
    }
    // Só serve como cabeçalho de verdade se identificou o número do processo.
    if (columnIndex.numero && matches > (best?.matches ?? 0)) {
      best = { rowNumber: i, columnIndex, matches, headersFound };
    }
  }

  return { best, fallback };
}

/**
 * Monta o resumo "confira a leitura" que o wizard mostra ao usuário: qual linha
 * virou cabeçalho, quais colunas foram reconhecidas/ignoradas, quais campos
 * ficaram faltando e uma amostra das primeiras linhas lidas.
 */
function montarLeitura({ rowNumber, columnIndex, headersFound }, amostra) {
  const camposReconhecidos = {};
  for (const [campo, colIdx] of Object.entries(columnIndex)) {
    const h = headersFound.find((x) => x.index === colIdx);
    camposReconhecidos[campo] = h?.nome ?? `Coluna ${colIdx}`;
  }
  const colunas = headersFound.map((h) => ({
    index: h.index,
    nome: h.nome,
    campo: Object.entries(columnIndex).find(([, idx]) => idx === h.index)?.[0] ?? null,
  }));
  return {
    headerRow: rowNumber,
    colunas,
    camposReconhecidos,
    camposFaltando: CAMPOS_SISTEMA.filter((c) => !columnIndex[c]),
    amostra,
  };
}

/**
 * Lê a planilha e devolve `{ processos, leitura }`.
 *
 * `options.mapping` é um mapeamento manual opcional (campo -> nome de coluna)
 * que entra como sinônimo na detecção — assim colunas fora do padrão são
 * reconhecidas sem código novo. Quando a coluna do número do processo não é
 * reconhecida, lança um erro com `err.leitura` preenchido (as colunas lidas)
 * para o frontend conseguir oferecer o mapeador manual mesmo nesse caso.
 */
export async function parseSpreadsheet(buffer, { mapping = {} } = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) throw new Error("Planilha vazia ou em formato inválido.");

  // Normaliza aqui também: assim funciona tanto com nomes já normalizados
  // (vindos do backend) quanto com nomes crus (ex.: chamadas diretas/testes).
  const { best, fallback } = detectHeaderRow(sheet, normalizeMapping(mapping));

  if (!best) {
    const colunasLidas = (fallback?.headersFound ?? []).map((h) => ({ index: h.index, nome: h.nome }));
    const err = new Error(
      `Não foi possível identificar a coluna do número do processo. Verifique se a planilha tem uma coluna "Processo"/"Nº do processo", ou mapeie a coluna manualmente. Cabeçalhos lidos: ${colunasLidas.map((c) => c.nome).filter(Boolean).join(", ") || "(nenhum)"}`
    );
    // Colunas lidas na melhor linha candidata, para o mapeador manual da UI.
    err.leitura = {
      headerRow: fallback?.rowNumber ?? null,
      colunas: colunasLidas.map((c) => ({ ...c, campo: null })),
      camposReconhecidos: {},
      camposFaltando: [...CAMPOS_SISTEMA],
      amostra: [],
    };
    throw err;
  }

  const { rowNumber, columnIndex } = best;
  const rows = [];
  const vistos = new Set();

  for (let i = rowNumber + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const numero = cellText(row.getCell(columnIndex.numero)).trim();
    if (!numero) continue;
    // Evita duplicar o mesmo processo se a planilha repetir a linha.
    if (vistos.has(numero)) continue;
    vistos.add(numero);

    rows.push({
      numero,
      parte: columnIndex.parte ? cellText(row.getCell(columnIndex.parte)).trim() || null : null,
      area: columnIndex.area ? cellText(row.getCell(columnIndex.area)).trim() || null : null,
      valor: columnIndex.valor ? parseValorBR(row.getCell(columnIndex.valor).value) : null,
      provisao: columnIndex.provisao ? parseValorBR(row.getCell(columnIndex.provisao).value) : null,
      status: columnIndex.status ? cellText(row.getCell(columnIndex.status)).trim() || null : null,
      probabilidade: columnIndex.probabilidade ? cellText(row.getCell(columnIndex.probabilidade)).trim() || null : null,
    });
  }

  if (rows.length === 0) throw new Error("A planilha foi lida, mas nenhuma linha de processo foi encontrada abaixo do cabeçalho.");

  const leitura = montarLeitura(best, rows.slice(0, 5));
  return { processos: rows, leitura };
}
