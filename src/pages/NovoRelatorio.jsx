import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Upload, CheckCircle2, ArrowRight, Sparkles, FileText, Paperclip, X, Download,
  AlertTriangle, ChevronRight, Scale, Building2, Gavel, Loader2, History, Eye,
  RefreshCw, Table2, Mail,
} from "lucide-react";
import { api } from "../lib/api.js";
import EnviarEmailModal from "../components/EnviarEmailModal.jsx";

const NAVY = "#142B4B";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Rótulos dos campos do sistema (espelham lib/xlsx-parser.js CAMPO_LABELS).
const CAMPO_LABELS = {
  numero: "Número do processo",
  parte: "Parte",
  area: "Área",
  valor: "Valor envolvido",
  provisao: "Provisão",
  status: "Status",
  probabilidade: "Probabilidade",
};

// "2026-06" -> "Junho/2026" (rótulo de exibição). O período em si ("YYYY-MM")
// é o que o backend usa para ordenar/comparar meses.
function periodoParaRotulo(periodo) {
  if (!/^\d{4}-\d{2}$/.test(periodo || "")) return periodo || "";
  const [ano, mes] = periodo.split("-");
  const idx = Number(mes) - 1;
  return idx >= 0 && idx < 12 ? `${MESES[idx]}/${ano}` : periodo;
}

function fmtMoeda(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cliente + Upload viram uma única etapa ("Planilha"); a conferência da leitura
// é uma sub-etapa dela, então o wizard tem 5 passos.
const STEPS = [
  { id: 0, label: "Planilha" },
  { id: 1, label: "O que mudou" },
  { id: 2, label: "Documentos" },
  { id: 3, label: "Análise da IA" },
  { id: 4, label: "Relatório" },
];

function Badge({ tipo }) {
  const map = {
    novo: { label: "Processo novo", cls: "bg-[#142B4B] text-white" },
    movimentacao: { label: "Movimentação", cls: "bg-[#EFE6D2] text-[#7A5F26]" },
    acordo: { label: "Acordo", cls: "bg-[#E4EDE7] text-[#2F5D45]" },
    encerrado: { label: "Encerrado", cls: "bg-[#EEF0F3] text-[#44546A]" },
  };
  const m = map[tipo] ?? map.movimentacao;
  return <span className={`text-[11px] font-semibold tracking-wide px-2 py-1 rounded-full ${m.cls}`}>{m.label}</span>;
}

// Movimentações que a própria planilha já sinaliza como mais relevantes
// (mudança de valor ou acordo/homologação) vêm pré-marcadas para anexo — o
// usuário não precisa revisar processo a processo, mas pode ajustar a seleção.
const isRelevante = (m) => m.prioridade === "alta" || m.tipo === "acordo";

function selecaoRelevante(movimentacoes) {
  const sel = {};
  for (const m of movimentacoes) {
    if (isRelevante(m)) sel[m.numero] = true;
  }
  return sel;
}

function AreaIcon({ area }) {
  if (area === "Trabalhista") return <Gavel size={15} className="text-[#44546A]" />;
  if (area === "Tributário") return <Building2 size={15} className="text-[#44546A]" />;
  return <Scale size={15} className="text-[#44546A]" />;
}

/**
 * Polling da análise assíncrona: o backend responde na hora marcando o report
 * como "analisando" e roda a IA fora do request. Aqui consultamos o report até
 * o status sair de "analisando" (narrativas prontas) ou virar "erro".
 */
async function aguardarAnalise(reportId, { intervalMs = 2500, timeoutMs = 15 * 60 * 1000 } = {}) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const r = await api.getReport(reportId);
    if (r.status === "erro") throw new Error("A análise da IA falhou. Tente rodar novamente.");
    if (r.status !== "analisando") return r.narrativas ?? [];
    await sleep(intervalMs);
  }
  throw new Error("A análise está demorando mais que o esperado. Recarregue a página e verifique o relatório.");
}

// Sub-etapa "Confira a leitura": mostra o que o parser entendeu da planilha e,
// quando falta reconhecer uma coluna, oferece o mapeador manual.
function ConfiraLeitura({ leitura, mapping, setMapping }) {
  const colunasIgnoradas = leitura.colunas.filter((c) => !c.campo);
  const camposMapeaveis = leitura.camposFaltando; // inclui numero quando a leitura falhou
  const podeMapear = colunasIgnoradas.length > 0 && camposMapeaveis.length > 0;

  const setCampo = (campo, nome) =>
    setMapping((m) => {
      const next = { ...m };
      if (nome) next[campo] = nome;
      else delete next[campo];
      return next;
    });

  return (
    <div className="bg-white border border-[#E2E5EA] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EEF0F3]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#142B4B]">
          <Table2 size={15} /> Confira a leitura
        </div>
        <div className="text-[11px] text-[#9AA2AF] mt-0.5">
          {leitura.headerRow ? `Cabeçalho reconhecido na linha ${leitura.headerRow}.` : "Cabeçalho não reconhecido."} Revise antes de continuar.
        </div>
      </div>

      <div className="px-5 py-4 flex flex-col gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1.5">Colunas reconhecidas</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(leitura.camposReconhecidos).map(([campo, nome]) => (
              <span key={campo} className="inline-flex items-center gap-1 text-[11px] bg-[#E4EDE7] text-[#2F5D45] px-2 py-1 rounded-md">
                <CheckCircle2 size={11} /> {CAMPO_LABELS[campo] ?? campo}: <b className="font-semibold">{nome}</b>
              </span>
            ))}
            {Object.keys(leitura.camposReconhecidos).length === 0 && (
              <span className="text-[11px] text-[#9AA2AF]">Nenhuma coluna reconhecida.</span>
            )}
          </div>
        </div>

        {colunasIgnoradas.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1.5">Colunas ignoradas</div>
            <div className="flex flex-wrap gap-1.5">
              {colunasIgnoradas.map((c) => (
                <span key={c.index} className="inline-flex items-center gap-1 text-[11px] bg-[#EEF0F3] text-[#44546A] px-2 py-1 rounded-md">
                  {c.nome || `Coluna ${c.index}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {podeMapear && (
        <div className="px-5 py-4 border-t border-[#EEF0F3] bg-[#FBF8F2]">
          <div className="flex items-start gap-2 text-[12px] text-[#8A6D1F] mb-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              Alguns campos não foram reconhecidos automaticamente. Se alguma coluna ignorada corresponder a um deles,
              associe abaixo e reprocesse — o mapeamento fica salvo para os próximos meses deste cliente.
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {camposMapeaveis.map((campo) => (
              <div key={campo} className="flex items-center gap-2">
                <label className="text-[12px] text-[#44546A] w-40 shrink-0">{CAMPO_LABELS[campo] ?? campo}</label>
                <ChevronRight size={12} className="text-[#C7CCD4] shrink-0" />
                <select
                  value={mapping[campo] ?? ""}
                  onChange={(e) => setCampo(campo, e.target.value)}
                  className="flex-1 text-[12px] border border-[#D9DCE1] rounded-md px-2 py-1.5 outline-none focus:border-[#9C7C38] bg-white"
                >
                  <option value="">— coluna da planilha —</option>
                  {colunasIgnoradas.map((c) => (
                    <option key={c.index} value={c.nome}>{c.nome || `Coluna ${c.index}`}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {leitura.amostra.length > 0 && (
        <div className="px-5 py-4 border-t border-[#EEF0F3]">
          <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-2">Amostra das primeiras linhas lidas</div>
          <div className="overflow-x-auto">
            <table className="text-left text-[11.5px] min-w-full">
              <thead>
                <tr className="text-[#9AA2AF] border-b border-[#EEF0F3]">
                  <th className="py-1.5 pr-3 font-medium">Número</th>
                  <th className="py-1.5 pr-3 font-medium">Parte</th>
                  <th className="py-1.5 pr-3 font-medium">Área</th>
                  <th className="py-1.5 pr-3 font-medium">Valor</th>
                  <th className="py-1.5 pr-3 font-medium">Provisão</th>
                  <th className="py-1.5 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {leitura.amostra.map((p, i) => (
                  <tr key={i} className="border-b border-[#F5F6F8] text-[#44546A]">
                    <td className="py-1.5 pr-3 font-mono text-[10.5px] whitespace-nowrap">{p.numero}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{p.parte ?? "—"}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{p.area ?? "—"}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtMoeda(p.valor)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{fmtMoeda(p.provisao)}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">{p.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NovoRelatorio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resumeId = searchParams.get("reportId");
  const preClientId = searchParams.get("clientId");
  const prePeriodo = searchParams.get("periodo");

  const [step, setStep] = useState(0);
  const [loadingResume, setLoadingResume] = useState(!!resumeId);

  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState(preClientId || "");
  const [versao, setVersao] = useState(null);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [periodo, setPeriodo] = useState(/^\d{4}-\d{2}$/.test(prePeriodo || "") ? prePeriodo : ""); // "YYYY-MM"
  const [mesReferencia, setMesReferencia] = useState(""); // rótulo de exibição
  const [clienteNomeExibicao, setClienteNomeExibicao] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [duplicado, setDuplicado] = useState(null); // { reportId, file } quando o período já existe
  const [reportId, setReportId] = useState(resumeId || null);
  const [kpis, setKpis] = useState(null);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [selected, setSelected] = useState({});
  const [leitura, setLeitura] = useState(null); // conferência da leitura da planilha
  const [mapping, setMapping] = useState({}); // mapeamento manual { campo: nomeColuna }

  const [attachments, setAttachments] = useState({}); // numero -> [{id, fileName}]
  const [analyzing, setAnalyzing] = useState(false);
  const [narrativas, setNarrativas] = useState([]);
  const [finalizando, setFinalizando] = useState(false);
  const [reportFinal, setReportFinal] = useState(null);
  const [enviarOpen, setEnviarOpen] = useState(false);
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
        setPeriodo(r.periodo ?? "");
        setMesReferencia(r.mesReferencia);
        setKpis(r.kpis);
        setVersao(r.versao ?? null);
        setMovimentacoes(r.movimentacoes ?? []);
        const attByNumero = {};
        for (const a of r.attachments) {
          attByNumero[a.processoNumero] = [...(attByNumero[a.processoNumero] ?? []), a];
        }
        setAttachments(attByNumero);
        // Mantém marcadas as relevantes + qualquer uma que já tenha documento anexado.
        setSelected({ ...selecaoRelevante(r.movimentacoes ?? []), ...Object.fromEntries(Object.keys(attByNumero).map((n) => [n, true])) });
        if (r.narrativas) setNarrativas(r.narrativas);
        setStep(1); // vai direto para "O que mudou"
      })
      .catch((err) => setErro(err.message))
      .finally(() => setLoadingResume(false));
  }, [resumeId]);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  // Envia a planilha: cria o relatório (POST) ou, se já existe, reprocessa a
  // planilha do período (PUT) aplicando o mapeamento manual atual.
  const enviar = async (file = selectedFile, mappingArg = mapping) => {
    if (!file) return;
    setErro("");
    setDuplicado(null);
    setUploading(true);
    try {
      if (reportId) {
        // Reprocessar: mesma planilha, mapeamento revisado.
        const result = await api.replaceSpreadsheet(reportId, file, mappingArg);
        setKpis(result.kpis);
        setMovimentacoes(result.movimentacoes);
        setSelected(selecaoRelevante(result.movimentacoes));
        setLeitura(result.leitura);
        return;
      }

      let finalClientId = clientId;
      if (clientId === "__new__") {
        if (!novoClienteNome.trim()) {
          setErro("Informe o nome do novo cliente.");
          return;
        }
        const created = await api.createClient(novoClienteNome.trim());
        finalClientId = created.id;
        setClientId(created.id);
        setClienteNomeExibicao(created.nome);
      } else {
        const c = clients.find((c) => c.id === clientId);
        setClienteNomeExibicao(c?.nome ?? "");
      }

      const rotulo = periodoParaRotulo(periodo);
      setMesReferencia(rotulo);
      const result = await api.uploadSpreadsheet(finalClientId, periodo, rotulo, file, mappingArg);
      setReportId(result.reportId);
      setKpis(result.kpis);
      setVersao(result.versao ?? null);
      setMovimentacoes(result.movimentacoes);
      setSelected(selecaoRelevante(result.movimentacoes));
      setLeitura(result.leitura);
    } catch (err) {
      // Mês duplicado: oferece substituir a planilha ou abrir o relatório existente.
      if (err.status === 409 && err.body?.reportId) {
        setDuplicado({ reportId: err.body.reportId, file });
      } else if (err.body?.leitura) {
        // Parse falhou mas o backend devolveu as colunas lidas: mostra o mapeador.
        setLeitura(err.body.leitura);
        setErro(err.message || "Não foi possível ler a planilha automaticamente. Mapeie as colunas abaixo.");
      } else {
        setErro(err.message || "Erro ao processar a planilha");
      }
    } finally {
      setUploading(false);
    }
  };

  const onSelectFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setLeitura(null);
    setMapping({});
    enviar(file, {});
  };

  const substituirPlanilha = async () => {
    if (!duplicado) return;
    setErro("");
    setUploading(true);
    try {
      const result = await api.replaceSpreadsheet(duplicado.reportId, duplicado.file, mapping);
      setReportId(result.reportId);
      setSelectedFile(duplicado.file);
      setKpis(result.kpis);
      setMovimentacoes(result.movimentacoes);
      setSelected(selecaoRelevante(result.movimentacoes));
      setLeitura(result.leitura);
      setDuplicado(null);
    } catch (err) {
      setErro(err.message || "Erro ao substituir a planilha");
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
    setStep(3);
    setAnalyzing(true);
    setErro("");
    try {
      const result = await api.analyzeReport(reportId);
      // Backend assíncrono: responde "analisando" e roda a IA fora do request.
      // Retrocompatível: se já vierem narrativas, usa direto; senão, faz polling.
      if (result?.narrativas) {
        setNarrativas(result.narrativas);
      } else {
        setNarrativas(await aguardarAnalise(reportId));
      }
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
      setStep(4);
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

  const handleDownloadPdf = async () => {
    try {
      const url = await api.getPdfDownloadUrl(reportFinal.id);
      window.open(url, "_blank");
    } catch (err) {
      setErro(err.message || "Erro ao baixar o PDF");
    }
  };

  const totalAnexos = useMemo(() => Object.values(attachments).flat().length, [attachments]);
  const mapeamentoPendente = Object.keys(mapping).length > 0;

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

        {/* STEP 0 — cliente + período + planilha + confira a leitura */}
        {step === 0 && !reportId && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              Nova versão do relatório
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">
              Escolha o cliente e o mês, e suba a planilha de acompanhamento processual. Cada envio gera uma nova versão
              do relatório daquele cliente, mantendo as anteriores no histórico.
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
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full mb-1.5 text-[13px] border border-[#D9DCE1] rounded-lg px-3 py-2.5 outline-none focus:border-[#9C7C38] bg-white"
            />
            <p className="text-[11px] text-[#9AA2AF] mb-6">
              {periodo ? `Aparecerá no relatório como “${periodoParaRotulo(periodo)}”.` : "Escolha o mês da carteira que esta planilha representa."}
            </p>

            <label className="block text-[12px] font-medium text-[#44546A] mb-1">Planilha</label>
            <label
              className={`border-2 border-dashed rounded-xl px-8 py-10 flex flex-col items-center justify-center text-center transition-colors ${
                !clientId || !periodo || (clientId === "__new__" && !novoClienteNome.trim())
                  ? "border-[#E7E9ED] bg-[#FAFBFC] cursor-not-allowed opacity-60"
                  : uploading
                  ? "border-[#9C7C38] bg-[#FBF8F2] cursor-wait"
                  : "border-[#D9DCE1] hover:border-[#9C7C38] hover:bg-[#FBF8F2] cursor-pointer"
              }`}
            >
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={onSelectFile}
                disabled={uploading || !clientId || !periodo || (clientId === "__new__" && !novoClienteNome.trim())}
              />
              {uploading ? (
                <>
                  <Loader2 size={28} className="animate-spin text-[#142B4B] mb-3" />
                  <div className="text-[13px] text-[#44546A]">Lendo planilha e comparando com o mês anterior…</div>
                </>
              ) : (
                <>
                  <Upload size={24} className="text-[#9AA2AF] mb-3" />
                  <div className="text-[13px] font-medium text-[#44546A]">Clique para selecionar a planilha</div>
                  <div className="text-[11px] text-[#9AA2AF] mt-1">.xlsx exportado do sistema jurídico</div>
                </>
              )}
            </label>

            {/* Parse falhou mas há colunas para mapear: mostra a conferência/mapeador. */}
            {leitura && !reportId && (
              <div className="mt-5 flex flex-col gap-4">
                <ConfiraLeitura leitura={leitura} mapping={mapping} setMapping={setMapping} />
                <button
                  onClick={() => enviar(selectedFile, mapping)}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors self-start disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Tentar novamente com o mapeamento
                </button>
              </div>
            )}

            {duplicado && (
              <div className="mt-5 bg-[#F4EEDD] border border-[#E6D9B0] rounded-xl px-5 py-4">
                <div className="flex items-start gap-2 text-[13px] text-[#8A6D1F]">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <div>
                    Já existe uma planilha enviada para <b>{clienteNomeExibicao || "este cliente"}</b> em{" "}
                    <b>{periodoParaRotulo(periodo)}</b>. O que você quer fazer?
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={substituirPlanilha}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Substituir planilha deste período
                  </button>
                  <button
                    onClick={() => navigate(`/relatorios/${duplicado.reportId}`)}
                    className="inline-flex items-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-white transition-colors"
                  >
                    <Eye size={14} /> Abrir o relatório existente
                  </button>
                  <button
                    onClick={() => setDuplicado(null)}
                    className="text-[13px] text-[#7A8394] px-3 py-2 rounded-lg hover:text-[#142B4B]"
                  >
                    Cancelar
                  </button>
                </div>
                <div className="text-[11px] text-[#9C844A] mt-3">
                  Substituir troca a planilha do mês e volta o relatório para rascunho (a análise e o .docx antigos são descartados).
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 0 (continuação) — confira a leitura após upload bem-sucedido */}
        {step === 0 && reportId && leitura && (
          <div>
            <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              Confira a leitura da planilha
            </h1>
            <p className="text-[13px] text-[#7A8394] mb-6">
              Antes de comparar com o mês anterior, confira se o portal entendeu a planilha corretamente. Se alguma
              coluna ficou de fora, mapeie e reprocesse — o ajuste vale para os próximos meses deste cliente.
            </p>

            <ConfiraLeitura leitura={leitura} mapping={mapping} setMapping={setMapping} />

            <div className="flex flex-wrap items-center gap-2 mt-6">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
              >
                Está correto, continuar <ArrowRight size={14} />
              </button>
              {mapeamentoPendente && (
                <button
                  onClick={() => enviar(selectedFile, mapping)}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-4 py-2.5 rounded-lg hover:bg-[#F5F6F8] transition-colors disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Reprocessar com o mapeamento
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 1 — o que mudou */}
        {step === 1 && kpis && (
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
              Já marcamos as movimentações mais relevantes do mês (alteração de valor ou acordo/homologação) para anexo — desmarque ou marque outras se quiser. É opcional.
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-6 inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
            >
              Continuar {selectedCount > 0 ? `(${selectedCount} selecionada${selectedCount > 1 ? "s" : ""})` : ""} <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* STEP 2 — documentos */}
        {step === 2 && (
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
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
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

        {/* STEP 3 — análise IA */}
        {step === 3 && (
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
                <div className="text-[11px] text-[#9AA2AF] mt-2">
                  A análise roda em segundo plano — pode levar alguns minutos em meses grandes.
                </div>
              </div>
            ) : erro ? (
              <button
                onClick={runAnalysis}
                className="inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
              >
                <RefreshCw size={14} /> Tentar análise novamente
              </button>
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

        {/* STEP 4 — pronto */}
        {step === 4 && reportFinal && (
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
              <div className="px-6 pb-6 flex flex-col gap-3">
                <button
                  onClick={() => setEnviarOpen(true)}
                  className="w-full flex items-center justify-center gap-2 bg-[#2F5D45] text-white text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#28503b] transition-colors"
                >
                  <Mail size={15} /> Enviar ao cliente
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => navigate(`/relatorios/${reportFinal.id}`)}
                    className="flex-1 flex items-center justify-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#F5F6F8] transition-colors"
                  >
                    <Eye size={14} /> Visualizar
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#F5F6F8] transition-colors"
                  >
                    <Download size={14} /> .docx
                  </button>
                  <button
                    onClick={handleDownloadPdf}
                    className="flex-1 flex items-center justify-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#F5F6F8] transition-colors"
                  >
                    <FileText size={14} /> PDF
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
          </div>
        )}
      </div>

      {enviarOpen && reportFinal && (
        <EnviarEmailModal
          reportId={reportFinal.id}
          clientId={reportFinal.clientId}
          onClose={() => setEnviarOpen(false)}
        />
      )}
    </div>
  );
}
