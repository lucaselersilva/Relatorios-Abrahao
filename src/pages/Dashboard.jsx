import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FilePlus2, CheckCircle2, Loader2, Clock, AlertTriangle, ArrowRight, Eye, ChevronRight, Sparkles,
} from "lucide-react";
import { api } from "../lib/api.js";

const NAVY = "#142B4B";

// Como cada status do relatório do mês aparece no dashboard: rótulo, cores e a
// ação que leva o usuário direto ao próximo passo daquele cliente.
const STATUS_META = {
  pronto: { label: "Pronto", chip: "bg-[#E4EDE7] text-[#2F5D45]", Icon: CheckCircle2 },
  rascunho: { label: "Em rascunho", chip: "bg-[#F4EEDD] text-[#8A6D1F]", Icon: Clock },
  analisando: { label: "Analisando", chip: "bg-[#E7EDF6] text-[#2B4B7A]", Icon: Loader2 },
  erro: { label: "Análise falhou", chip: "bg-[#FBEAEA] text-[#A33B3B]", Icon: AlertTriangle },
  sem_relatorio: { label: "Sem relatório", chip: "bg-[#EEF0F3] text-[#7A8394]", Icon: FilePlus2 },
};

function StatusChip({ status }) {
  const m = STATUS_META[status] ?? STATUS_META.sem_relatorio;
  const spin = status === "analisando";
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${m.chip}`}>
      <m.Icon size={11} className={spin ? "animate-spin" : ""} /> {m.label}
    </span>
  );
}

function ResumoCard({ label, valor, destaque }) {
  return (
    <div className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3">
      <div className="text-[22px] font-semibold" style={{ fontFamily: "Georgia, serif", color: destaque || NAVY }}>
        {valor}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mt-1">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Ação principal por cliente, conforme o status do relatório do mês corrente.
  const acaoPara = (c) => {
    if (c.status === "sem_relatorio")
      return {
        label: "Gerar relatório",
        Icon: FilePlus2,
        primary: true,
        onClick: () => navigate(`/relatorios/novo?clientId=${c.id}&periodo=${data.periodo}`),
      };
    if (c.status === "pronto")
      return { label: "Ver relatório", Icon: Eye, onClick: () => navigate(`/relatorios/${c.reportId}`) };
    // rascunho | analisando | erro -> continuar de onde parou
    return {
      label: c.status === "erro" ? "Retomar" : "Continuar",
      Icon: c.status === "erro" ? AlertTriangle : ChevronRight,
      onClick: () => navigate(`/relatorios/novo?reportId=${c.reportId}`),
    };
  };

  if (loading) {
    return (
      <div className="px-10 py-10 flex items-center gap-2 text-[13px] text-[#7A8394]">
        <Loader2 size={16} className="animate-spin" /> Carregando…
      </div>
    );
  }

  if (!data) {
    return <div className="px-10 py-10 text-[13px] text-[#A33B3B]">Não foi possível carregar o dashboard.</div>;
  }

  const { mesReferencia, resumo, clientes } = data;
  const pendentes = clientes.filter((c) => c.status !== "pronto");

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[22px] font-semibold" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
          Ciclo de {mesReferencia}
        </h1>
        <button
          onClick={() => navigate("/relatorios/novo")}
          className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors"
        >
          <FilePlus2 size={14} /> Novo relatório
        </button>
      </div>
      <p className="text-[13px] text-[#7A8394] mb-6">
        Situação dos relatórios deste mês. {resumo.prontos} de {resumo.total} cliente(s) com relatório pronto.
      </p>

      <div className="grid grid-cols-4 gap-3 mb-8">
        <ResumoCard label="Clientes" valor={resumo.total} />
        <ResumoCard label="Prontos" valor={resumo.prontos} destaque="#2F5D45" />
        <ResumoCard label="Em andamento" valor={resumo.emAndamento} destaque="#8A6D1F" />
        <ResumoCard label="Sem relatório" valor={resumo.semRelatorio} destaque={resumo.semRelatorio ? "#A33B3B" : NAVY} />
      </div>

      {clientes.length === 0 ? (
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-6 py-12 text-center">
          <div className="text-[13px] text-[#7A8394] mb-3">Nenhum cliente cadastrado ainda.</div>
          <button
            onClick={() => navigate("/clientes")}
            className="inline-flex items-center gap-2 text-[13px] text-[#142B4B] font-medium hover:underline"
          >
            Cadastrar cliente <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div className="flex items-center gap-2 text-[12px] text-[#8A6D1F] bg-[#FBF8F2] border border-[#EFE6D2] rounded-lg px-4 py-2.5 mb-4">
              <Sparkles size={14} />
              {pendentes.length} cliente(s) ainda sem relatório pronto em {mesReferencia}.
            </div>
          )}

          <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#EEF0F3] text-[11px] uppercase tracking-wide text-[#9AA2AF]">
                  <th className="px-5 py-3 font-medium">Cliente</th>
                  <th className="px-5 py-3 font-medium">Status do mês</th>
                  <th className="px-5 py-3 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c, i) => {
                  const acao = acaoPara(c);
                  return (
                    <tr key={c.id} className={`text-[13px] ${i !== clientes.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}>
                      <td className="px-5 py-3.5 font-medium text-[#1C2430]">
                        <button onClick={() => navigate(`/clientes/${c.id}`)} className="hover:text-[#142B4B] hover:underline text-left">
                          {c.nome}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusChip status={c.status} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={acao.onClick}
                          className={`inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors ${
                            acao.primary
                              ? "bg-[#142B4B] text-white hover:bg-[#1c3a63]"
                              : "border border-[#D9DCE1] text-[#142B4B] hover:bg-[#F5F6F8]"
                          }`}
                        >
                          <acao.Icon size={13} /> {acao.label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
