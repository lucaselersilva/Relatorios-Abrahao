import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } from "docx";

const NAVY = "142B4B";
const GOLD = "9C7C38";

function kpiRow(kpis) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          ["Processos ativos", String(kpis.processos)],
          ["Valor envolvido", kpis.valorEnvolvido],
          ["Provisão total", kpis.provisao],
          ["Sem provisão adequada", String(kpis.semProvisao)],
        ].map(
          ([label, value]) =>
            new TableCell({
              children: [
                new Paragraph({ children: [new TextRun({ text: value, bold: true, size: 24 })] }),
                new Paragraph({ children: [new TextRun({ text: label, size: 16, color: "7A8394" })] }),
              ],
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
            })
        ),
      }),
    ],
  });
}

export async function generateReportDocx({ cliente, mesReferencia, versao, kpis, narrativas, movimentacoes, totalAnexos }) {
  const referencia = `Referência: ${mesReferencia}${versao ? ` — Versão ${versao}` : ""}`;
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "RELATÓRIO EXECUTIVO", bold: true, size: 32, color: NAVY })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: cliente.toUpperCase(), bold: true, size: 24, color: GOLD })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: referencia, size: 18, color: "7A8394" })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Sumário executivo", color: NAVY })] }),
          kpiRow(kpis),
          new Paragraph({ text: "" }),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Análise do período", color: NAVY })] }),
          ...narrativas.flatMap((n) => [
            new Paragraph({ children: [new TextRun({ text: n.titulo, bold: true, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: n.texto, size: 20 })] }),
            new Paragraph({ children: [new TextRun({ text: `Fonte: ${n.fonte}`, italics: true, size: 16, color: "9AA2AF" })] }),
            new Paragraph({ text: "" }),
          ]),
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: "Panorama da carteira", color: NAVY })] }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: ["Parte", "Área", "Processo", "Valor", "Resumo"].map(
                  (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })] })
                ),
              }),
              ...movimentacoes.map(
                (m) =>
                  new TableRow({
                    children: [m.parte ?? "-", m.area ?? "-", m.numero, m.valorFormatado ?? "-", m.resumo].map(
                      (v) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 18 })] })] })
                    ),
                  })
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            children: [new TextRun({ text: `${totalAnexos} documento(s) anexado(s) e referenciado(s) nesta análise.`, size: 16, color: "7A8394" })],
          }),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
