import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2, AlertTriangle, FileText, ChevronRight, Paperclip } from "lucide-react";
import { api } from "../lib/api.js";

const NAVY = "#142B4B";
const GOLD = "#9C7C38";
const GREEN = "#3F6B4F";
const RED = "#A33B3B";
const SLATE = "#7A8394";

const CATEGORY_COLORS = ["#142B4B", "#9C7C38", "#3F6B4F", "#6E5AA0", "#2E7D8C", "#A33B3B", "#7A8394", "#C7A968"];
const colorFor = (i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length];

const TIPO_BADGE = {
  novo: { label: "Novo", cls: "bg-[#142B4B] text-white" },
  movimentacao: { label: "Alteração", cls: "bg-[#EFE6D2] text-[#7A5F26]" },
  acordo: { label: "Acordo", cls: "bg-[#E4EDE7] text-[#2F5D45]" },
};

function money(v) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Mesma lógica do gerador de .docx (lib/diff.js + lib/docx-generator.js):
// setas coloridas por semântica — "neutral" não julga a direção, e "invert"
// inverte qual direção é a "ruim" (ex.: valor envolvido subir é ruim).
function KpiDelta({ curr, prev, isPct = true, neutral = false, invert = false }) {
  if (prev == null) return <span className="text-[11px] text-[#9AA2AF] italic">sem dado do mês anterior</span>;

  const diff = curr - prev;
  const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : null;
  const magnitude = isPct ? pct : diff;

  if (magnitude == null || Math.abs(magnitude) < (isPct ? 0.5 : 1)) {
    return <span className="text-[11px] text-[#9AA2AF]">sem variação</span>;
  }

  const up = magnitude > 0;
  const color = neutral ? "#44546A" : up !== invert ? RED : GREEN;
  const texto = isPct ? `${Math.abs(magnitude).toFixed(1)}%` : String(Math.abs(magnitude));
  return (
    <span className="text-[11px] font-semibold" style={{ color }}>
      {up ? "▲" : "▼"} {texto} vs. mês anterior
    </span>
  );
}

function KpiCard({ label, value, alert, children }) {
  return (
    <div
      className="bg-white rounded-lg px-4 py-3.5 min-w-0 border-t-[3px]"
      style={{ borderColor: alert ? RED : GOLD, backgroundColor: alert ? "#FBEAEA" : "#FFFFFF" }}
    >
      <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1.5">{label}</div>
      <div className="text-[19px] font-semibold break-words mb-1" style={{ fontFamily: "Georgia, serif", color: alert ? RED : NAVY }}>
        {value}
      </div>
      {children}
    </div>
  );
}

// Rosca (donut) em SVG puro — mesma matemática do gráfico do .docx, incluindo
// a correção de ponta reta (butt) para fatias pequenas não virarem "bolhas"
// desproporcionais.
function Donut({ data, size = 180, thickness = 30 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gapArc = data.filter((d) => d.value > 0).length > 1 ? circumference * 0.01 : 0;

  let acc = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = d.value / (total || 1);
      const dash = Math.max(0, frac * circumference - gapArc);
      const offset = circumference * 0.25 - acc * circumference;
      acc += frac;
      return { ...d, dash, offset };
    });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EDEFF3" strokeWidth={thickness} />
      {segments.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={thickness}
          strokeDasharray={`${s.dash} ${circumference - s.dash}`}
          strokeDashoffset={s.offset}
          strokeLinecap="butt"
        />
      ))}
    </svg>
  );
}

function ProportionalBar({ frac, color }) {
  const pct = Math.min(100, Math.max(frac > 0 ? 3 : 0, Math.round(frac * 100)));
  return (
    <div className="h-[10px] rounded-full bg-[#F0F1F3] overflow-hidden w-full">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function RelatorioVisualizar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    api
      .getReport(id)
      .then(setData)
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const panoramaView = useMemo(() => {
    if (!data?.panorama) return null;
    const { porArea, topExposicoes } = data.panorama;
    const totalValor = porArea.reduce((s, a) => s + a.valor, 0) || 1;
    const MAX_FATIAS = 6;
    const principais = porArea.slice(0, MAX_FATIAS);
    const outras = porArea.slice(MAX_FATIAS);
    const outrasValor = outras.reduce((s, a) => s + a.valor, 0);
    const outrasCount = outras.reduce((s, a) => s + a.count, 0);

    const legenda = principais.map((a, i) => ({ ...a, color: colorFor(i), pct: (a.valor / totalValor) * 100 }));
    if (outras.length > 0) legenda.push({ area: "Outras áreas", valor: outrasValor, count: outrasCount, color: SLATE, pct: (outrasValor / totalValor) * 100 });

    return { donutData: legenda.map((l) => ({ value: l.valor, color: l.color })), legenda, topExposicoes };
  }, [data]);

  const movPorTipo = useMemo(() => {
    const contagem = { novo: 0, movimentacao: 0, acordo: 0 };
    for (const m of data?.movimentacoes ?? []) contagem[m.tipo] = (contagem[m.tipo] ?? 0) + 1;
    return contagem;
  }, [data]);

  const handleDownload = async () => {
    setBaixando(true);
    try {
      const url = await api.getDownloadUrl(id);
      window.open(url, "_blank");
    } catch (e) {
      setErro(e.message || "Erro ao baixar relatório");
    } finally {
      setBaixando(false);
    }
  };

  if (loading) {
    return (
      <div className="px-10 py-10 flex items-center gap-2 text-[13px] text-[#7A8394]">
        <Loader2 size={16} className="animate-spin" /> Carregando relatório…
      </div>
    );
  }

  if (erro && !data) {
    return (
      <div className="px-10 py-10">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[12px] text-[#7A8394] hover:text-[#142B4B] mb-4">
          <ArrowLeft size={13} /> Voltar
        </button>
        <div className="bg-[#FBEAEA] border border-[#E9C6C6] text-[#A33B3B] text-[13px] px-4 py-3 rounded-lg">{erro}</div>
      </div>
    );
  }

  const { client, mesReferencia, versao, status, kpis, kpisAnterior, movimentacoes = [], narrativas = [], attachments = [], docxKey } = data;
  const maxTop = panoramaView?.topExposicoes?.[0]?.valor || 0;
  const maxMov = Math.max(1, ...Object.values(movPorTipo));

  const movimentacoesOrdenadas = [...movimentacoes].sort((a, b) => {
    const pesoA = a.prioridade === "alta" ? 1 : 0;
    const pesoB = b.prioridade === "alta" ? 1 : 0;
    if (pesoA !== pesoB) return pesoB - pesoA;
    return (b.valor ?? 0) - (a.valor ?? 0);
  });

  return (
    <div className="px-10 py-9 max-w-5xl">
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[12px] text-[#7A8394] hover:text-[#142B4B]">
          <ArrowLeft size={13} /> Voltar
        </button>
        {docxKey ? (
          <button
            onClick={handleDownload}
            disabled={baixando}
            className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
          >
            {baixando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar .docx
          </button>
        ) : (
          <button
            onClick={() => navigate(`/relatorios/novo?reportId=${id}`)}
            className="flex items-center gap-2 border border-[#D9DCE1] text-[#8A6D1F] text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#F5F6F8] transition-colors"
          >
            <ChevronRight size={14} /> Continuar rascunho
          </button>
        )}
      </div>

      {erro && (
        <div className="mb-5 flex items-center gap-2 bg-[#FBEAEA] border border-[#E9C6C6] text-[#A33B3B] text-[13px] px-4 py-3 rounded-lg">
          <AlertTriangle size={14} /> {erro}
        </div>
      )}

      {/* Capa */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ backgroundColor: NAVY }}>
        <div className="px-7 py-7">
          <div className="text-[11px] font-bold tracking-[0.15em]" style={{ color: GOLD }}>
            RELATÓRIO EXECUTIVO
          </div>
          <div className="text-[28px] font-semibold text-white mt-1.5" style={{ fontFamily: "Georgia, serif" }}>
            {client.nome}
          </div>
          <div className="text-[13px] mt-2" style={{ color: "#C7CEDA" }}>
            Referência: {mesReferencia} <span style={{ color: "#5A6B87" }}>•</span> Versão {versao}{" "}
            <span style={{ color: "#5A6B87" }}>•</span>{" "}
            {status === "pronto" ? "Finalizado" : "Rascunho"}
          </div>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-4 gap-3 mb-8">
          <KpiCard label="Processos ativos" value={String(kpis.processos)}>
            <KpiDelta curr={kpis.processos} prev={kpisAnterior?.processos} isPct={false} neutral />
          </KpiCard>
          <KpiCard label="Valor envolvido" value={kpis.valorEnvolvido ?? "—"}>
            <KpiDelta curr={kpis.valorEnvolvidoNum} prev={kpisAnterior?.valorEnvolvidoNum} />
          </KpiCard>
          <KpiCard label="Provisão total" value={kpis.provisao ?? "—"}>
            <KpiDelta curr={kpis.provisaoNum} prev={kpisAnterior?.provisaoNum} neutral />
          </KpiCard>
          <KpiCard label="Sem provisão adequada" value={`${kpis.semProvisao} (${kpis.processos ? Math.round((kpis.semProvisao / kpis.processos) * 100) : 0}%)`} alert={kpis.semProvisao > 0}>
            <span className="text-[11px] font-semibold" style={{ color: kpis.semProvisao > 0 ? RED : GREEN }}>
              {kpis.semProvisao > 0 ? "requer atenção da diretoria jurídica" : "carteira integralmente provisionada"}
            </span>
          </KpiCard>
        </div>
      )}

      {/* Panorama da carteira */}
      {panoramaView && panoramaView.legenda.length > 0 && (
        <>
          <SectionTitle text="Panorama da carteira" />
          <div className="grid grid-cols-2 gap-8 mb-9">
            <div className="flex items-center gap-6">
              <Donut data={panoramaView.donutData} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-2">Carteira por área</div>
                <div className="flex flex-col gap-1.5">
                  {panoramaView.legenda.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px]">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="text-[#44546A] truncate flex-1">{l.area} ({l.count})</span>
                      <span className="font-semibold text-[#142B4B] shrink-0">{money(l.valor)}</span>
                      <span className="text-[#9AA2AF] w-9 text-right shrink-0">{l.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-2">Maiores exposições da carteira</div>
              <div className="flex flex-col gap-3">
                {(panoramaView.topExposicoes ?? []).map((p, i) => (
                  <div key={p.numero} className="flex items-center gap-3">
                    <span className="text-[13px] font-semibold w-4 shrink-0" style={{ fontFamily: "Georgia, serif", color: GOLD }}>
                      {i + 1}
                    </span>
                    <div className="min-w-0 w-[38%] shrink-0">
                      <div className="text-[12.5px] font-medium text-[#1C2430] truncate">{p.parte || "Parte não identificada"}</div>
                      <div className="text-[11px] text-[#9AA2AF] truncate">{p.area ?? "-"} · {p.numero}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <ProportionalBar frac={maxTop > 0 ? p.valor / maxTop : 0} color={colorFor(i)} />
                    </div>
                    <span className="text-[12.5px] font-semibold shrink-0" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                      {p.valorFormatado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Movimentações por tipo */}
      {movimentacoes.length > 0 && (
        <>
          <SectionTitle text="Movimentações do período" />
          <div className="flex flex-col gap-3 mb-9">
            {[
              ["novo", "Processos novos", NAVY],
              ["movimentacao", "Alterações relevantes", GOLD],
              ["acordo", "Acordos / homologações", GREEN],
            ].map(([tipo, label, color]) => (
              <div key={tipo} className="flex items-center gap-4">
                <span className="text-[12.5px] text-[#1C2430] w-[220px] shrink-0">{label}</span>
                <div className="flex-1">
                  <ProportionalBar frac={movPorTipo[tipo] / maxMov} color={color} />
                </div>
                <span className="text-[16px] font-semibold w-6 text-right shrink-0" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                  {movPorTipo[tipo]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Destaques da IA */}
      {narrativas.length > 0 && (
        <>
          <SectionTitle text="Destaques do período" />
          <div className="flex flex-col gap-3 mb-9">
            {narrativas.map((n, i) => (
              <div key={i} className="bg-[#FBFAF7] rounded-md px-5 py-4 border-l-[3px]" style={{ borderColor: GOLD }}>
                <div className="text-[14px] font-semibold text-[#142B4B] mb-1.5">{n.titulo}</div>
                <div className="text-[13px] text-[#2A3140] leading-relaxed mb-2">{n.texto}</div>
                <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF]">Fonte — {n.fonte}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Movimentações detalhadas */}
      {movimentacoesOrdenadas.length > 0 && (
        <>
          <SectionTitle text="Movimentações detalhadas" />
          <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#EEF0F3] text-[10px] uppercase tracking-wide text-[#9AA2AF]" style={{ backgroundColor: NAVY, color: "white" }}>
                  <th className="px-4 py-2.5 font-medium">Tipo</th>
                  <th className="px-4 py-2.5 font-medium">Parte / Processo</th>
                  <th className="px-4 py-2.5 font-medium">Área</th>
                  <th className="px-4 py-2.5 font-medium">Valor atual</th>
                  <th className="px-4 py-2.5 font-medium">Variação</th>
                  <th className="px-4 py-2.5 font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoesOrdenadas.map((m, i) => {
                  const badge = TIPO_BADGE[m.tipo] ?? TIPO_BADGE.movimentacao;
                  const up = m.deltaValor > 0;
                  return (
                    <tr key={m.id ?? i} className={`text-[13px] ${i % 2 === 1 ? "bg-[#FAFAFB]" : ""} ${i !== movimentacoesOrdenadas.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1C2430]">{m.parte || "Parte não identificada"}</div>
                        <div className="text-[11px] text-[#9AA2AF] font-mono">{m.numero}</div>
                      </td>
                      <td className="px-4 py-3 text-[#44546A]">{m.area ?? "-"}</td>
                      <td className="px-4 py-3 font-semibold text-[#142B4B]">{m.valorFormatado ?? "-"}</td>
                      <td className="px-4 py-3">
                        {m.tipo === "novo" || m.deltaValor == null ? (
                          m.statusAnterior && m.statusAtual && m.statusAnterior !== m.statusAtual ? (
                            <span className="text-[12px] italic" style={{ color: "#7A5F26" }}>status alterado</span>
                          ) : (
                            <span className="text-[12px] text-[#9AA2AF]">—</span>
                          )
                        ) : (
                          <span className="text-[12px] font-semibold" style={{ color: up ? RED : GREEN }}>
                            {up ? "▲" : "▼"} {money(Math.abs(m.deltaValor))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#44546A]">{m.statusAtual ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {attachments.length > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] text-[#9AA2AF] italic mb-6">
          <Paperclip size={12} /> {attachments.length} documento(s) de apoio anexado(s) e referenciado(s) nesta análise.
        </div>
      )}

      {status === "rascunho" && (
        <div className="flex items-center gap-2 bg-[#F4EEDD] text-[#8A6D1F] text-[13px] px-4 py-3 rounded-lg mb-6">
          <FileText size={14} /> Este relatório ainda é um rascunho. Continue o assistente para gerar o .docx final.
        </div>
      )}
    </div>
  );
}

function SectionTitle({ text }) {
  return (
    <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#142B4B] mb-4 pb-2 border-b-2" style={{ borderColor: GOLD }}>
      {text}
    </div>
  );
}
