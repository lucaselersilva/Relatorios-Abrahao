import PDFDocument from "pdfkit";

import { donutChartPng } from "./charts.js";
import {
  REPORT_COLORS as C,
  categoryColor,
  money,
  buildPanoramaView,
  TIPOS,
  countByTipo,
  sortMovimentacoes,
  TIPO_BADGE,
  pctChange,
} from "./report-layout.js";

// Geometria da página (A4, em pontos). Margens deixam espaço para o cabeçalho
// e o rodapé desenhados em toda página.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const ML = 40;
const MR = 40;
const MT = 58;
const MB = 54;
const LEFT = ML;
const CONTENT_W = PAGE_W - ML - MR;
const CONTENT_TOP = MT;
const CONTENT_BOTTOM = PAGE_H - MB;

/**
 * Gera o relatório executivo em PDF com o mesmo layout visual do .docx
 * (lib/docx-generator.js): capa, KPIs com variação, panorama com rosca por
 * área, movimentações por tipo, destaques da IA em cartões e a tabela
 * detalhada. Reaproveita os mesmos dados (computeReportInsights) e a mesma
 * imagem de rosca (donutChartPng). Sem headless browser — roda numa função
 * serverless. Retorna um Buffer.
 */
export async function generateReportPdf({
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
  const dataFmt = geradoEmDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const narrativasSeguras = narrativas?.length ? narrativas : [];
  const movs = movimentacoes ?? [];
  const kpisSeguro = kpis ?? { processos: 0, semProvisao: 0, valorEnvolvido: "—", provisao: "—" };
  const panoramaView = buildPanoramaView(panorama ?? { porArea: [], topExposicoes: [] }, kpisSeguro);

  // A imagem da rosca é assíncrona (sharp); geramos antes de desenhar o PDF,
  // que a partir daqui é síncrono.
  const donutPng =
    panoramaView.legenda.length > 0
      ? await donutChartPng(panoramaView.donutData, { totalLabel: String(kpisSeguro.processos ?? panoramaView.donutData.length) })
      : null;

  const doc = new PDFDocument({
    size: "A4",
    autoFirstPage: false,
    margins: { top: MT, bottom: MB, left: ML, right: MR },
    info: { Title: `Relatório Executivo — ${cliente}`, Author: "Portal de Relatórios · Abrahão Advogados" },
  });

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  let y = CONTENT_TOP;
  let pageNo = 0;

  // Cabeçalho + rodapé fixos em toda página (posições fora da área de conteúdo).
  doc.on("pageAdded", () => {
    pageNo++;
    // Zeramos a margem inferior desta página: o rodapé é desenhado abaixo da
    // área de conteúdo e, com a margem padrão, o pdfkit tentaria auto-paginar
    // ao escrever ali — recursão infinita. A paginação é feita à mão
    // (ensureSpace/CONTENT_BOTTOM), então não perdemos nada.
    doc.page.margins.bottom = 0;
    doc.save();
    doc.font("Helvetica").fontSize(8).fillColor(C.slate);
    doc.text(`Relatório Executivo — ${cliente}`, LEFT, 30, { width: CONTENT_W * 0.72, lineBreak: false, ellipsis: true });
    doc.text("Confidencial", LEFT + CONTENT_W * 0.72, 30, { width: CONTENT_W * 0.28, align: "right", lineBreak: false });
    doc.moveTo(LEFT, 44).lineTo(LEFT + CONTENT_W, 44).lineWidth(0.5).strokeColor(C.line).stroke();
    const fy = PAGE_H - 40;
    doc.moveTo(LEFT, fy - 6).lineTo(LEFT + CONTENT_W, fy - 6).lineWidth(0.5).strokeColor(C.line).stroke();
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(C.slate)
      .text(`Portal de Relatórios · Abrahão Advogados   —   Página ${pageNo}`, LEFT, fy, { width: CONTENT_W, align: "center", lineBreak: false });
    doc.restore();
    y = CONTENT_TOP;
  });

  const ensureSpace = (h) => {
    if (y + h > CONTENT_BOTTOM) doc.addPage();
  };

  // Triângulo (seta) desenhado como vetor — as fontes padrão do PDF (WinAnsi)
  // não têm os glifos ▲/▼.
  const triangle = (x, yTop, w, up, color) => {
    doc.save().fillColor(color);
    if (up) doc.moveTo(x, yTop + w).lineTo(x + w / 2, yTop).lineTo(x + w, yTop + w).fill();
    else doc.moveTo(x, yTop).lineTo(x + w, yTop).lineTo(x + w / 2, yTop + w).fill();
    doc.restore();
  };

  // Desenha um texto de uma linha encolhendo a fonte até caber em maxW (o
  // lineBreak:false do pdfkit não impede a quebra de forma confiável quando o
  // texto excede a largura, então garantimos o ajuste medindo).
  const fitText = (text, x, yy, maxW, { font = "Helvetica", size, minSize = 8, color, align, characterSpacing } = {}) => {
    let s = size;
    doc.font(font);
    while (s > minSize) {
      doc.fontSize(s);
      if (doc.widthOfString(String(text ?? ""), { characterSpacing }) <= maxW) break;
      s -= 0.5;
    }
    doc.fontSize(s).fillColor(color).text(String(text ?? ""), x, yy, { width: maxW, lineBreak: false, align, characterSpacing });
    return s;
  };

  // Trunca com reticências até caber em maxW, mantendo o texto em uma linha.
  const ellip = (text, maxW, font, size, characterSpacing) => {
    doc.font(font).fontSize(size);
    const s = String(text ?? "");
    if (doc.widthOfString(s, { characterSpacing }) <= maxW) return s;
    let t = s;
    while (t.length > 1 && doc.widthOfString(t + "…", { characterSpacing }) > maxW) t = t.slice(0, -1);
    return t + "…";
  };

  const heading = (text) => {
    ensureSpace(30);
    doc.font("Helvetica-Bold").fontSize(9).fillColor(C.navy).text(text.toUpperCase(), LEFT, y, { characterSpacing: 1, lineBreak: false });
    doc.moveTo(LEFT, y + 14).lineTo(LEFT + CONTENT_W, y + 14).lineWidth(1).strokeColor(C.gold).stroke();
    y += 26;
  };

  // Mesma semântica de cor das setas do .docx/web: "neutral" não julga direção;
  // "invert" inverte qual direção é a "ruim".
  const deltaInfo = ({ pctValue, countDiff, invert = false, neutral = false }) => {
    if (pctValue == null && countDiff == null) return { text: "sem dado do mês anterior", color: C.slate, dir: null };
    if (countDiff != null) {
      if (countDiff === 0) return { text: "sem variação", color: C.slate, dir: null };
      const up = countDiff > 0;
      return { text: `${Math.abs(countDiff)} vs. mês anterior`, color: neutral ? C.navyLight : up !== invert ? C.red : C.green, bold: true, dir: up ? "up" : "down" };
    }
    if (Math.abs(pctValue) < 0.5) return { text: "sem variação", color: C.slate, dir: null };
    const up = pctValue > 0;
    return { text: `${Math.abs(pctValue).toFixed(1)}% vs. mês anterior`, color: neutral ? C.navyLight : up !== invert ? C.red : C.green, bold: true, dir: up ? "up" : "down" };
  };

  // -------------------------------------------------------------------------
  // Capa
  // -------------------------------------------------------------------------
  const coverBand = () => {
    const padX = 22;
    const innerW = CONTENT_W - padX * 2;
    const nome = (cliente ?? "").toUpperCase();
    // Nomes longos usam corpo menor; ainda assim podem ocupar duas linhas, e a
    // altura da faixa se ajusta para não sobrepor a linha de referência.
    const nameSize = nome.length <= 22 ? 23 : nome.length <= 34 ? 19 : 16;
    doc.font("Times-Bold").fontSize(nameSize);
    const nameH = doc.heightOfString(nome, { width: innerW });
    const nameTop = 32;
    const refTop = nameTop + nameH + 10;
    const h = refTop + 24;
    const yTop = y;
    doc.save();
    doc.rect(LEFT, yTop, CONTENT_W, h).fill(C.navy);
    doc.fillColor(C.gold).font("Helvetica-Bold").fontSize(8).text("RELATÓRIO EXECUTIVO", LEFT + padX, yTop + 14, { characterSpacing: 3, lineBreak: false });
    doc.fillColor("#FFFFFF").font("Times-Bold").fontSize(nameSize).text(nome, LEFT + padX, yTop + nameTop, { width: innerW });
    doc
      .fillColor("#C7CEDA")
      .font("Helvetica")
      .fontSize(9)
      .text(`Referência: ${mesReferencia}    •    Versão ${versao ?? 1}    •    Gerado em ${dataFmt}`, LEFT + padX, yTop + refTop, { width: innerW, lineBreak: false });
    doc.restore();
    y = yTop + h + 16;
  };

  // -------------------------------------------------------------------------
  // KPIs (com variação vs. mês anterior)
  // -------------------------------------------------------------------------
  const kpiCards = () => {
    const semProvisaoPct = kpisSeguro.processos ? Math.round((kpisSeguro.semProvisao / kpisSeguro.processos) * 100) : 0;
    // Nos cards usamos a moeda sem centavos (mais estreita) a partir do valor
    // numérico, caindo para a string pré-formatada só se o número faltar.
    const valorEnvolvido = kpisSeguro.valorEnvolvidoNum != null ? money(kpisSeguro.valorEnvolvidoNum) : kpisSeguro.valorEnvolvido ?? "—";
    const provisaoTotal = kpisSeguro.provisaoNum != null ? money(kpisSeguro.provisaoNum) : kpisSeguro.provisao ?? "—";
    const cards = [
      { label: "Processos ativos", value: String(kpisSeguro.processos ?? 0), delta: deltaInfo({ countDiff: kpisAnterior ? kpisSeguro.processos - kpisAnterior.processos : null, neutral: true }) },
      { label: "Valor envolvido", value: valorEnvolvido, delta: deltaInfo({ pctValue: kpisAnterior ? pctChange(kpisSeguro.valorEnvolvidoNum, kpisAnterior.valorEnvolvidoNum) : null }) },
      { label: "Provisão total", value: provisaoTotal, delta: deltaInfo({ pctValue: kpisAnterior ? pctChange(kpisSeguro.provisaoNum, kpisAnterior.provisaoNum) : null, neutral: true }) },
      {
        label: "Sem provisão adequada",
        value: `${kpisSeguro.semProvisao ?? 0} (${semProvisaoPct}%)`,
        alert: (kpisSeguro.semProvisao ?? 0) > 0,
        delta: { text: (kpisSeguro.semProvisao ?? 0) > 0 ? "requer atenção da diretoria jurídica" : "carteira integralmente provisionada", color: (kpisSeguro.semProvisao ?? 0) > 0 ? C.red : C.green, dir: null },
      },
    ];

    const n = 4;
    const gap = 10;
    const h = 74;
    const cardW = (CONTENT_W - gap * (n - 1)) / n;
    ensureSpace(h + 4);
    const yTop = y;
    cards.forEach((card, i) => {
      const x = LEFT + i * (cardW + gap);
      const border = card.alert ? C.red : C.gold;
      doc.save();
      doc.rect(x, yTop, cardW, h).fill(card.alert ? "#FBEAEA" : "#FFFFFF");
      if (!card.alert) doc.rect(x, yTop, cardW, h).lineWidth(0.5).strokeColor(C.line).stroke();
      doc.rect(x, yTop, cardW, 2.5).fill(border);
      doc.fillColor(C.slate).font("Helvetica").fontSize(6.5).text(ellip(card.label.toUpperCase(), cardW - 20, "Helvetica", 6.5, 0.4), x + 10, yTop + 13, { characterSpacing: 0.4, lineBreak: false });
      fitText(card.value, x + 10, yTop + 25, cardW - 20, { font: "Times-Bold", size: 15, minSize: 9, color: card.alert ? C.red : C.navy });
      const d = card.delta;
      const dy = yTop + 53;
      let tx = x + 10;
      if (d.dir) {
        triangle(tx, dy + 1.5, 4.5, d.dir === "up", d.color);
        tx += 7;
      }
      fitText(d.text, tx, dy, x + cardW - 10 - tx, { font: d.bold ? "Helvetica-Bold" : "Helvetica", size: 6.5, minSize: 5, color: d.color });
      doc.restore();
    });
    y = yTop + h + 18;
  };

  // -------------------------------------------------------------------------
  // Panorama da carteira — rosca por área (esq.) + maiores exposições (dir.)
  // -------------------------------------------------------------------------
  const panoramaSection = () => {
    heading("Panorama da carteira");
    const { legenda, topExposicoes } = panoramaView;
    const gap = 22;
    const leftColW = 218;
    const rightColX = LEFT + leftColW + gap;
    const rightColW = CONTENT_W - leftColW - gap;

    const donutW = donutPng ? 128 : 0;
    const leftH = 16 + donutW + 12 + legenda.length * 15;
    const rankItemH = 30;
    const rightH = topExposicoes.length ? 16 + topExposicoes.length * rankItemH : 30;
    ensureSpace(Math.max(leftH, rightH) + 6);
    const yTop = y;

    // Coluna esquerda: título + rosca + legenda
    let ly = yTop;
    doc.fillColor(C.slate).font("Helvetica").fontSize(6.5).text("CARTEIRA POR ÁREA DO DIREITO", LEFT, ly, { width: leftColW, align: "center", characterSpacing: 0.5, lineBreak: false });
    ly += 16;
    if (donutPng) {
      doc.image(donutPng.buffer, LEFT + (leftColW - donutW) / 2, ly, { width: donutW });
      ly += donutW + 12;
    }
    legenda.forEach((l) => {
      doc.save().rect(LEFT, ly + 2, 8, 8).fill(l.color).restore();
      doc.fillColor("#44546A").font("Helvetica").fontSize(7.5).text(ellip(`${l.area} (${l.count})`, leftColW - 14 - 96, "Helvetica", 7.5), LEFT + 14, ly + 1, { lineBreak: false });
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(7.5).text(money(l.valor), LEFT + leftColW - 90, ly + 1, { width: 62, align: "right", lineBreak: false });
      doc.fillColor(C.slate).font("Helvetica").fontSize(7).text(`${l.pct.toFixed(0)}%`, LEFT + leftColW - 24, ly + 1, { width: 24, align: "right", lineBreak: false });
      ly += 15;
    });

    // Coluna direita: ranking de maiores exposições
    let ry = yTop;
    doc.fillColor(C.slate).font("Helvetica").fontSize(6.5).text("MAIORES EXPOSIÇÕES DA CARTEIRA", rightColX, ry, { width: rightColW, characterSpacing: 0.5, lineBreak: false });
    ry += 16;
    const maxTop = topExposicoes[0]?.valor || 0;
    if (topExposicoes.length) {
      topExposicoes.forEach((p, i) => {
        doc.fillColor(C.gold).font("Times-Bold").fontSize(9).text(String(i + 1), rightColX, ry, { width: 14, lineBreak: false });
        doc.fillColor("#1C2430").font("Helvetica-Bold").fontSize(7.8).text(ellip(p.parte || "Parte não identificada", rightColW - 16 - 74, "Helvetica-Bold", 7.8), rightColX + 16, ry, { lineBreak: false });
        doc.fillColor(C.navy).font("Times-Bold").fontSize(8.5).text(p.valorFormatado ?? "-", rightColX + rightColW - 72, ry, { width: 72, align: "right", lineBreak: false });
        doc.fillColor(C.slate).font("Helvetica").fontSize(6.5).text(ellip(`${p.area ?? "-"} · ${p.numero}`, rightColW - 16, "Helvetica", 6.5), rightColX + 16, ry + 11, { lineBreak: false });
        const barW = rightColW - 16;
        const frac = maxTop > 0 ? p.valor / maxTop : 0;
        const filled = Math.max(frac > 0 ? 3 : 0, Math.round(frac * barW));
        doc.save().roundedRect(rightColX + 16, ry + 21, barW, 5, 2.5).fill("#F0F1F3").restore();
        if (filled > 0) doc.save().roundedRect(rightColX + 16, ry + 21, filled, 5, 2.5).fill(categoryColor(i)).restore();
        ry += rankItemH;
      });
    } else {
      doc.fillColor(C.slate).font("Helvetica").fontSize(8).text("Sem processos suficientes para ranking.", rightColX, ry, { width: rightColW });
    }

    y = yTop + Math.max(ly - yTop, ry - yTop) + 12;
  };

  // -------------------------------------------------------------------------
  // Movimentações do período — barras por tipo
  // -------------------------------------------------------------------------
  const movBars = () => {
    heading("Movimentações do período");
    const counts = countByTipo(movs);
    const max = Math.max(1, ...Object.values(counts));
    const labelW = 180;
    const countW = 28;
    const barX = LEFT + labelW + 10;
    const barW = CONTENT_W - labelW - 10 - countW - 10;
    TIPOS.forEach(({ tipo, label, color }) => {
      ensureSpace(18);
      const ry = y;
      doc.fillColor("#1C2430").font("Helvetica").fontSize(9).text(label, LEFT, ry + 2, { width: labelW, lineBreak: false });
      const frac = counts[tipo] / max;
      const filled = Math.max(frac > 0 ? 3 : 0, Math.round(frac * barW));
      doc.save().roundedRect(barX, ry + 3, barW, 8, 4).fill("#F0F1F3").restore();
      if (filled > 0) doc.save().roundedRect(barX, ry + 3, filled, 8, 4).fill(color).restore();
      doc.fillColor(C.navy).font("Times-Bold").fontSize(11).text(String(counts[tipo]), LEFT + CONTENT_W - countW, ry, { width: countW, align: "right", lineBreak: false });
      y = ry + 18;
    });
    y += 10;
  };

  // -------------------------------------------------------------------------
  // Destaques do período (IA) — cartões
  // -------------------------------------------------------------------------
  const destaques = () => {
    heading("Destaques do período");
    const padX = 14;
    const padY = 12;
    const innerX = LEFT + padX + 6; // 6 = faixa dourada à esquerda
    const innerW = CONTENT_W - padX * 2 - 6;
    narrativasSeguras.forEach((n) => {
      doc.font("Helvetica-Bold").fontSize(10);
      const tituloH = doc.heightOfString(n.titulo ?? "", { width: innerW });
      doc.font("Helvetica").fontSize(9);
      const textoH = doc.heightOfString(n.texto ?? "", { width: innerW });
      const cardH = padY + tituloH + 5 + textoH + 7 + 9 + padY;
      ensureSpace(cardH + 8);
      const yTop = y;
      doc.save().rect(LEFT, yTop, CONTENT_W, cardH).fill("#FBFAF7").restore();
      doc.save().rect(LEFT, yTop, 4, cardH).fill(C.gold).restore();
      let ty = yTop + padY;
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(10).text(n.titulo ?? "", innerX, ty, { width: innerW });
      ty += tituloH + 5;
      doc.fillColor("#2A3140").font("Helvetica").fontSize(9).text(n.texto ?? "", innerX, ty, { width: innerW });
      ty += textoH + 7;
      doc.fillColor(C.slate).font("Helvetica").fontSize(6.8).text(`FONTE — ${n.fonte ?? ""}`, innerX, ty, { width: innerW, characterSpacing: 0.5, lineBreak: false, ellipsis: true });
      y = yTop + cardH + 10;
    });
  };

  // -------------------------------------------------------------------------
  // Movimentações detalhadas — tabela
  // -------------------------------------------------------------------------
  const drawVariacao = (m, x, ry, w, rowH) => {
    const cy = ry + rowH / 2 - 4;
    if (m.tipo === "encerrado") {
      doc.fillColor(C.slate).font("Helvetica-Oblique").fontSize(7).text("saiu da carteira", x, cy, { width: w, lineBreak: false, ellipsis: true });
      return;
    }
    if (m.tipo === "novo" || m.deltaValor == null) {
      if (m.statusAnterior && m.statusAtual && m.statusAnterior !== m.statusAtual)
        doc.fillColor("#7A5F26").font("Helvetica-Oblique").fontSize(7).text("status alterado", x, cy, { width: w, lineBreak: false, ellipsis: true });
      else doc.fillColor(C.slate).font("Helvetica").fontSize(7.5).text("—", x, cy, { width: w, lineBreak: false });
      return;
    }
    if (m.deltaValor !== 0) {
      const up = m.deltaValor > 0;
      const color = up ? C.red : C.green;
      triangle(x, cy + 1, 5, up, color);
      doc.fillColor(color).font("Helvetica-Bold").fontSize(7.5).text(money(Math.abs(m.deltaValor)), x + 8, cy, { width: w - 8, lineBreak: false, ellipsis: true });
      return;
    }
    doc.fillColor(C.slate).font("Helvetica").fontSize(7.5).text("—", x, cy, { width: w, lineBreak: false });
  };

  const tabela = () => {
    heading("Movimentações detalhadas");
    const fracs = [0.12, 0.28, 0.15, 0.16, 0.15, 0.14];
    const widths = fracs.map((f) => f * CONTENT_W);
    const xs = [];
    let acc = LEFT;
    for (const w of widths) {
      xs.push(acc);
      acc += w;
    }
    const headerH = 20;
    const rowH = 26;
    const labels = ["TIPO", "PARTE / PROCESSO", "ÁREA", "VALOR ATUAL", "VARIAÇÃO", "SITUAÇÃO"];

    const drawTableHeader = () => {
      doc.save().rect(LEFT, y, CONTENT_W, headerH).fill(C.navy).restore();
      doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(6.5);
      labels.forEach((l, i) => doc.text(l, xs[i] + 6, y + 7, { width: widths[i] - 8, characterSpacing: 0.5, lineBreak: false, ellipsis: true }));
      y += headerH;
    };

    ensureSpace(headerH + rowH);
    drawTableHeader();
    sortMovimentacoes(movs).forEach((m, i) => {
      if (y + rowH > CONTENT_BOTTOM) {
        doc.addPage();
        drawTableHeader();
      }
      const ry = y;
      if (i % 2 === 1) doc.save().rect(LEFT, ry, CONTENT_W, rowH).fill(C.zebra).restore();
      doc.moveTo(LEFT, ry + rowH).lineTo(LEFT + CONTENT_W, ry + rowH).lineWidth(0.5).strokeColor("#F1F2F4").stroke();

      const b = TIPO_BADGE[m.tipo] ?? TIPO_BADGE.movimentacao;
      doc.font("Helvetica-Bold").fontSize(5.6);
      const bw = Math.min(doc.widthOfString(b.label) + 8, widths[0] - 8);
      doc.save().roundedRect(xs[0] + 6, ry + rowH / 2 - 5.5, bw, 11, 2).fill(b.fill).restore();
      doc.fillColor(b.color).font("Helvetica-Bold").fontSize(5.6).text(b.label, xs[0] + 6, ry + rowH / 2 - 2.6, { width: bw, align: "center", lineBreak: false });

      doc.fillColor("#1C2430").font("Helvetica-Bold").fontSize(8).text(ellip(m.parte || "Parte não identificada", widths[1] - 10, "Helvetica-Bold", 8), xs[1] + 6, ry + 5, { lineBreak: false });
      doc.fillColor(C.slate).font("Courier").fontSize(6.5).text(ellip(m.numero ?? "", widths[1] - 10, "Courier", 6.5), xs[1] + 6, ry + 16, { lineBreak: false });
      doc.fillColor("#44546A").font("Helvetica").fontSize(7.5).text(ellip(m.area ?? "-", widths[2] - 10, "Helvetica", 7.5), xs[2] + 6, ry + rowH / 2 - 4, { lineBreak: false });
      doc.fillColor(C.navy).font("Helvetica-Bold").fontSize(8).text(m.valorFormatado ?? "-", xs[3] + 6, ry + rowH / 2 - 4, { width: widths[3] - 10, lineBreak: false });
      drawVariacao(m, xs[4] + 6, ry, widths[4] - 10, rowH);
      const sit = m.tipo === "encerrado" ? m.statusAnterior ?? "Encerrado" : m.statusAtual ?? "-";
      doc.fillColor("#44546A").font("Helvetica").fontSize(7.5).text(ellip(sit, widths[5] - 8, "Helvetica", 7.5), xs[5] + 6, ry + rowH / 2 - 4, { lineBreak: false });
      y = ry + rowH;
    });
    y += 6;
  };

  const anexosNote = () => {
    ensureSpace(22);
    doc
      .fillColor(C.slate)
      .font("Helvetica-Oblique")
      .fontSize(7.5)
      .text(`${totalAnexos ?? 0} documento(s) de apoio anexado(s) e referenciado(s) nesta análise.`, LEFT, y + 6, { width: CONTENT_W, lineBreak: false, ellipsis: true });
    y += 24;
  };

  // -------------------------------------------------------------------------
  // Montagem
  // -------------------------------------------------------------------------
  doc.addPage();
  coverBand();
  kpiCards();
  if (panoramaView.legenda.length > 0) panoramaSection();
  if (movs.length > 0) movBars();
  if (narrativasSeguras.length > 0) destaques();
  if (movs.length > 0) tabela();
  anexosNote();

  doc.end();
  return done;
}
