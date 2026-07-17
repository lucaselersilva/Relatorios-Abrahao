import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2, AlertTriangle, FileText, ChevronRight, Link2, Copy, Check, X } from "lucide-react";
import { api } from "../lib/api.js";
import ReportView from "../components/ReportView.jsx";

function tokenValido(expiresAt) {
  return expiresAt && new Date(expiresAt) > new Date();
}

export default function RelatorioVisualizar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [baixando, setBaixando] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);

  // Link seguro de visualização (link público).
  const [shareOpen, setShareOpen] = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [shareExpiresAt, setShareExpiresAt] = useState(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    api
      .getReport(id)
      .then((d) => {
        setData(d);
        if (tokenValido(d.shareTokenExpiresAt)) {
          setShareToken(d.shareToken);
          setShareExpiresAt(d.shareTokenExpiresAt);
        }
      })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [id]);

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

  const handleDownloadPdf = async () => {
    setBaixandoPdf(true);
    try {
      const url = await api.getPdfDownloadUrl(id);
      window.open(url, "_blank");
    } catch (e) {
      setErro(e.message || "Erro ao baixar o PDF");
    } finally {
      setBaixandoPdf(false);
    }
  };

  const shareUrl = shareToken ? `${window.location.origin}/r/${shareToken}` : "";

  const handleGerarLink = async () => {
    setShareBusy(true);
    setErro("");
    try {
      const res = await api.createShareLink(id);
      setShareToken(res.token);
      setShareExpiresAt(res.expiresAt);
    } catch (e) {
      setErro(e.message || "Erro ao gerar o link");
    } finally {
      setShareBusy(false);
    }
  };

  const handleRevogar = async () => {
    setShareBusy(true);
    try {
      await api.revokeShareLink(id);
      setShareToken(null);
      setShareExpiresAt(null);
    } catch (e) {
      setErro(e.message || "Erro ao revogar o link");
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro("Não foi possível copiar. Copie o link manualmente.");
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

  const { status, docxKey, pdfKey } = data;

  return (
    <div className="px-10 py-9 max-w-5xl">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[12px] text-[#7A8394] hover:text-[#142B4B]">
          <ArrowLeft size={13} /> Voltar
        </button>
        {docxKey ? (
          <div className="flex items-center gap-2 flex-wrap">
            {status === "pronto" && (
              <button
                onClick={() => setShareOpen((v) => !v)}
                className="flex items-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#F5F6F8] transition-colors"
              >
                <Link2 size={14} /> {shareToken ? "Link do cliente" : "Gerar link para o cliente"}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={baixando}
              className="flex items-center gap-2 border border-[#D9DCE1] text-[#142B4B] text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#F5F6F8] transition-colors disabled:opacity-60"
            >
              {baixando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} .docx
            </button>
            {pdfKey && (
              <button
                onClick={handleDownloadPdf}
                disabled={baixandoPdf}
                className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
              >
                {baixandoPdf ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} Baixar PDF
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => navigate(`/relatorios/novo?reportId=${id}`)}
            className="flex items-center gap-2 border border-[#D9DCE1] text-[#8A6D1F] text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#F5F6F8] transition-colors"
          >
            <ChevronRight size={14} /> Continuar rascunho
          </button>
        )}
      </div>

      {/* Painel do link seguro */}
      {shareOpen && status === "pronto" && (
        <div className="mb-5 bg-[#F7F8FA] border border-[#E2E5EA] rounded-lg px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-semibold text-[#44546A] uppercase tracking-wide">Link para o cliente</div>
            <button onClick={() => setShareOpen(false)} className="text-[#9AA2AF] hover:text-[#142B4B]">
              <X size={15} />
            </button>
          </div>
          {shareToken ? (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-[220px] text-[13px] px-3 py-2 rounded-lg border border-[#D9DCE1] bg-white text-[#44546A] font-mono"
                />
                <button
                  onClick={handleCopiar}
                  className="flex items-center gap-1.5 bg-[#142B4B] text-white text-[12.5px] font-medium px-3 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors"
                >
                  {copiado ? <Check size={13} /> : <Copy size={13} />} {copiado ? "Copiado" : "Copiar"}
                </button>
              </div>
              <div className="flex items-center gap-4 mt-2.5 text-[12px] text-[#7A8394]">
                <span>Válido até {new Date(shareExpiresAt).toLocaleDateString("pt-BR")} · abre sem login, em qualquer dispositivo.</span>
                <button onClick={handleGerarLink} disabled={shareBusy} className="text-[#8A6D1F] font-medium hover:underline disabled:opacity-60">
                  Renovar (+30 dias)
                </button>
                <button onClick={handleRevogar} disabled={shareBusy} className="text-[#A33B3B] font-medium hover:underline disabled:opacity-60">
                  Revogar
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[13px] text-[#7A8394]">Nenhum link ativo. Gere um link válido por 30 dias para o cliente abrir no navegador.</span>
              <button
                onClick={handleGerarLink}
                disabled={shareBusy}
                className="flex items-center gap-1.5 bg-[#142B4B] text-white text-[12.5px] font-medium px-3 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
              >
                {shareBusy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Gerar link
              </button>
            </div>
          )}
        </div>
      )}

      {erro && (
        <div className="mb-5 flex items-center gap-2 bg-[#FBEAEA] border border-[#E9C6C6] text-[#A33B3B] text-[13px] px-4 py-3 rounded-lg">
          <AlertTriangle size={14} /> {erro}
        </div>
      )}

      <ReportView data={data} />
    </div>
  );
}
