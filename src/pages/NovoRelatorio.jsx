import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload, CheckCircle2, ArrowRight, Sparkles, FileText, Paperclip, X, Download,
  AlertTriangle, ChevronRight, Scale, Building2, Gavel, Loader2, History, Eye,
} from "lucide-react";
import { api } from "../lib/api.js";

const NAVY = "#142B4B";

const STEPS = [
  { id: 0, label: "Cliente" },
  { id: 1, label: "Upload" },
  { id: 2, label: "O que mudou" },
  { id: 3, label: "Documentos" },
  { id: 4, label: "Análise da IA" },
  { id: 5, label: "Relatório" },
];

function Badge({ tipo }) {
  const map = {
    novo: { label: "Processo novo", cls: "bg-[#142B4B] text-white" },
    movimentacao: { label: "Movimentação", cls: "bg-[#EFE6D2] text-[#7A5F26]" },
    acordo: { label: "Acordo", cls: "bg-[#E4EDE7] text-[#2F5D45]" },
  };
  const m = map[tipo] ?? map.movimentacao;
  return <span className={`text-[11px] font-semibold tracking-wide px-2 py-1 rounded-full ${m.cls}`}>{m.label}</span>;
}

function AreaIcon({ area }) {
  if (area === "Trabalhista") return <Gavel size={15} className="text-[#44546A]" />;
  if (area === "Tributário") return <Building2 size={15} className="text-[#44546A]" />;
  return <Scale size={15} className="text-[#44546A]" />;
}

export default function NovoRelatorio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get("reportId");
  const preClientId = searchParams.get("clientId");

  const [step, setStep] = useState(0);
  const [loadingResume, setLoadingResume] = useState(!!resumeId);

  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(preClientId || "");
  const [versao, setVersao] = useState(null);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [mesReferencia, setMesReferencia] = useState("");
  const [clienteNomeExibicao, setClienteNomeExibicao] = useState("");

  const [uploading, setUploading] = useState(false);
  const [reportId, setReportId] = useState(resumeId || null);
  const [kpis, setKpis] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [selected, setSelected] = useState({});

  const [attachments, setAttachments] = useState({}); // numero -> [{id, fileName}]
  const [analyzing, setAnalyzing] = useState(false);
  const [narrativas, setNarrativas] = useState([]);
  const [finalizando, setFinalizando] = useState(false);
  const [reportFinal, setReportFinal] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    api.listClients().then(setClients).catch(console.error);
  }, []);

  useEffect(() => {
    if (!resumeId) return;
    api
      .getReport(resumeId)
      .then((r) => {
        setClienteNomeExibicao(r.client.nome);
        setMesReferencia(r.mesReferencia);
        setKpis(r.kpis);
        setVersao(r.versao ?? null);
        setMovimentacoes(r.movimentacoes ?? []);
        const attByNumero = {};
        for (const a of r.attachments) {
          attByNumero[a.processoNumero] = [...(attByNumero[a.processoNumero] ?? []), a];
        }
        setAttachments(attByNumero);
        if (r.narrativas) setNarrativas(r.narrativas);
        setStep(2);
      })
      .catch((err) => setErro(err.message))
      .finally(() => setLoadingResume(false));
  }, [resumeId]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleUploadClick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let finalClientId = clientId;
    setErro("");

    try {
      if (clientId === "__new__") {
        if (!novoClienteNome.trim()) {
          setErro("Informe o nome do novo cliente.");
          return;
        }
        const created = await api.createClient(novoClienteNome.trim());
        finalClientId = created.id;
        setClienteNomeExibicao(created.nome);
      } else {
        const c = clients.find((c) => c.id === clientId);
        setClienteNomeExibicao(c?.nome ?? "");
      }

      setUploading(true);
      const result = await api.uploadSpreadsheet(finalClientId, mesReferencia, file);
      setReportId(result.reportId);
      setKpis(result.kpis);
      setVersao(result.versao ?? null);
      setMovimentacoes(result.movimentacoes);
      setStep(2);
    } catch (err) {
      setErro(err.message || "Erro ao processar a planilha");
    } finally {
      setUploading(false);
    }
  };

  const toggleSelect = (numero) => setSelected((s) => ({ ...s, [numero]: !s[numero] }));

  const handleAttachFile = async (numero, file) => {
    if (!file) return;
    try {
      const attachment = await api.uploadAttachment(reportId, numero, file);
      setAttachments((a) => ({ ...a, [numero]: [...(a[numero] ?? []), attachment] }));
    } catch (err) {
      setErro(err.message || "Erro ao anexar documento");
    }
  };

  const removeFile = async (numero, attachmentId) => {
    try {
      await api.removeAttachment(reportId, attachmentId);
      setAttachments((a) => ({ ...a, [numero]: a[numero].filter((f) => f.id !== attachmentId) }));
    } catch (err) {
      setErro(err.message || "Erro ao remover anexo");
    }
  };

  const runAnalysis = async () => {
    setStep(4);
    setAnalyzing(true);
    setErro("");
    try {
      const result = await api.analyzeReport(reportId);
      setNarrativas(result.narrativas);
    } catch (err) {
      setErro(err.message || "Erro ao rodar análise de IA");
    } finally {
      setAnalyzing(false);
    }
  };

  const finalizeReport = async () => {
    setFinalizando(true);
    setErro("");
    try {
      await api.updateReport(reportId, { narrativas, selecionados: Object.keys(selected).filter((k) => selected[k]) });
      const final = await api.finalizeReport(reportId);
      setReportFinal(final);
      setStep(5);
    } catch (err) {
      setErro(err.message || "Erro ao finalizar relatório");
    } finally {
      setFinalizando(false);
    }
  };

  const handleDownload = async () => {
    try {
      const url = await api.getDownloadUrl(reportFinal.id);
      window.open(url, "_blank");
    } catch (err) {
      setErro(err.message || "Erro ao baixar relatório");
    }
  };

  const totalAnexos = useMemo(() => Object.values(attachments).flat().length, [attachments]);

  if (loadingResume) {
    return (
      <div className="px-10 py-10 flex items-center gap-2 text-[13px] text-[#7A8394]">
        <Loader2 size={16} className="animate-spin" /> Carregando rascunho…
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-[#E2E5EA] bg-white px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => {
            const isDone = s.id < step;
            const isActive = s.id === step;
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2 px-2 py-1 rounded-md">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                      isActive ? "bg-[#142B4B] text-white" : isDone ? "bg-[#EFE6D2] text-[#9C7C38]" : "bg-[#EEF0F3] text-[#9AA2AF]"
                    }`}
                  >
                    {isDone ? <CheckCircle2 size={12} /> : s.id + 1}
                  </div>
                  <span className={`text-[12.5px] ${isActive ? "font-semibold text-[#142B4B]" : isDone ? "text-[#44546A]" : "text-[#9AA2AF]"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight size={13} className="text-[#D9DCE1] mx-0.5" />}
              </React.Fragment>
            );
          })}
        </div>
        <div className="text-[11px] text-[#9AA2AF]">
          {clienteNomeExibicao
            ? `${clienteNomeExibicao} · ${mesReferencia}${versao ? ` · versão ${versao}` : ""}`
            : ""}
        </div>
      </div>

      <div className="px-10 py-9 max-w-3xl">
        {erro && (
          <div className="mb-5 flex items-center gap-2 bg-[#FBEAEA] border border-[#E9C6C6] text-[#A33B3B] text-[13px] px-4 py-3 rounded-lg">
            <AlertTriangle size={14} /> {erro}
          </div>
        )}

        {/* STEP 0 — cliente */}
        {step === 0 && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              Nova versão do relatório
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">
              Selecione o cliente (ou cadastre um novo). Cada envio de planilha gera uma nova versão do relatório
              daquele cliente, mantendo as anteriores no histórico.
            </p>

            <label className="block text-[12px] font-medium text-[#44546A] mb-1">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full mb-4 text-[13px] border border-[#D9DCE1] rounded-lg px-3 py-2.5 outline-none focus:border-[#9C7C38] bg-white"
            >
              <option value="">Selecione…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
              <option value="__new__">+ Cadastrar novo cliente</option>
            </select>

            {clientId === "__new__" && (
              <>
                <label className="block text-[12px] font-medium text-[#44546A] mb-1">Nome do novo cliente</label>
                <input
                  value={novoClienteNome}
                  onChange={(e) => setNovoClienteNome(e.target.value)}
                  className="w-full mb-4 text-[13px] border border-[#D9DCE1] rounded-lg px-3 py-2.5 outline-none focus:border-[#9C7C38]"
                  placeholder="Ex: Construtora Alfa"
                />
              </>
            )}

            <label className="block text-[12px] font-medium text-[#44546A] mb-1">Mês de referência</label>
            <input
              value={mesReferencia}
              onChange={(e) => setMesReferencia(e.target.value)}
              className="w-full mb-6 text-[13px] border border-[#D9DCE1] rounded-lg px-3 py-2.5 outline-none focus:border-[#9C7C38]"
              placeholder="Ex: Junho/2026"
            />

            <button
              disabled={!clientId || !mesReferencia || (clientId === "__new__" && !novoClienteNome.trim())}
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-40"
            >
              Continuar <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 1 — upload */}
        {step === 1 && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              Enviar planilha do mês
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">
              Suba a planilha de acompanhamento processual exportada do sistema jurídico. O portal compara automaticamente com o último mês processado.
            </p>

            <label
              className={`border-2 border-dashed rounded-xl px-8 py-14 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                uploading ? "border-[#9C7C38] bg-[#FBF8F2]" : "border-[#D9DCE1] hover:border-[#9C7C38] hover:bg-[#FBF8F2]"
              }`}
            >
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadClick} disabled={uploading} />
              {uploading ? (
                <>
                  <Loader2 size={30} className="animate-spin text-[#142B4B] mb-3" />
                  <div className="text-[13px] text-[#44546A]">Lendo planilha e comparando com o mês anterior…</div>
                </>
              ) : (
                <>
                  <Upload size={26} className="text-[#9AA2AF] mb-3" />
                  <div className="text-[13px] font-medium text-[#44546A]">Clique para selecionar a planilha</div>
                  <div className="text-[11px] text-[#9AA2AF] mt-1">.xlsx exportado do sistema jurídico</div>
                </>
              )}
            </label>
          </div>
        )}

        {/* STEP 2 — o que mudou */}
        {step === 2 && kpis && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              O que mudou
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">Detectado automaticamente comparando processo a processo com o mês anterior.</p>

            <div className="grid grid-cols-4 gap-3 mb-8">
              {[
                ["Processos ativos", kpis.processos],
                ["Valor envolvido", kpis.valorEnvolvido],
                ["Provisão total", kpis.provisao],
                ["Sem provisão adequada", kpis.semProvisao],
              ].map(([label, val], i) => (
                <div key={i} className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3 min-w-0">
                  <div
                    className="text-[16px] font-semibold break-words"
                    style={{ fontFamily: "Georgia, serif", color: i === 3 ? "#A33B3B" : NAVY }}
                  >
                    {val}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mt-1">{label}</div>
                </div>
              ))}
            </div>

            <div className="text-[12px] font-semibold text-[#44546A] uppercase tracking-wide mb-3">
              Movimentações relevantes ({movimentacoes.length})
            </div>

            {movimentacoes.length === 0 ? (
              <div className="bg-white border border-[#E2E5EA] rounded-lg px-6 py-10 text-center text-[13px] text-[#9AA2AF]">
                Nenhuma movimentação relevante detectada neste mês.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {movimentacoes.map((m) => (
                  <div key={m.numero} className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!selected[m.numero]}
                      onChange={() => toggleSelect(m.numero)}
                      className="mt-1.5 accent-[#142B4B]"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge tipo={m.tipo} />
                        <span className="flex items-center gap-1 text-[11px] text-[#7A8394]">
                          <AreaIcon area={m.area} /> {m.area ?? "-"}
                        </span>
                        {m.prioridade === "alta" && (
                          <span className="flex items-center gap-1 text-[11px] text-[#A33B3B]">
                            <AlertTriangle size={11} /> Prioridade alta
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] font-medium text-[#1C2430] truncate">{m.parte ?? "-"}</div>
                      <div className="text-[12px] text-[#7A8394] mt-0.5">{m.resumo}</div>
                      <div className="text-[11px] text-[#9AA2AF] mt-1 font-mono">{m.numero}</div>
                    </div>
                    <div className="text-[14px] font-semibold shrink-0" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                      {m.valorFormatado ?? "-"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-[11px] text-[#9AA2AF] mt-3">
              Marque as movimentações para as quais você quer anexar o documento — isso deixa a análise da IA mais precisa. É opcional.
            </div>

            <button
              onClick={() => setStep(3)}
              className="mt-6 inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
            >
              Continuar {selectedCount > 0 ? `(${selectedCount} selecionada${selectedCount > 1 ? "s" : ""})` : ""} <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 3 — documentos */}
        {step === 3 && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              Documentos de apoio
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">
              Opcional. Anexe petições, decisões ou sentenças das movimentações selecionadas — a IA lê o conteúdo (PDFs) e usa isso na análise.
            </p>

            {selectedCount === 0 ? (
              <div className="bg-white border border-[#E2E5EA] rounded-lg px-6 py-10 text-center text-[13px] text-[#9AA2AF]">
                Nenhuma movimentação foi selecionada na etapa anterior. A IA vai analisar apenas com base no andamento da planilha.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {movimentacoes
                  .filter((m) => selected[m.numero])
                  .map((m) => (
                    <div key={m.numero} className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge tipo={m.tipo} />
                        <span className="text-[13px] font-medium text-[#1C2430]">{m.parte ?? "-"}</span>
                        <span className="text-[11px] text-[#9AA2AF] font-mono ml-auto">{m.numero}</span>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2">
                        {(attachments[m.numero] ?? []).map((f) => (
                          <span key={f.id} className="flex items-center gap-1.5 bg-[#F5F6F8] border border-[#E2E5EA] rounded-md px-2.5 py-1 text-[11px] text-[#44546A]">
                            <FileText size={12} /> {f.fileName}
                            <button onClick={() => removeFile(m.numero, f.id)} className="text-[#9AA2AF] hover:text-[#A33B3B]">
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>

                      <label className="flex items-center gap-1.5 text-[12px] text-[#142B4B] font-medium hover:underline cursor-pointer w-fit">
                        <Paperclip size={13} /> Anexar documento
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => handleAttachFile(m.numero, e.target.files?.[0])}
                        />
                      </label>
                    </div>
                  ))}
              </div>
            )}

            <button
              onClick={runAnalysis}
              className="mt-6 inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
            >
              <Sparkles size={14} /> Rodar análise da IA
            </button>
          </div>
        )}

        {/* STEP 4 — análise IA */}
        {step === 4 && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              Análise do período
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">
              {analyzing ? "A IA está lendo os andamentos e os documentos anexados…" : "Revise e edite os destaques antes de gerar o relatório final."}
            </p>

            {analyzing ? (
              <div className="bg-white border border-[#E2E5EA] rounded-lg px-6 py-14 flex flex-col items-center justify-center text-center">
                <Loader2 size={26} className="animate-spin text-[#142B4B] mb-4" />
                <div className="text-[13px] text-[#44546A]">
                  Cruzando {movimentacoes.length} movimentações e {totalAnexos} documento(s) anexado(s)…
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {narrativas.map((n, i) => (
                  <div key={i} className="bg-white border border-[#E2E5EA] rounded-lg px-5 py-4">
                    <div className="text-[13px] font-semibold text-[#142B4B] mb-2">{n.titulo}</div>
                    <textarea
                      value={n.texto}
                      onChange={(e) => setNarrativas((arr) => arr.map((t, idx) => (idx === i ? { ...t, texto: e.target.value } : t)))}
                      className="w-full text-[13px] text-[#333] leading-relaxed border-none outline-none resize-none bg-transparent"
                      rows={3}
                    />
                    <div className="text-[11px] text-[#9AA2AF] flex items-center gap-1.5 mt-1 pt-2 border-t border-[#F0F1F3]">
                      <FileText size={11} /> Fonte: {n.fonte}
                    </div>
                  </div>
                ))}

                <button
                  onClick={finalizeReport}
                  disabled={finalizando}
                  className="mt-2 inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors self-start disabled:opacity-60"
                >
                  {finalizando ? <Loader2 size={14} className="animate-spin" /> : null}
                  Gerar relatório final <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 5 — pronto */}
        {step === 5 && reportFinal && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              Relatório pronto
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">Gerado com os dados da planilha, o diff do mês e a análise revisada. Já está no histórico.</p>

            <div className="bg-white border border-[#E2E5EA] rounded-xl overflow-hidden">
              <div className="bg-[#142B4B] px-6 py-8 text-center">
                <div className="text-white text-[16px] font-semibold" style={{ fontFamily: "Georgia, serif" }}>
                  RELATÓRIO EXECUTIVO
                </div>
                <div className="text-[#9C7C38] text-[13px] font-semibold mt-1">{clienteNomeExibicao.toUpperCase()}</div>
                <div className="text-white/60 text-[11px] mt-1">
                  Referência: {mesReferencia}{versao ? ` · Versão ${versao}` : ""}
                </div>
              </div>
              <div className="px-6 py-5 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                  <CheckCircle2 size={15} className="text-[#3F6B4F]" /> Sumário executivo com KPIs do mês
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                  <CheckCircle2 size={15} className="text-[#3F6B4F]" /> Análise do período ({narrativas.length} destaques revisados)
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                  <CheckCircle2 size={15} className="text-[#3F6B4F]" /> Panorama da carteira + maiores exposições
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                  <CheckCircle2 size={15} className="text-[#3F6B4F]" /> {totalAnexos} documento(s) anexado(s) e referenciado(s)
                </div>
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => navigate(`/relatorios/${reportFinal.id}`)}
                  className="flex-1 flex items-center justify-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#F5F6F8] transition-colors"
                >
                  <Eye size={14} /> Visualizar
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#1c3a63] transition-colors"
                >
                  <Download size={14} /> Baixar (.docx)
                </button>
                <button
                  onClick={() => navigate("/historico")}
                  className="flex items-center justify-center gap-2 border border-[#D9DCE1] text-[#44546A] text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#F5F6F8] transition-colors"
                >
                  <History size={14} /> Histórico
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
