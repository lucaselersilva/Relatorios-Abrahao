import React, { useState } from "react";
import {
  Upload, FileSpreadsheet, CheckCircle2, ArrowRight, Sparkles,
  FileText, Paperclip, X, Download, AlertTriangle, ChevronRight,
  Scale, Building2, Gavel, Loader2, FilePlus2, History, Eye, Search,
} from "lucide-react";

const LOGO_SRC = "data:image/png;base64,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QHAWC6gMWZbZvMRiMQjgMjMzU1NTIYPD1rPD4ejQocPf/va3oUOHzps3b926dWyRsyTUeSCzxgWEEEmSPv74Y3DeWSxqxRk77gaZTGubzZaSknL11Vdb1dgbb7yhKAocWCKKIuwWYSq3DXPZhoBaFkVRluVXX301xTx0rqVQSmtqarp161ZdXQ1s90AgwNAANgvCZGvdDVQdo8fR89NFLpervLwcIZSamlpRUeFyucBvQxb1qet6VVVVOBxu164d29CFEIIqWTweDwaDzM8DR6KhocHj8ei6Dme6wMGIPM+vW7eupqYGDDRrA0Kovr6+srIyPT29oqKiS5cucJIoG1sIvVVV9fv9MOyszBqNRoG2KUlSMpkERELWIxAIQPvZAnA6nUCLAqhBise68ODK3Nzcl19++cSJE3v27GG8fqu5MIsbitpknnle4IQ3Xp8XbggmIlEYOQ5johsEGWwObE4bpVTTNaITURZlp6xpyZdfnivbbcAO0lW1tLR02+ZNyWTSJdt0qiNkIfNwyEAG4hFBrTj+rRhScAF5w6AGMTQ94POvLlgxatSotOymYyZg5iAcWbFixeTJk6+//npoc1pa2po1a6ZNm8aS2gghsPLAX4JHAA4URbGeKczSm3a7feTIkatWrZJl+dZbbwXLwgheoI2cTueRI0fYeS0IITidxW6367qenZ3tdDqbJXFyc3PLyspAabF0GuDvxIkTKSkpsD6RWbHYsGHDgw8+CAeiwCmQq1evvueee1i6H2Nss9kyMjJCoRA0HmOcSCTgxCu4CQSMwFK5+uqrlyxZEgwG4exStjsrFoudOHGiS5cu7Ahmlh4HgwtOZywWy8/P//bbbwcPHkzNAitulifjJIm32bAoIo7TEomtW7cGg0FwyMDWMoEyVjKZhIQ4wM7r9d58883du3dHHAc/giwXFBTAPDG99dOFHd0IjqOmaZ9++imcS8O6BL+EQqFvv/126NChLHs5cODAhoaGxsZGRqaz5lFhuEOhUCKRePnll6dPn846iCzJfVVVr7nmmu+++2737t19+vS58FJAaObMmXBUscPhABceUPXmm28OHjz43P4/hOAtu93+29/+9uWXX9Z13ePxRCIRzkyyt2/f3soy1TQtFArt2bNnxIgRsG9FluWuXbvCxgurJ2SYJ6JD78LhsCiKL7zwwu9//3tr5AE+t91uz8/P3759ezAYhL0XYPc5jluyZMmUKVMYXQWbu7ZWrVpVWVkJx2u6XK6ysrIuXbrAGd7IEt6dA9m5hJVhhEIhWIhQDicthJrBKqgNCNDuuusuFnZpiUTpoUOQgAW7AxvUWv7yQ1+HqJb9GY/Hv/zyy+3bt1vRAAMUCoXgjGOW4XO5XHa7/ezZsy1rUIZhQA7s+PHjr7zySn5+PttKTs2MP0yeJEnt2rUDClobBygPHDiwQ4cOf/3rX3ft2uXxeCDD+eSTT3q93lGjRjE3i5ljnucHDx48aNCg5557rra2FrK7q1ev3rRpkzX9C8gIh8PZ2dnsWTabLScnp2PHjqdOnbKWg2GavF6v3+9PJpO7du2aO3fuuHHjunbtClknqHNQMyFy00031dbWbt68GVZFOBw+evTo/fff/+STTzocDofDwWI+8JdGjBjxySef1NXViaIImwlGjBgBOzMYbJqWfVObDBNkhIRDoYkTJ1ZXVwMFr2XlSxRFt9vt8/lAqcqyPGHChFdeeYVSykkSQqi+rm7ZsmWvv/56Q0OD1+uFvFRr8/GDBDR2NBoFVwMWa35+fsHHq6yepqqqoVDI5/OBsoGhTCQScFpJZmYmozFSSiORyNy5c7Oyss6ePduzZ88pU6bAYVKQwmAoZDXjaDR67NixzMzM7OzstimEhmEsW7asvLwcbN+UKVM6d+7MmaQgBnGYb03TIN2/aNGiaDSaSCRuvPHGsWPHEvN4BOggJOVVVe3UqRPssQPDUlFRIctybm4uqyJomubz+d5++21ZllVVve6666699lo4kBYiIVg51lyDJEn79u0rKioyDMNms3Xq1GnixImQsSIm/wDuD4kxVVXnzZuXTCZzc3PvuOMOqDRSS8UMnF0TZLqBKIWjNeORyIEDBw4fPpxIJJj2swoA3+VyQX7fZrNNmDAhIyOj6RgxjMPBYElJSWVlJehbajn/6CcKG0FCiCzLkUgkLS0tFov99nf3Mq8FWbbHwTdCsEkF3ws8JObe6roei8Ug+Qlfp2CYRxlylm+1wSaPCCEEZX5RFLlWyttwh8bGRo/Hw/M840wbJpkRxpDlx61f4wBhQUpKSiKRYNtxrVgPhUKwiYuYrDWe56PRqGEYYECZZ6aqKmgKURTr6+udTqckSZAAoubxsGAHQe0ZhgHH/sDHKysr27Vr15KNSC0FULZcmT1lSSVq5rrNMlxSbeozxyGOU2IxYExkZmbSFl/HAl5Mvd8vmOcJOM1cM9E0GItIJMICNKBTtmwrmNcf9Do2t6TD6MCddV0XZBtvHh9sxSI1aRFMz7EDlVj20poWYqlweBYsaGI5LZx9kJ5/IlczObeHwtxfBPoGdhNSszjT7CaNjY2AEiDiJpNJdmYbb2E4wgph7WeVRGIeecLEMOmHLEfKmcQQdqWVGsS6j8zlZzVB1NxWY5jUOnbQDmRMrJw5lpxD5zSZeTiToaq8ICCMv++ZYOx8OhgCQuCD7HT+phe/NwX0hwmliBDE87rRFJERCzeV6TBkCdbgT+t+bu78r96wog3QwL4Fja00KG9wlr0SzYRppnA4DGecsNNWQNOwoJWBDGYUznXiOK7ZV+Ygc83AqmCxm5UnzfrCUAsQhHXFnEv2WRaQwev0fFYfPv+sKBZvsrvxJmNWEARI7yGEoPGsDU3+wHljYxgIIUPXzyEMMNTGD8CR45r2NcFZ1hifQxil9BLZyiYhhOo6qEyi64jjkMVh4ix1D6YnYIWxhDW1kJJhaCBQBe1FLIQ5bBKm2QfZi20gDCHkcDjAVHk8HngEfM8BZxKyOVOgGSzJKYoiPM7lcoEDbi1AYbPgwSaSLR4W/yJLjhfMCDYFmQE15DgZqkBFWZ/CwAQvMv8BEtdW8LHeEULAi7VWj5ruCf+j/79/t/wPLlBdkZ9DLqTJrsgV+V+Q/wNot5W1WmesnAAAAABJRU5ErkJggg==";

// ---------------------------------------------------------------------------
// Dados de exemplo (números reais do caso Concreline, Junho/2026; os demais
// clientes no histórico são ilustrativos, para mostrar o portal com mais de
// um cliente ativo).
// ---------------------------------------------------------------------------

const KPIS = {
  processos: 217,
  valorEnvolvido: "R$ 229,3 mi",
  provisao: "R$ 161,1 mi",
  semProvisao: 25,
};

const MOVIMENTOS = [
  {
    id: 1,
    tipo: "novo",
    area: "Cível",
    parte: "Credibilità Adm. Judicial e Fasttel Engenharia",
    processo: "0003679-79.2026.8.16.0194",
    valor: "R$ 110,1 mi",
    resumo: "Processo novo na carteira — já entrou com provisão integral constituída.",
    prioridade: "alta",
  },
  {
    id: 2,
    tipo: "movimentacao",
    area: "Tributário",
    parte: "Estado do Espírito Santo",
    processo: "5000965-26.2017.8.08.0024",
    valor: "R$ 13,4 mi",
    resumo: "Decisão de declínio de competência — autos redistribuídos em grau de recurso.",
    prioridade: "alta",
  },
  {
    id: 3,
    tipo: "movimentacao",
    area: "Trabalhista",
    parte: "Edson Floriano dos Santos",
    processo: "0000612-35.2025.5.17.0010",
    valor: "R$ 178,7 mil",
    resumo: "Sentença parcialmente procedente em 1ª instância.",
    prioridade: "media",
  },
  {
    id: 4,
    tipo: "movimentacao",
    area: "Trabalhista",
    parte: "Ministério Público do Trabalho",
    processo: "0010214-59.2018.5.03.0180",
    valor: "R$ 300 mil",
    resumo: "Incluído em pauta de julgamento na 5ª Turma.",
    prioridade: "media",
  },
  {
    id: 5,
    tipo: "acordo",
    area: "Trabalhista",
    parte: "Dardania Lourenço Barbosa",
    processo: "0010259-28.2019.5.03.0148",
    valor: "R$ 30 mil",
    resumo: "Acordo homologado — deságio de R$ 10,5 mil sobre valor de risco.",
    prioridade: "baixa",
  },
];

const NARRATIVA_IA = [
  {
    titulo: "Novo processo de R$ 110,1 milhões concentra quase todo o salto do mês",
    texto:
      "A entrada do processo movido por Credibilità Administração Judicial e Fasttel Engenharia (cível) explica praticamente toda a variação de valor envolvido e provisão em relação a maio. Já entrou com provisão constituída no valor integral, mesmo com probabilidade de perda \"Possível\" — vale confirmar com o jurídico se essa é a política correta para essa classificação de risco.",
    fonte: "Petição inicial anexada + andamento da planilha",
  },
  {
    titulo: "Processo de R$ 13,4 milhões muda de instância",
    texto:
      "No processo tributário contra o Estado do Espírito Santo, a decisão de declínio de competência redistribuiu os autos em grau de recurso. Mudança de instância tende a alongar o prazo até o desfecho.",
    fonte: "Andamento da planilha (sem documento anexado)",
  },
  {
    titulo: "Dois casos trabalhistas pedem reavaliação de provisão",
    texto:
      "A sentença parcialmente procedente no caso de Edson Floriano dos Santos e a inclusão em pauta na 5ª Turma do processo movido pelo MPT recomendam revisão de provisão no próximo fechamento.",
    fonte: "Sentença anexada (caso 3) + andamento da planilha (caso 4)",
  },
];

const STEPS = [
  { id: 1, label: "Upload" },
  { id: 2, label: "O que mudou" },
  { id: 3, label: "Documentos" },
  { id: 4, label: "Análise da IA" },
  { id: 5, label: "Relatório" },
];

const HISTORICO_INICIAL = [
  { id: "h1", cliente: "Concreline", mes: "Maio/2026", geradoEm: "12/06/2026", status: "pronto", autor: "R. Abrahão" },
  { id: "h2", cliente: "Concreline", mes: "Abril/2026", geradoEm: "10/05/2026", status: "pronto", autor: "R. Abrahão" },
  { id: "h3", cliente: "Construtora Alfa", mes: "Junho/2026", geradoEm: "14/07/2026", status: "pronto", autor: "M. Dourado" },
  { id: "h4", cliente: "Rede Nordeste Varejo", mes: "Junho/2026", geradoEm: "13/07/2026", status: "rascunho", autor: "M. Dourado" },
  { id: "h5", cliente: "Construtora Alfa", mes: "Maio/2026", geradoEm: "09/06/2026", status: "pronto", autor: "M. Dourado" },
];

const NAVY = "#142B4B";
const GOLD = "#9C7C38";

function Badge({ tipo }) {
  const map = {
    novo: { label: "Processo novo", cls: "bg-[#142B4B] text-white" },
    movimentacao: { label: "Movimentação", cls: "bg-[#EFE6D2] text-[#7A5F26]" },
    acordo: { label: "Acordo", cls: "bg-[#E4EDE7] text-[#2F5D45]" },
  };
  const m = map[tipo];
  return (
    <span className={`text-[11px] font-semibold tracking-wide px-2 py-1 rounded-full ${m.cls}`}>
      {m.label}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === "pronto")
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#E4EDE7] text-[#2F5D45]">
        <CheckCircle2 size={11} /> Pronto
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#F4EEDD] text-[#8A6D1F]">
      <Loader2 size={11} /> Rascunho
    </span>
  );
}

function AreaIcon({ area }) {
  if (area === "Trabalhista") return <Gavel size={15} className="text-[#44546A]" />;
  if (area === "Tributário") return <Building2 size={15} className="text-[#44546A]" />;
  return <Scale size={15} className="text-[#44546A]" />;
}

export default function Portal() {
  const [view, setView] = useState("historico"); // 'historico' | 'novo'
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [selected, setSelected] = useState({});
  const [attached, setAttached] = useState({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [editedNarrativa, setEditedNarrativa] = useState(NARRATIVA_IA.map((n) => n.texto));
  const [history, setHistory] = useState(HISTORICO_INICIAL);
  const [reportFinalized, setReportFinalized] = useState(false);

  const startNewReport = () => {
    setView("novo");
    setStep(1);
    setUploading(false);
    setUploaded(false);
    setSelected({});
    setAttached({});
    setAnalyzing(false);
    setAnalyzed(false);
    setReportFinalized(false);
    setEditedNarrativa(NARRATIVA_IA.map((n) => n.texto));
  };

  const handleUploadClick = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setUploaded(true);
      setTimeout(() => setStep(2), 500);
    }, 1400);
  };

  const toggleSelect = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const attachFile = (id, name) =>
    setAttached((a) => ({ ...a, [id]: [...(a[id] || []), name] }));

  const removeFile = (id, idx) =>
    setAttached((a) => ({ ...a, [id]: a[id].filter((_, i) => i !== idx) }));

  const runAnalysis = () => {
    setStep(4);
    setAnalyzing(true);
    setTimeout(() => {
      setAnalyzing(false);
      setAnalyzed(true);
    }, 2200);
  };

  const finalizeReport = () => {
    setStep(5);
    if (!reportFinalized) {
      setHistory((h) => [
        { id: "new", cliente: "Concreline", mes: "Junho/2026", geradoEm: "hoje", status: "pronto", autor: "você" },
        ...h,
      ]);
      setReportFinalized(true);
    }
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] text-[#1C2430] flex" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar — navegação real do produto */}
      <div className="w-60 shrink-0 border-r border-[#E2E5EA] bg-white min-h-screen flex flex-col">
        <div className="px-5 pt-6 pb-5 border-b border-[#EEF0F3]">
          <img src={LOGO_SRC} alt="Abrahão Advogados" className="h-9 w-auto object-contain" />
          <div className="text-[10px] text-[#9AA2AF] mt-2 tracking-wide">Portal de Relatórios</div>
        </div>

        <div className="px-3 pt-4">
          <button
            onClick={startNewReport}
            className="w-full flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-3.5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
          >
            <FilePlus2 size={15} /> Novo relatório
          </button>
        </div>

        <div className="px-3 mt-5 flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold text-[#9AA2AF] uppercase tracking-wide px-2.5 mb-1.5">
            Navegação
          </div>
          <button
            onClick={() => setView("historico")}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
              view === "historico" ? "bg-[#F0EDE3] text-[#142B4B] font-medium" : "text-[#5C6470] hover:bg-[#F5F6F8]"
            }`}
          >
            <History size={15} /> Histórico de relatórios
          </button>
          <button
            onClick={() => view !== "novo" && setView("novo")}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
              view === "novo" ? "bg-[#F0EDE3] text-[#142B4B] font-medium" : "text-[#5C6470] hover:bg-[#F5F6F8]"
            }`}
          >
            <FileText size={15} /> {view === "novo" ? "Relatório em andamento" : "Continuar rascunho"}
          </button>
        </div>

        <div className="mt-auto px-5 py-4 border-t border-[#EEF0F3]">
          <div className="text-[12px] font-medium text-[#44546A]">Escritório Abrahão</div>
          <div className="text-[11px] text-[#9AA2AF]">contencioso@abrahaoadv.com.br</div>
        </div>
      </div>

      {/* Conteudo principal */}
      <div className="flex-1 min-w-0">
        {/* HISTORICO */}
        {view === "historico" && (
          <div className="px-10 py-10 max-w-5xl">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-[22px] font-semibold" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                Histórico de relatórios
              </h1>
              <button
                onClick={startNewReport}
                className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors"
              >
                <FilePlus2 size={14} /> Novo relatório
              </button>
            </div>
            <p className="text-[13px] text-[#7A8394] mb-6">
              Todos os relatórios gerados pelo escritório, por cliente e mês de referência.
            </p>

            <div className="flex items-center gap-2 mb-4 bg-white border border-[#E2E5EA] rounded-lg px-3 py-2 max-w-sm">
              <Search size={14} className="text-[#9AA2AF]" />
              <input
                placeholder="Buscar por cliente…"
                className="text-[13px] outline-none w-full placeholder:text-[#B3B9C2]"
              />
            </div>

            <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#EEF0F3] text-[11px] uppercase tracking-wide text-[#9AA2AF]">
                    <th className="px-5 py-3 font-medium">Cliente</th>
                    <th className="px-5 py-3 font-medium">Mês de referência</th>
                    <th className="px-5 py-3 font-medium">Gerado em</th>
                    <th className="px-5 py-3 font-medium">Responsável</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={h.id} className={`text-[13px] ${i !== history.length - 1 ? "border-b border-[#F3F4F6]" : ""} ${h.id === "new" ? "bg-[#FBF8F2]" : ""}`}>
                      <td className="px-5 py-3.5 font-medium text-[#1C2430]">{h.cliente}</td>
                      <td className="px-5 py-3.5 text-[#44546A]">{h.mes}</td>
                      <td className="px-5 py-3.5 text-[#7A8394]">{h.geradoEm}</td>
                      <td className="px-5 py-3.5 text-[#7A8394]">{h.autor}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={h.status} /></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-3">
                          {h.status === "pronto" ? (
                            <>
                              <button className="flex items-center gap-1 text-[12px] text-[#44546A] hover:text-[#142B4B]">
                                <Eye size={13} /> Ver
                              </button>
                              <button className="flex items-center gap-1 text-[12px] text-[#142B4B] font-medium hover:underline">
                                <Download size={13} /> Baixar
                              </button>
                            </>
                          ) : (
                            <button className="flex items-center gap-1 text-[12px] text-[#8A6D1F] font-medium hover:underline">
                              <ChevronRight size={13} /> Continuar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* WIZARD - novo relatorio */}
        {view === "novo" && (
          <div>
            {/* stepper horizontal */}
            <div className="border-b border-[#E2E5EA] bg-white px-10 py-4 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => {
                  const isDone = s.id < step;
                  const isActive = s.id === step;
                  return (
                    <React.Fragment key={s.id}>
                      <button
                        onClick={() => s.id < step && setStep(s.id)}
                        className={`flex items-center gap-2 px-2 py-1 rounded-md ${s.id < step ? "cursor-pointer" : "cursor-default"}`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${
                            isActive ? "bg-[#142B4B] text-white" : isDone ? "bg-[#EFE6D2] text-[#9C7C38]" : "bg-[#EEF0F3] text-[#9AA2AF]"
                          }`}
                        >
                          {isDone ? <CheckCircle2 size={12} /> : s.id}
                        </div>
                        <span className={`text-[12.5px] ${isActive ? "font-semibold text-[#142B4B]" : isDone ? "text-[#44546A]" : "text-[#9AA2AF]"}`}>
                          {s.label}
                        </span>
                      </button>
                      {i < STEPS.length - 1 && <ChevronRight size={13} className="text-[#D9DCE1] mx-0.5" />}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="text-[11px] text-[#9AA2AF]">Concreline · Junho/2026</div>
            </div>

            <div className="px-10 py-9 max-w-3xl">
              {/* STEP 1 */}
              {step === 1 && (
                <div>
                  <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                    Enviar planilha do mês
                  </h1>
                  <p className="text-[13px] text-[#7A8394] mb-6">
                    Suba a planilha de acompanhamento processual exportada do sistema jurídico. O portal compara automaticamente com o último mês processado.
                  </p>

                  <div
                    onClick={handleUploadClick}
                    className={`border-2 border-dashed rounded-xl px-8 py-14 flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                      uploaded ? "border-[#9C7C38] bg-[#FBF8F2]" : "border-[#D9DCE1] hover:border-[#9C7C38] hover:bg-[#FBF8F2]"
                    }`}
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={30} className="animate-spin text-[#142B4B] mb-3" />
                        <div className="text-[13px] text-[#44546A]">Lendo planilha e comparando com Maio/2026…</div>
                      </>
                    ) : uploaded ? (
                      <>
                        <CheckCircle2 size={30} className="text-[#9C7C38] mb-3" />
                        <div className="text-[13px] font-medium text-[#142B4B]">Relatorio_Concreline_Junho-2026.xlsx</div>
                        <div className="text-[11px] text-[#7A8394] mt-1">217 processos identificados · pronto para comparação</div>
                      </>
                    ) : (
                      <>
                        <Upload size={26} className="text-[#9AA2AF] mb-3" />
                        <div className="text-[13px] font-medium text-[#44546A]">Clique para simular o upload</div>
                        <div className="text-[11px] text-[#9AA2AF] mt-1">.xlsx exportado do sistema jurídico</div>
                      </>
                    )}
                  </div>

                  {uploaded && !uploading && (
                    <button
                      onClick={() => setStep(2)}
                      className="mt-6 inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
                    >
                      Ver o que mudou <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div>
                  <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                    O que mudou desde Maio/2026
                  </h1>
                  <p className="text-[13px] text-[#7A8394] mb-6">
                    Detectado automaticamente comparando processo a processo com o mês anterior.
                  </p>

                  <div className="grid grid-cols-4 gap-3 mb-8">
                    {[
                      ["Processos ativos", KPIS.processos],
                      ["Valor envolvido", KPIS.valorEnvolvido],
                      ["Provisão total", KPIS.provisao],
                      ["Sem provisão adequada", KPIS.semProvisao],
                    ].map(([label, val], i) => (
                      <div key={i} className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3">
                        <div className="text-[18px] font-semibold" style={{ fontFamily: "Georgia, serif", color: i === 3 ? "#A33B3B" : NAVY }}>
                          {val}
                        </div>
                        <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mt-1">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[12px] font-semibold text-[#44546A] uppercase tracking-wide mb-3">
                    Movimentações relevantes ({MOVIMENTOS.length})
                  </div>

                  <div className="flex flex-col gap-2">
                    {MOVIMENTOS.map((m) => (
                      <div key={m.id} className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={!!selected[m.id]}
                          onChange={() => toggleSelect(m.id)}
                          className="mt-1.5 accent-[#142B4B]"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge tipo={m.tipo} />
                            <span className="flex items-center gap-1 text-[11px] text-[#7A8394]">
                              <AreaIcon area={m.area} /> {m.area}
                            </span>
                            {m.prioridade === "alta" && (
                              <span className="flex items-center gap-1 text-[11px] text-[#A33B3B]">
                                <AlertTriangle size={11} /> Prioridade alta
                              </span>
                            )}
                          </div>
                          <div className="text-[13px] font-medium text-[#1C2430] truncate">{m.parte}</div>
                          <div className="text-[12px] text-[#7A8394] mt-0.5">{m.resumo}</div>
                          <div className="text-[11px] text-[#9AA2AF] mt-1 font-mono">{m.processo}</div>
                        </div>
                        <div className="text-[14px] font-semibold shrink-0" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                          {m.valor}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-[11px] text-[#9AA2AF] mt-3">
                    Marque as movimentações para as quais você quer anexar o documento (petição, decisão, sentença) — isso deixa a análise da IA mais precisa. É opcional.
                  </div>

                  <button
                    onClick={() => setStep(3)}
                    className="mt-6 inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
                  >
                    Continuar {selectedCount > 0 ? `(${selectedCount} selecionada${selectedCount > 1 ? "s" : ""})` : ""} <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div>
                  <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                    Documentos de apoio
                  </h1>
                  <p className="text-[13px] text-[#7A8394] mb-6">
                    Opcional. Anexe petições, decisões ou sentenças das movimentações selecionadas — a IA lê o conteúdo e usa isso na análise, em vez de só o resumo da planilha.
                  </p>

                  {selectedCount === 0 ? (
                    <div className="bg-white border border-[#E2E5EA] rounded-lg px-6 py-10 text-center text-[13px] text-[#9AA2AF]">
                      Nenhuma movimentação foi selecionada na etapa anterior. A IA vai analisar apenas com base no andamento da planilha.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {MOVIMENTOS.filter((m) => selected[m.id]).map((m) => (
                        <div key={m.id} className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge tipo={m.tipo} />
                            <span className="text-[13px] font-medium text-[#1C2430]">{m.parte}</span>
                            <span className="text-[11px] text-[#9AA2AF] font-mono ml-auto">{m.processo}</span>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-2">
                            {(attached[m.id] || []).map((f, idx) => (
                              <span key={idx} className="flex items-center gap-1.5 bg-[#F5F6F8] border border-[#E2E5EA] rounded-md px-2.5 py-1 text-[11px] text-[#44546A]">
                                <FileText size={12} /> {f}
                                <button onClick={() => removeFile(m.id, idx)} className="text-[#9AA2AF] hover:text-[#A33B3B]">
                                  <X size={11} />
                                </button>
                              </span>
                            ))}
                          </div>

                          <button
                            onClick={() =>
                              attachFile(m.id, m.id === 1 ? "peticao_inicial.pdf" : m.id === 3 ? "sentenca.pdf" : "documento.pdf")
                            }
                            className="flex items-center gap-1.5 text-[12px] text-[#142B4B] font-medium hover:underline"
                          >
                            <Paperclip size={13} /> Anexar documento (simulado)
                          </button>
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

              {/* STEP 4 */}
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
                        Cruzando {MOVIMENTOS.length} movimentações e {Object.values(attached).flat().length} documento(s) anexado(s)…
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {NARRATIVA_IA.map((n, i) => (
                        <div key={i} className="bg-white border border-[#E2E5EA] rounded-lg px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[13px] font-semibold text-[#142B4B]">{n.titulo}</div>
                          </div>
                          <textarea
                            value={editedNarrativa[i]}
                            onChange={(e) => setEditedNarrativa((arr) => arr.map((t, idx) => (idx === i ? e.target.value : t)))}
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
                        className="mt-2 inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors self-start"
                      >
                        Gerar relatório final <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 5 */}
              {step === 5 && (
                <div>
                  <h1 className="text-[20px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
                    Relatório pronto
                  </h1>
                  <p className="text-[13px] text-[#7A8394] mb-6">
                    Gerado com os dados da planilha, o diff do mês e a análise revisada. Já está no histórico.
                  </p>

                  <div className="bg-white border border-[#E2E5EA] rounded-xl overflow-hidden">
                    <div className="bg-[#142B4B] px-6 py-8 text-center">
                      <div className="text-white text-[16px] font-semibold" style={{ fontFamily: "Georgia, serif" }}>
                        RELATÓRIO EXECUTIVO
                      </div>
                      <div className="text-[#9C7C38] text-[13px] font-semibold mt-1">CONCRELINE</div>
                      <div className="text-white/60 text-[11px] mt-1">Referência: Junho/2026</div>
                    </div>
                    <div className="px-6 py-5 flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                        <CheckCircle2 size={15} className="text-[#3F6B4F]" /> Sumário executivo com KPIs do mês
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                        <CheckCircle2 size={15} className="text-[#3F6B4F]" /> Análise do período ({NARRATIVA_IA.length} destaques revisados)
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                        <CheckCircle2 size={15} className="text-[#3F6B4F]" /> Panorama da carteira + maiores exposições
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-[#44546A]">
                        <CheckCircle2 size={15} className="text-[#3F6B4F]" /> {Object.values(attached).flat().length} documento(s) anexado(s) e referenciado(s)
                      </div>
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                      <button className="flex-1 flex items-center justify-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#1c3a63] transition-colors">
                        <Download size={14} /> Baixar relatório (.docx)
                      </button>
                      <button
                        onClick={() => setView("historico")}
                        className="flex items-center justify-center gap-2 border border-[#D9DCE1] text-[#44546A] text-[13px] font-medium px-5 py-3 rounded-lg hover:bg-[#F5F6F8] transition-colors"
                      >
                        <History size={14} /> Ver histórico
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
