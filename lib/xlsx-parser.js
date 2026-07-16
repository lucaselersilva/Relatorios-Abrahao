import ExcelJS from "exceljs";

const COLUMN_ALIASES = {
  numero: ["processo", "numero", "numero do processo", "nº processo", "n° processo", "nro processo", "numero processo", "num processo", "cnj", "numero cnj", "autos"],
  parte: ["parte", "parte adversa", "parte contraria", "reu", "reclamante", "autor", "cliente", "nome"],
  area: ["area", "vara", "ramo", "materia", "area do direito", "natureza", "tipo de acao"],
  valor: ["valor", "valor envolvido", "valor da causa", "valor da acao", "valor causa", "valor total", "valor pedido"],
  provisao: ["provisao", "valor provisionado", "provisao total", "provisionado", "valor provisao"],
  status: ["status", "andamento", "situacao", "ultimo andamento", "fase", "fase processual", "situacao atual"],
  probabilidade: ["probabilidade", "chance de exito", "risco", "prognostico", "probabilidade de exito", "chance", "exito"],
};

function normalizeHeader(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
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
 * Exportações reais frequentemente têm linhas de título/logotipo antes da
 * linha de cabeçalho de verdade.
 */
function detectHeaderRow(sheet) {
  const maxScan = Math.min(sheet.rowCount, 15);
  let best = null;

  for (let i = 1; i <= maxScan; i++) {
    const row = sheet.getRow(i);
    const columnIndex = {};
    const headersFound = [];
    let matches = 0;

    row.eachCell((cell, colNumber) => {
      const normalized = normalizeHeader(cellText(cell));
      if (normalized) headersFound.push(normalized);
      for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
        if (columnIndex[field]) continue;
        if (aliases.includes(normalized)) {
          columnIndex[field] = colNumber;
          matches += 1;
        }
      }
    });

    // Só serve como cabeçalho se identificou o número do processo.
    if (columnIndex.numero && matches > (best?.matches ?? 0)) {
      best = { rowNumber: i, columnIndex, matches, headersFound };
    }
  }

  return best;
}

export async function parseSpreadsheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount === 0) throw new Error("Planilha vazia ou em formato inválido.");

  const header = detectHeaderRow(sheet);
  if (!header) {
    const primeira = sheet.getRow(1);
    const encontradas = [];
    primeira.eachCell((cell) => encontradas.push(normalizeHeader(cellText(cell))));
    throw new Error(
      `Não foi possível identificar a coluna do número do processo. Verifique se a planilha tem uma coluna "Processo"/"Nº do processo". Cabeçalhos lidos: ${encontradas.filter(Boolean).join(", ") || "(nenhum)"}`
    );
  }

  const { rowNumber, columnIndex } = header;
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

  return rows;
}
