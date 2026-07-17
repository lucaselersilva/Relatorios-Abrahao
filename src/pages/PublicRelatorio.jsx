import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, FileText, AlertTriangle } from "lucide-react";
import { api } from "../lib/api.js";
import ReportView from "../components/ReportView.jsx";
import { LOGO_SRC } from "../assets/logo.js";

// Tela dedicada, pública (fora do ProtectedRoute): abre o relatório pelo token
// sem exigir login e sem a navegação interna do portal.
export default function PublicRelatorio() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  useEffect(() => {
    api
      .getPublicReport(token)
      .then(setData)
      .catch(() => setErro("Relatório não encontrado. O link pode ter expirado ou ser inválido."))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownloadPdf = async () => {
    setBaixandoPdf(true);
    try {
      const url = await api.getPublicPdfUrl(token);
      window.open(url, "_blank");
    } catch {
      setErro("Não foi possível baixar o PDF. O link pode ter expirado.");
    } finally {
      setBaixandoPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F8FA] text-[13px] text-[#7A8394]">
        <Loader2 size={18} className="animate-spin mr-2" /> Carregando relatório…
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F7F8FA] px-6 text-center">
        <img src={LOGO_SRC} alt="Abrahão Advogados" className="h-10 w-auto object-contain mb-6 opacity-90" />
        <div className="flex items-center gap-2 bg-white border border-[#E9C6C6] text-[#A33B3B] text-[13px] px-5 py-4 rounded-lg max-w-md">
          <AlertTriangle size={16} className="shrink-0" /> {erro || "Relatório não encontrado."}
        </div>
        <p className="text-[12px] text-[#9AA2AF] mt-4">Se você acredita que isso é um engano, peça um novo link ao escritório.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA]">
      <header className="bg-white border-b border-[#E2E5EA] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={LOGO_SRC} alt="Abrahão Advogados" className="h-8 w-auto object-contain" />
            <span className="text-[12px] text-[#9AA2AF] hidden sm:inline">Relatório executivo confidencial</span>
          </div>
          {data.hasPdf && (
            <button
              onClick={handleDownloadPdf}
              disabled={baixandoPdf}
              className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
            >
              {baixandoPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Baixar PDF
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <ReportView data={data} />
        <div className="text-[11px] text-[#9AA2AF] text-center mt-8 pb-4">
          Portal de Relatórios · Abrahão Advogados
        </div>
      </main>
    </div>
  );
}
