import ExcelJS from "exceljs";

const COLUMN_ALIASES = {
  numero: ["processo", "numero", "numero do processo", "nº processo", "n° processo", "nro processo", "numero processo"],
  parte: ["parte", "parte adversa", "parte contraria", "reu", "reclamante", "autor"],
  area: ["area", "vara", "ramo", "materia", "area do direito"],
  valor: ["valor", "valor envolvido", "valor da causa", "valor da acao", "valor causa"],
  provisao: ["provisao", "valor provisionado", "provisao total"],
  status: ["status", "andamento", "situacao", "ultimo andamento"],
  probabilidade: ["probabilidade", "chance de exito", "risco", "prognostico", "probabilidade de exito"],
};

function normalizeHeader(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseValorBR(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
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

export async function parseSpreadsheet(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("Planilha vazia ou em formato inválido.");

  const headerRow = sheet.getRow(1);
  const columnIndex = {};
  const headersFound = [];

  headerRow.eachCell((cell, colNumber) => {
    const normalized = normalizeHeader(cell.value);
    headersFound.push(normalized);
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (columnIndex[field]) continue;
      if (aliases.includes(normalized)) columnIndex[field] = colNumber;
    }
  });

  if (!columnIndex.numero) {
    throw new Error(
      `Não foi possível identificar a coluna do número do processo. Colunas encontradas: ${headersFound.join(", ")}`
    );
  }

  const rows = [];
  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const numero = row.getCell(columnIndex.numero).value;
    if (!numero) continue;
    rows.push({
      numero: String(numero).trim(),
      parte: columnIndex.parte ? String(row.getCell(columnIndex.parte).value ?? "").trim() || null : null,
      area: columnIndex.area ? String(row.getCell(columnIndex.area).value ?? "").trim() || null : null,
      valor: columnIndex.valor ? parseValorBR(row.getCell(columnIndex.valor).value) : null,
      provisao: columnIndex.provisao ? parseValorBR(row.getCell(columnIndex.provisao).value) : null,
      status: columnIndex.status ? String(row.getCell(columnIndex.status).value ?? "").trim() || null : null,
      probabilidade: columnIndex.probabilidade
        ? String(row.getCell(columnIndex.probabilidade).value ?? "").trim() || null
        : null,
    });
  }

  return rows;
}
