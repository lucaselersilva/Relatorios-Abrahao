import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus2, Search, Download, ChevronRight, CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../lib/api.js";

const NAVY = "#142B4B";

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

export default function Historico() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    api.listReports().then(setReports).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleDownload = async (id) => {
    try {
      const url = await api.getDownloadUrl(id);
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
    }
  };

  const filtrados = reports.filter((r) => r.cliente.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="px-10 py-10 max-w-5xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-[22px] font-semibold" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
          Histórico de relatórios
        </h1>
        <button
          onClick={() => navigate("/relatorios/novo")}
          className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors"
        >
          <FilePlus2 size={14} /> Novo relatório
        </button>
      </div>
      <p className="text-[13px] text-[#7A8394] mb-6">Todos os relatórios gerados pelo escritório, por cliente e mês de referência.</p>

      <div className="flex items-center gap-2 mb-4 bg-white border border-[#E2E5EA] rounded-lg px-3 py-2 max-w-sm">
        <Search size={14} className="text-[#9AA2AF]" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente…"
          className="text-[13px] outline-none w-full placeholder:text-[#B3B9C2]"
        />
      </div>

      <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#9AA2AF]">Carregando…</div>
        ) : filtrados.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#9AA2AF]">Nenhum relatório encontrado.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#EEF0F3] text-[11px] uppercase tracking-wide text-[#9AA2AF]">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Versão</th>
                <th className="px-5 py-3 font-medium">Mês de referência</th>
                <th className="px-5 py-3 font-medium">Gerado em</th>
                <th className="px-5 py-3 font-medium">Responsável</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((h, i) => (
                <tr key={h.id} className={`text-[13px] ${i !== filtrados.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}>
                  <td className="px-5 py-3.5 font-medium text-[#1C2430]">
                    {h.clienteId ? (
                      <button
                        onClick={() => navigate(`/clientes/${h.clienteId}`)}
                        className="hover:text-[#142B4B] hover:underline text-left"
                      >
                        {h.cliente}
                      </button>
                    ) : (
                      h.cliente
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-[#7A8394]">
                    <span className="inline-flex items-center justify-center text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#F0EDE3] text-[#142B4B]">
                      v{h.versao ?? 1}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[#44546A]">{h.mes}</td>
                  <td className="px-5 py-3.5 text-[#7A8394]">{new Date(h.geradoEm).toLocaleDateString("pt-BR")}</td>
                  <td className="px-5 py-3.5 text-[#7A8394]">{h.autor}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={h.status} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {h.status === "pronto" ? (
                        <button
                          onClick={() => handleDownload(h.id)}
                          className="flex items-center gap-1 text-[12px] text-[#142B4B] font-medium hover:underline"
                        >
                          <Download size={13} /> Baixar
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/relatorios/novo?reportId=${h.id}`)}
                          className="flex items-center gap-1 text-[12px] text-[#8A6D1F] font-medium hover:underline"
                        >
                          <ChevronRight size={13} /> Continuar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
