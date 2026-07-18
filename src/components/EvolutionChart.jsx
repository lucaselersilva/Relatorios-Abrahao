import React from "react";

// Evolução mensal da carteira: barras (nº de processos, eixo secundário) +
// duas linhas (valor envolvido e provisão, eixo de R$). SVG puro, mesma paleta
// do Donut/relatório — sem biblioteca de gráficos.

const NAVY = "#142B4B";
const GOLD = "#9C7C38";
const TRACK = "#E5E8EE";
const SLATE = "#7A8394";
const LINE = "#EDEFF3";

const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function rotuloCurto(periodo) {
  if (typeof periodo !== "string" || !/^\d{4}-\d{2}$/.test(periodo)) return periodo ?? "";
  const [ano, mes] = periodo.split("-");
  return `${MESES_ABREV[Number(mes) - 1]}/${ano.slice(2)}`;
}

function compactMoney(v) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function fullMoney(v) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function EvolutionChart({ data }) {
  if (!data || data.length < 2) {
    return (
      <div className="bg-white border border-[#E2E5EA] rounded-lg px-6 py-8 text-center text-[13px] text-[#9AA2AF]">
        Ainda não há histórico suficiente para o gráfico. Envie ao menos dois meses da carteira deste cliente.
      </div>
    );
  }

  const n = data.length;
  const W = Math.max(480, n * 84);
  const H = 280;
  const pad = { left: 20, right: 20, top: 22, bottom: 44 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const baseline = pad.top + chartH;

  const maxMoney = Math.max(1, ...data.map((d) => Math.max(d.valorEnvolvido ?? 0, d.provisao ?? 0)));
  const maxProc = Math.max(1, ...data.map((d) => d.processos ?? 0));

  const slot = chartW / n;
  const cx = (i) => pad.left + slot * (i + 0.5);
  const yMoney = (v) => pad.top + chartH * (1 - (v ?? 0) / maxMoney);
  const yProc = (v) => pad.top + chartH * (1 - (v ?? 0) / maxProc);
  const barW = Math.min(28, slot * 0.42);

  const gridVals = [0, maxMoney / 2, maxMoney];
  const linePoints = (key) => data.map((d, i) => `${cx(i)},${yMoney(d[key])}`).join(" ");

  return (
    <div className="bg-white border border-[#E2E5EA] rounded-lg px-5 py-4">
      <div className="flex items-center gap-4 mb-3 text-[11px] text-[#7A8394] flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[3px] rounded-full" style={{ backgroundColor: NAVY }} /> Valor envolvido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-[3px] rounded-full" style={{ backgroundColor: GOLD }} /> Provisão
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TRACK }} /> Nº de processos
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="min-w-[480px]" style={{ height: "auto" }} role="img" aria-label="Gráfico de evolução da carteira">
          {/* Grades + rótulos de R$ */}
          {gridVals.map((g, i) => (
            <g key={i}>
              <line x1={pad.left} y1={yMoney(g)} x2={W - pad.right} y2={yMoney(g)} stroke={LINE} strokeWidth={1} />
              <text x={pad.left} y={yMoney(g) - 4} fontSize={10} fill={SLATE} fontFamily="Arial, sans-serif">
                {compactMoney(g)}
              </text>
            </g>
          ))}

          {/* Barras: nº de processos */}
          {data.map((d, i) => {
            const h = baseline - yProc(d.processos);
            return (
              <g key={`bar-${i}`}>
                <rect x={cx(i) - barW / 2} y={yProc(d.processos)} width={barW} height={Math.max(0, h)} rx={2} fill={TRACK}>
                  <title>{`${d.mesReferencia}: ${d.processos} processos`}</title>
                </rect>
                <text x={cx(i)} y={yProc(d.processos) - 4} fontSize={10} fill={SLATE} textAnchor="middle" fontFamily="Arial, sans-serif">
                  {d.processos}
                </text>
              </g>
            );
          })}

          {/* Linhas de R$ */}
          <polyline points={linePoints("provisao")} fill="none" stroke={GOLD} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={linePoints("valorEnvolvido")} fill="none" stroke={NAVY} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* Pontos + rótulos do eixo x */}
          {data.map((d, i) => (
            <g key={`pt-${i}`}>
              <circle cx={cx(i)} cy={yMoney(d.provisao)} r={3} fill={GOLD}>
                <title>{`${d.mesReferencia} · Provisão: ${fullMoney(d.provisao)}`}</title>
              </circle>
              <circle cx={cx(i)} cy={yMoney(d.valorEnvolvido)} r={3.5} fill={NAVY}>
                <title>{`${d.mesReferencia} · Valor envolvido: ${fullMoney(d.valorEnvolvido)}`}</title>
              </circle>
              <text x={cx(i)} y={H - 24} fontSize={10.5} fill="#44546A" textAnchor="middle" fontFamily="Arial, sans-serif">
                {rotuloCurto(d.periodo)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-2 text-[11px] text-[#9AA2AF]">
        Último mês ({data[n - 1].mesReferencia}): {fullMoney(data[n - 1].valorEnvolvido)} envolvidos · {fullMoney(data[n - 1].provisao)} provisionados · {data[n - 1].processos} processos.
      </div>
    </div>
  );
}
