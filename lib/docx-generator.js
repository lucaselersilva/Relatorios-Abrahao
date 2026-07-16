import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  BorderStyle,
  HeightRule,
  Header,
  Footer,
  PageNumberElement,
  ImageRun,
} from "docx";
import { donutChartPng, colorForIndex, PALETTE } from "./charts.js";

const NAVY = "142B4B";
const NAVY_LIGHT = "44546A";
const GOLD = "9C7C38";
const GREEN = "3F6B4F";
const GREEN_SOFT = "E4EDE7";
const RED = "A33B3B";
const RED_SOFT = "FBEAEA";
const GOLD_SOFT = "EFE6D2";
const GOLD_TEXT = "7A5F26";
const SLATE = "7A8394";
const LINE = "E2E5EA";
const ZEBRA = "FAFAFB";

const FONT_SERIF = "Georgia";
const FONT_SANS = "Arial";

const NO_MARGIN = { top: 0, bottom: 0, left: 0, right: 0 };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

function money(v) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function emptyPara(sizeAfter = 0) {
  return new Paragraph({ spacing: { after: sizeAfter }, children: [] });
}

function heading(text) {
  return new Paragraph({
    spacing: { before: 320, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 6 } },
    children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 20, color: NAVY, font: FONT_SANS, characterSpacing: 20 })],
  });
}

function fullWidthTable(rows) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

// ---------------------------------------------------------------------------
// Capa / faixa de identificação
// ---------------------------------------------------------------------------

function coverBand({ cliente, mesReferencia, versao, geradoEm }) {
  const dataFmt = geradoEm.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  return fullWidthTable([
    new TableRow({
      children: [
        new TableCell({
          shading: { fill: NAVY },
          borders: NO_BORDERS,
          margins: { top: 420, bottom: 420, left: 420, right: 420 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: "RELATÓRIO EXECUTIVO", bold: true, size: 16, color: GOLD, font: FONT_SANS, characterSpacing: 40 })],
            }),
            new Paragraph({
              spacing: { before: 100 },
              children: [new TextRun({ text: cliente.toUpperCase(), bold: true, size: 40, color: "FFFFFF", font: FONT_SERIF })],
            }),
            new Paragraph({
              spacing: { before: 120 },
              children: [
                new TextRun({ text: `Referência: ${mesReferencia}`, size: 19, color: "C7CEDA", font: FONT_SANS }),
                new TextRun({ text: "    •    ", size: 19, color: "5A6B87", font: FONT_SANS }),
                new TextRun({ text: `Versão ${versao ?? 1}`, size: 19, color: "C7CEDA", font: FONT_SANS }),
                new TextRun({ text: "    •    ", size: 19, color: "5A6B87", font: FONT_SANS }),
                new TextRun({ text: `Gerado em ${dataFmt}`, size: 19, color: "C7CEDA", font: FONT_SANS }),
              ],
            }),
          ],
        }),
      ],
    }),
  ]);
}

// ---------------------------------------------------------------------------
// KPIs (com variação vs. mês anterior, quando disponível)
// ---------------------------------------------------------------------------

function pctChange(curr, prev) {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function deltaRun({ pctValue, countDiff, invert = false, neutral = false }) {
  if (pctValue == null && countDiff == null) {
    return new TextRun({ text: "sem dado do mês anterior", size: 15, color: SLATE, italics: true, font: FONT_SANS });
  }
  if (countDiff != null) {
    if (countDiff === 0) return new TextRun({ text: "sem variação", size: 15, color: SLATE, font: FONT_SANS });
    const up = countDiff > 0;
    const arrow = up ? "▲" : "▼";
    const color = neutral ? NAVY_LIGHT : up !== invert ? RED : GREEN;
    return new TextRun({ text: `${arrow} ${Math.abs(countDiff)} vs. mês anterior`, size: 15, bold: true, color, font: FONT_SANS });
  }
  if (Math.abs(pctValue) < 0.5) return new TextRun({ text: "sem variação", size: 15, color: SLATE, font: FONT_SANS });
  const up = pctValue > 0;
  const arrow = up ? "▲" : "▼";
  const color = neutral ? NAVY_LIGHT : up !== invert ? RED : GREEN;
  return new TextRun({ text: `${arrow} ${Math.abs(pctValue).toFixed(1)}% vs. mês anterior`, size: 15, bold: true, color, font: FONT_SANS });
}

function kpiCard({ label, value, deltaRunEl, alert, isLast }) {
  return new TableCell({
    width: { size: 25, type: WidthType.PERCENTAGE },
    shading: { fill: alert ? RED_SOFT : "FFFFFF" },
    borders: {
      ...NO_BORDERS,
      top: { style: BorderStyle.SINGLE, size: 16, color: alert ? RED : GOLD },
      right: isLast ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE },
    },
    margins: { top: 220, bottom: 220, left: 220, right: 220 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: label.toUpperCase(), size: 14, color: SLATE, font: FONT_SANS, characterSpacing: 10 })],
      }),
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [new TextRun({ text: value, bold: true, size: 30, color: alert ? RED : NAVY, font: FONT_SERIF })],
      }),
      new Paragraph({ children: [deltaRunEl] }),
    ],
  });
}

function kpiCardsRow(kpis, kpisAnterior) {
  const semProvisaoPct = kpis.processos ? Math.round((kpis.semProvisao / kpis.processos) * 100) : 0;

  const cards = [
    kpiCard({
      label: "Processos ativos",
      value: String(kpis.processos),
      deltaRunEl: deltaRun({ countDiff: kpisAnterior ? kpis.processos - kpisAnterior.processos : null, neutral: true }),
    }),
    kpiCard({
      label: "Valor envolvido",
      value: kpis.valorEnvolvido ?? "—",
      // Aumento de exposição é o que mais importa sinalizar em vermelho.
      deltaRunEl: deltaRun({ pctValue: kpisAnterior ? pctChange(kpis.valorEnvolvidoNum, kpisAnterior.valorEnvolvidoNum) : null }),
    }),
    kpiCard({
      label: "Provisão total",
      value: kpis.provisao ?? "—",
      deltaRunEl: deltaRun({ pctValue: kpisAnterior ? pctChange(kpis.provisaoNum, kpisAnterior.provisaoNum) : null, neutral: true }),
    }),
    kpiCard({
      label: "Sem provisão adequada",
      value: `${kpis.semProvisao} (${semProvisaoPct}%)`,
      deltaRunEl: new TextRun({
        text: kpis.semProvisao > 0 ? "requer atenção da diretoria jurídica" : "carteira integralmente provisionada",
        size: 15,
        color: kpis.semProvisao > 0 ? RED : GREEN,
        italics: kpis.semProvisao === 0,
        font: FONT_SANS,
      }),
      alert: kpis.semProvisao > 0,
      isLast: true,
    }),
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: cards })],
  });
}

// ---------------------------------------------------------------------------
// Barra proporcional nativa (sem imagem) — usada nos rankings/comparações
// ---------------------------------------------------------------------------

function proportionalBar({ frac, color, height = 190 }) {
  const filled = Math.min(100, Math.max(frac > 0 ? 3 : 0, Math.round(frac * 100)));
  const cells = [
    new TableCell({
      width: { size: filled, type: WidthType.PERCENTAGE },
      shading: { fill: color },
      borders: NO_BORDERS,
      margins: NO_MARGIN,
      children: [new Paragraph({ text: "" })],
    }),
  ];
  if (filled < 100) {
    cells.push(
      new TableCell({
        width: { size: 100 - filled, type: WidthType.PERCENTAGE },
        shading: { fill: "F0F1F3" },
        borders: NO_BORDERS,
        margins: NO_MARGIN,
        children: [new Paragraph({ text: "" })],
      })
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ height: { value: height, rule: HeightRule.EXACT }, children: cells })],
  });
}

function rankingRow({ rank, title, subtitle, value, frac, color, isLast }) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 6, type: WidthType.PERCENTAGE },
        borders: { ...NO_BORDERS, bottom: isLast ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE } },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 90, bottom: 90, left: 0, right: 60 },
        children: [new Paragraph({ children: [new TextRun({ text: String(rank), bold: true, size: 17, color: GOLD, font: FONT_SERIF })] })],
      }),
      new TableCell({
        width: { size: 38, type: WidthType.PERCENTAGE },
        borders: { ...NO_BORDERS, bottom: isLast ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE } },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 90, bottom: 90, left: 0, right: 120 },
        children: [
          new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 17, color: "1C2430", font: FONT_SANS })] }),
          new Paragraph({ children: [new TextRun({ text: subtitle, size: 14, color: SLATE, font: FONT_SANS })] }),
        ],
      }),
      new TableCell({
        width: { size: 36, type: WidthType.PERCENTAGE },
        borders: { ...NO_BORDERS, bottom: isLast ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE } },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 90, bottom: 90, left: 0, right: 120 },
        children: [proportionalBar({ frac, color, height: 170 })],
      }),
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        borders: { ...NO_BORDERS, bottom: isLast ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE } },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 90, bottom: 90, left: 0, right: 0 },
        children: [
          new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: value, bold: true, size: 18, color: NAVY, font: FONT_SERIF })] }),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------
// Panorama da carteira — rosca por área + ranking de maiores exposições
// ---------------------------------------------------------------------------

function legendRow({ color, label, value, pctLabel, isLast }) {
  const border = isLast ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE };
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 8, type: WidthType.PERCENTAGE },
        shading: { fill: color },
        borders: { ...NO_BORDERS, bottom: border },
        margins: NO_MARGIN,
        children: [new Paragraph({ text: "" })],
      }),
      new TableCell({
        width: { size: 47, type: WidthType.PERCENTAGE },
        borders: { ...NO_BORDERS, bottom: border },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 130, right: 60 },
        children: [new Paragraph({ children: [new TextRun({ text: label, size: 17, color: "1C2430", font: FONT_SANS })] })],
      }),
      new TableCell({
        width: { size: 27, type: WidthType.PERCENTAGE },
        borders: { ...NO_BORDERS, bottom: border },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 0, right: 0 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: value, bold: true, size: 16, color: NAVY, font: FONT_SANS })] })],
      }),
      new TableCell({
        width: { size: 18, type: WidthType.PERCENTAGE },
        borders: { ...NO_BORDERS, bottom: border },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 80, bottom: 80, left: 0, right: 0 },
        children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: pctLabel, size: 15, color: SLATE, font: FONT_SANS })] })],
      }),
    ],
  });
}

async function panoramaSection(panorama, kpis) {
  const { porArea, topExposicoes } = panorama;
  const totalValor = porArea.reduce((s, a) => s + a.valor, 0) || 1;

  const MAX_FATIAS = 6;
  const principais = porArea.slice(0, MAX_FATIAS);
  const outras = porArea.slice(MAX_FATIAS);
  const outrasValor = outras.reduce((s, a) => s + a.valor, 0);
  const outrasCount = outras.reduce((s, a) => s + a.count, 0);

  const donutData = principais.map((a, i) => ({ label: a.area, value: a.valor, color: colorForIndex(i) }));
  if (outras.length > 0) donutData.push({ label: "Outras", value: outrasValor, color: PALETTE.slate });

  const { buffer, width, height } = await donutChartPng(donutData, { totalLabel: String(kpis.processos) });
  const donutImage = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new ImageRun({ type: "png", data: buffer, transformation: { width: Math.round(width * 0.62), height: Math.round(height * 0.62) } })],
  });

  const legendRows = principais.map((a, i) =>
    legendRow({
      color: colorForIndex(i),
      label: `${a.area}  (${a.count})`,
      value: money(a.valor),
      pctLabel: `${((a.valor / totalValor) * 100).toFixed(0)}%`,
      isLast: i === principais.length - 1 && outras.length === 0,
    })
  );
  if (outras.length > 0) {
    legendRows.push(
      legendRow({
        color: PALETTE.slate,
        label: `Outras áreas  (${outrasCount})`,
        value: money(outrasValor),
        pctLabel: `${((outrasValor / totalValor) * 100).toFixed(0)}%`,
        isLast: true,
      })
    );
  }

  const legendTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: legendRows });

  const left = new TableCell({
    width: { size: 46, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 0, bottom: 0, left: 0, right: 200 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "CARTEIRA POR ÁREA DO DIREITO", size: 14, color: SLATE, font: FONT_SANS, characterSpacing: 10 })],
      }),
      emptyPara(60),
      donutImage,
    ],
  });

  const right = new TableCell({
    width: { size: 54, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    children: topExposicoes.length
      ? [
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: "MAIORES EXPOSIÇÕES DA CARTEIRA", size: 14, color: SLATE, font: FONT_SANS, characterSpacing: 10 })],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: topExposicoes.map((p, i) =>
              rankingRow({
                rank: i + 1,
                title: p.parte || "Parte não identificada",
                subtitle: `${p.area ?? "Área não informada"} · ${p.numero}`,
                value: p.valorFormatado ?? "—",
                frac: topExposicoes[0].valor > 0 ? p.valor / topExposicoes[0].valor : 0,
                color: colorForIndex(i),
                isLast: i === topExposicoes.length - 1,
              })
            ),
          }),
        ]
      : [new Paragraph({ children: [new TextRun({ text: "Sem processos suficientes para ranking.", size: 16, color: SLATE, font: FONT_SANS })] })],
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [left, right] })],
  });
}

// ---------------------------------------------------------------------------
// Movimentações por tipo (barras nativas) — visão rápida do volume do período
// ---------------------------------------------------------------------------

const TIPO_INFO = {
  novo: { label: "Processos novos", color: NAVY },
  movimentacao: { label: "Alterações relevantes", color: GOLD },
  acordo: { label: "Acordos / homologações", color: GREEN },
};

function movimentacoesPorTipoSection(movimentacoes) {
  const contagem = { novo: 0, movimentacao: 0, acordo: 0 };
  for (const m of movimentacoes) contagem[m.tipo] = (contagem[m.tipo] ?? 0) + 1;
  const max = Math.max(1, ...Object.values(contagem));

  const rows = Object.entries(TIPO_INFO).map(([tipo, info], i) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 26, type: WidthType.PERCENTAGE },
          borders: { ...NO_BORDERS, bottom: i === 2 ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE } },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 0, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: info.label, size: 16, color: "1C2430", font: FONT_SANS })] })],
        }),
        new TableCell({
          width: { size: 58, type: WidthType.PERCENTAGE },
          borders: { ...NO_BORDERS, bottom: i === 2 ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE } },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 0, right: 100 },
          children: [proportionalBar({ frac: contagem[tipo] / max, color: info.color, height: 170 })],
        }),
        new TableCell({
          width: { size: 16, type: WidthType.PERCENTAGE },
          borders: { ...NO_BORDERS, bottom: i === 2 ? NO_BORDER : { style: BorderStyle.SINGLE, size: 2, color: LINE } },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 0, right: 0 },
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(contagem[tipo]), bold: true, size: 20, color: NAVY, font: FONT_SERIF })] }),
          ],
        }),
      ],
    })
  );

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows });
}

// ---------------------------------------------------------------------------
// Destaques do período (análise da IA) — cartões, não parágrafos soltos
// ---------------------------------------------------------------------------

function destaqueCard(n, isLast) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: "FBFAF7" },
            borders: { ...NO_BORDERS, left: { style: BorderStyle.SINGLE, size: 18, color: GOLD } },
            margins: { top: 180, bottom: 180, left: 220, right: 260 },
            children: [
              new Paragraph({ children: [new TextRun({ text: n.titulo, bold: true, size: 20, color: NAVY, font: FONT_SANS })] }),
              new Paragraph({
                spacing: { before: 90, after: 110 },
                children: [new TextRun({ text: n.texto, size: 18, color: "2A3140", font: FONT_SANS })],
              }),
              new Paragraph({
                children: [new TextRun({ text: `FONTE — ${n.fonte}`, size: 13, color: SLATE, font: FONT_SANS, characterSpacing: 8 })],
              }),
            ],
          }),
        ],
      }),
    ],
    ...(isLast ? {} : {}),
  });
}

// ---------------------------------------------------------------------------
// Movimentações detalhadas — tabela compacta com colunas objetivas
// ---------------------------------------------------------------------------

function badgeCell(tipo) {
  const map = {
    novo: { label: "NOVO", fill: NAVY, color: "FFFFFF" },
    movimentacao: { label: "ALTERAÇÃO", fill: GOLD_SOFT, color: GOLD_TEXT },
    acordo: { label: "ACORDO", fill: GREEN_SOFT, color: GREEN },
  };
  return map[tipo] ?? map.movimentacao;
}

function variacaoRun(m) {
  if (m.tipo === "novo") return new TextRun({ text: "—", size: 15, color: SLATE, font: FONT_SANS });
  if (m.deltaValor != null && m.deltaValor !== 0) {
    const up = m.deltaValor > 0;
    return new TextRun({
      text: `${up ? "▲" : "▼"} ${money(Math.abs(m.deltaValor))}`,
      bold: true,
      size: 15,
      color: up ? RED : GREEN,
      font: FONT_SANS,
    });
  }
  if (m.statusAnterior && m.statusAtual && m.statusAnterior !== m.statusAtual) {
    return new TextRun({ text: "status alterado", size: 15, color: GOLD_TEXT, italics: true, font: FONT_SANS });
  }
  return new TextRun({ text: "—", size: 15, color: SLATE, font: FONT_SANS });
}

function movimentacoesTable(movimentacoes) {
  const ordenadas = [...movimentacoes].sort((a, b) => {
    const pesoA = a.prioridade === "alta" ? 1 : 0;
    const pesoB = b.prioridade === "alta" ? 1 : 0;
    if (pesoA !== pesoB) return pesoB - pesoA;
    return (b.valor ?? 0) - (a.valor ?? 0);
  });

  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Tipo", "Parte / Processo", "Área", "Valor atual", "Variação", "Situação"].map(
      (h, i) =>
        new TableCell({
          shading: { fill: NAVY },
          borders: NO_BORDERS,
          width: { size: [12, 27, 15, 16, 16, 14][i], type: WidthType.PERCENTAGE },
          margins: { top: 100, bottom: 100, left: 120, right: 80 },
          children: [new Paragraph({ children: [new TextRun({ text: h.toUpperCase(), bold: true, size: 13, color: "FFFFFF", font: FONT_SANS, characterSpacing: 8 })] })],
        })
    ),
  });

  const rows = ordenadas.map((m, i) => {
    const badge = badgeCell(m.tipo);
    const bg = i % 2 === 1 ? ZEBRA : "FFFFFF";
    const border = { style: BorderStyle.SINGLE, size: 2, color: LINE };
    const commonBorders = { ...NO_BORDERS, bottom: border };

    return new TableRow({
      children: [
        new TableCell({
          shading: { fill: bg },
          borders: commonBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 120, right: 60 },
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: ` ${badge.label} `, bold: true, size: 12, color: badge.color, font: FONT_SANS, shading: { fill: badge.fill } }),
              ],
            }),
          ],
        }),
        new TableCell({
          shading: { fill: bg },
          borders: commonBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 60, right: 60 },
          children: [
            new Paragraph({ children: [new TextRun({ text: m.parte || "Parte não identificada", bold: true, size: 16, color: "1C2430", font: FONT_SANS })] }),
            new Paragraph({ children: [new TextRun({ text: m.numero, size: 13, color: SLATE, font: "Courier New" })] }),
          ],
        }),
        new TableCell({
          shading: { fill: bg },
          borders: commonBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: m.area ?? "-", size: 15, color: "44546A", font: FONT_SANS })] })],
        }),
        new TableCell({
          shading: { fill: bg },
          borders: commonBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 60, right: 60 },
          children: [new Paragraph({ children: [new TextRun({ text: m.valorFormatado ?? "-", bold: true, size: 16, color: NAVY, font: FONT_SANS })] })],
        }),
        new TableCell({
          shading: { fill: bg },
          borders: commonBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 60, right: 60 },
          children: [new Paragraph({ children: [variacaoRun(m)] })],
        }),
        new TableCell({
          shading: { fill: bg },
          borders: commonBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 60, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: m.statusAtual ?? "-", size: 15, color: "44546A", font: FONT_SANS })] })],
        }),
      ],
    });
  });

  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...rows] });
}

// ---------------------------------------------------------------------------
// Cabeçalho / rodapé de página
// ---------------------------------------------------------------------------

function pageHeader(cliente) {
  const cellBorders = { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 3, color: LINE } };
  return new Header({
    children: [
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                borders: cellBorders,
                margins: { top: 0, bottom: 120, left: 0, right: 0 },
                children: [new Paragraph({ children: [new TextRun({ text: `Relatório Executivo — ${cliente}`, size: 14, color: SLATE, font: FONT_SANS })] })],
              }),
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                borders: cellBorders,
                margins: { top: 0, bottom: 120, left: 0, right: 0 },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Confidencial", size: 14, color: SLATE, font: FONT_SANS })] })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function pageFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 3, color: LINE, space: 6 } },
        children: [
          new TextRun({ text: "Portal de Relatórios · Abrahão Advogados", size: 13, color: SLATE, font: FONT_SANS }),
          new TextRun({ text: "   —   Página ", size: 13, color: SLATE, font: FONT_SANS }),
          new PageNumberElement(),
        ],
      }),
    ],
  });
}

// ---------------------------------------------------------------------------

export async function generateReportDocx({
  cliente,
  mesReferencia,
  versao,
  kpis,
  kpisAnterior,
  narrativas,
  movimentacoes,
  panorama,
  totalAnexos,
  geradoEm,
}) {
  const geradoEmDate = geradoEm ?? new Date();
  const narrativasSeguras = narrativas?.length ? narrativas : [];
  const panoramaSeguro = panorama ?? { porArea: [], topExposicoes: [] };

  const children = [
    coverBand({ cliente, mesReferencia, versao, geradoEm: geradoEmDate }),
    emptyPara(120),
    kpiCardsRow(kpis, kpisAnterior),
    emptyPara(60),
  ];

  if (panoramaSeguro.porArea.length > 0) {
    children.push(heading("Panorama da carteira"));
    children.push(await panoramaSection(panoramaSeguro, kpis));
  }

  if (movimentacoes.length > 0) {
    children.push(heading("Movimentações do período"));
    children.push(movimentacoesPorTipoSection(movimentacoes));
  }

  if (narrativasSeguras.length > 0) {
    children.push(heading("Destaques do período"));
    narrativasSeguras.forEach((n, i) => {
      children.push(destaqueCard(n));
      if (i < narrativasSeguras.length - 1) children.push(emptyPara(140));
    });
  }

  if (movimentacoes.length > 0) {
    children.push(heading("Movimentações detalhadas"));
    children.push(movimentacoesTable(movimentacoes));
  }

  children.push(emptyPara(200));
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `${totalAnexos} documento(s) de apoio anexado(s) e referenciado(s) nesta análise.`,
          size: 15,
          italics: true,
          color: SLATE,
          font: FONT_SANS,
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        headers: { default: pageHeader(cliente) },
        footers: { default: pageFooter() },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
