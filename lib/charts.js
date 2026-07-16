import sharp from "sharp";

// Paleta consistente com a identidade visual do portal (ver src/pages/*.jsx).
export const PALETTE = {
  navy: "#142B4B",
  navyLight: "#44546A",
  gold: "#9C7C38",
  goldSoft: "#C7A968",
  green: "#3F6B4F",
  greenSoft: "#7FA98F",
  red: "#A33B3B",
  redSoft: "#D18A8A",
  slate: "#7A8394",
  track: "#EDEFF3",
};

// Cores cíclicas para categorias abertas (ex.: áreas do direito), na ordem em
// que devem ser usadas para manter contraste entre fatias adjacentes.
const CATEGORY_COLORS = ["#142B4B", "#9C7C38", "#3F6B4F", "#6E5AA0", "#2E7D8C", "#A33B3B", "#7A8394", "#C7A968"];

export function colorForIndex(i) {
  return CATEGORY_COLORS[i % CATEGORY_COLORS.length];
}

/**
 * Rasteriza uma string SVG em PNG (via sharp/librsvg) na densidade certa para
 * impressão/zoom em Word sem ficar borrado, e devolve as dimensões que o
 * docx deve usar (em pixels "lógicos", metade do raster @2x).
 */
async function rasterize(svg, widthPx, heightPx) {
  const density = 192; // ~2x de 96dpi para nitidez ao ampliar no Word
  const buffer = await sharp(Buffer.from(svg), { density }).png().toBuffer();
  return { buffer, width: widthPx, height: heightPx };
}

/**
 * Gráfico de rosca (donut). data: [{ label, value, color }]. Retorna um PNG
 * pronto para ImageRun, já com o total no centro.
 */
export async function donutChartPng(data, { size = 280, thickness = 46, totalLabel } = {}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let acc = 0;
  // Espaçamento fixo (em comprimento de arco) entre fatias. Usa ponta reta
  // (butt): com ponta arredondada, fatias pequenas viram "bolhas" do mesmo
  // tamanho visual e distorcem a proporção real dos dados.
  const gapArc = data.filter((d) => d.value > 0).length > 1 ? circumference * 0.01 : 0;
  const segments =
    total > 0
      ? data
          .filter((d) => d.value > 0)
          .map((d) => {
            const frac = d.value / total;
            const dash = Math.max(0, frac * circumference - gapArc);
            const dashArray = `${dash} ${circumference - dash}`;
            const offset = circumference * 0.25 - acc * circumference; // começa às 12h, sentido horário
            acc += frac;
            return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${thickness}" stroke-dasharray="${dashArray}" stroke-dashoffset="${offset}" stroke-linecap="butt" />`;
          })
          .join("\n")
      : "";

  const label = totalLabel ?? String(data.length);
  const fontSize = label.length > 10 ? 26 : label.length > 6 ? 32 : 40;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE.track}" stroke-width="${thickness}" />
  ${segments}
  <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700" fill="${PALETTE.navy}">${label}</text>
  <text x="${cx}" y="${cy + 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="${PALETTE.slate}" letter-spacing="0.5">PROCESSOS</text>
</svg>`.trim();

  return rasterize(svg, size, size);
}

