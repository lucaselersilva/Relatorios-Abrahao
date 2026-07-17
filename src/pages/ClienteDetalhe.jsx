import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, FilePlus2, Download, ChevronRight, CheckCircle2, Loader2,
  Building2, Layers, Paperclip, AlertTriangle, TrendingUp, Eye, Trash2,
  Mail, Star, Plus,
} from "lucide-react";
import { api } from "../lib/api.js";

const NAVY = "#142B4B";

const PERIODOS = [
  { id: "3m", label: "3 meses", meses: 3 },
  { id: "6m", label: "6 meses", meses: 6 },
  { id: "12m", label: "12 meses", meses: 12 },
  { id: "all", label: "Tudo", meses: null },
];

function formatMoeda(valor) {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [periodo, setPeriodo] = useState("6m");
  const [contacts, setContacts] = useState([]);
  const [novoContato, setNovoContato] = useState({ nome: "", email: "", principal: false });
  const [contatoErro, setContatoErro] = useState("");
  const [salvandoContato, setSalvandoContato] = useState(false);

  useEffect(() => {
    api
      .getClient(id)
      .then((d) => {
        setData(d);
        setContacts(d.contacts ?? []);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const reloadContacts = async () => {
    const d = await api.getClient(id);
    setContacts(d.contacts ?? []);
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    setContatoErro("");
    if (!novoContato.nome.trim() || !novoContato.email.trim()) {
      setContatoErro("Preencha nome e e-mail.");
      return;
    }
    setSalvandoContato(true);
    try {
      await api.addContact(id, novoContato);
      setNovoContato({ nome: "", email: "", principal: false });
      await reloadContacts();
    } catch (err) {
      setContatoErro(err.message);
    } finally {
      setSalvandoContato(false);
    }
  };

  const handleSetPrincipal = async (contactId) => {
    setContatoErro("");
    try {
      await api.updateContact(id, contactId, { principal: true });
      await reloadContacts();
    } catch (err) {
      setContatoErro(err.message);
    }
  };

  const handleRemoveContact = async (contactId) => {
    setContatoErro("");
    try {
      await api.removeContact(id, contactId);
      await reloadContacts();
    } catch (err) {
      setContatoErro(err.message);
    }
  };

  // Agregação de movimentações dentro do intervalo escolhido (feita no cliente,
  // a partir das versões já carregadas).
  const intervalo = useMemo(() => {
    if (!data) return null;
    const cfg = PERIODOS.find((p) => p.id === periodo);
    const limite = cfg?.meses ? new Date(Date.now() - cfg.meses * 30 * 24 * 60 * 60 * 1000) : null;

    const versoesNoIntervalo = data.versoes.filter(
      (v) => !limite || new Date(v.createdAt) >= limite
    );

    const porTipo = { novo: 0, movimentacao: 0, acordo: 0, encerrado: 0 };
    let total = 0;
    let valor = 0;
    for (const v of versoesNoIntervalo) {
      total += v.totalMovimentacoes;
      valor += v.valorMovimentado ?? 0;
      for (const t of Object.keys(porTipo)) porTipo[t] += v.porTipo?.[t] ?? 0;
    }
    return { total, porTipo, valor, versoes: versoesNoIntervalo.length };
  }, [data, periodo]);

  if (loading) {
    return (
      <div className="px-10 py-10 flex items-center gap-2 text-[13px] text-[#7A8394]">
        <Loader2 size={16} className="animate-spin" /> Carregando cliente…
      </div>
    );
  }

  if (erro || !data) {
    return (
      <div className="px-10 py-10">
        <button
          onClick={() => navigate("/clientes")}
          className="flex items-center gap-1.5 text-[12px] text-[#7A8394] hover:text-[#142B4B] mb-4"
        >
          <ArrowLeft size={13} /> Voltar para clientes
        </button>
        <div className="bg-[#FBEAEA] border border-[#E9C6C6] text-[#A33B3B] text-[13px] px-4 py-3 rounded-lg">
          {erro || "Cliente não encontrado."}
        </div>
      </div>
    );
  }

  const { client, kpisAtuais, versoes } = data;

  const handleDownload = async (reportId) => {
    try {
      const url = await api.getDownloadUrl(reportId);
      window.open(url, "_blank");
    } catch (e) {
      setErro(e.message);
    }
  };

  const handleDelete = async (reportId) => {
    if (!window.confirm("Excluir este rascunho? A planilha e os anexos deste período serão removidos. Esta ação não pode ser desfeita.")) return;
    setErro("");
    try {
      await api.deleteReport(reportId);
      setData(await api.getClient(id));
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div className="px-10 py-10 max-w-5xl">
      <button
        onClick={() => navigate("/clientes")}
        className="flex items-center gap-1.5 text-[12px] text-[#7A8394] hover:text-[#142B4B] mb-5"
      >
        <ArrowLeft size={13} /> Clientes
      </button>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#F0EDE3] flex items-center justify-center">
            <Building2 size={20} className="text-[#142B4B]" />
          </div>
          <div>
            <h1 className="text-[22px] font-semibold leading-tight" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
              {client.nome}
            </h1>
            <p className="text-[12px] text-[#9AA2AF] mt-0.5">
              Cliente desde {new Date(client.createdAt).toLocaleDateString("pt-BR")} · {versoes.length} versão(ões) do relatório
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/relatorios/novo?clientId=${client.id}`)}
          className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors"
        >
          <FilePlus2 size={14} /> Nova versão do relatório
        </button>
      </div>

      {/* KPIs atuais (do último relatório) */}
      {kpisAtuais && (
        <>
          <div className="text-[12px] font-semibold text-[#44546A] uppercase tracking-wide mb-3">
            Situação atual da carteira
          </div>
          <div className="grid grid-cols-4 gap-3 mb-10">
            {[
              ["Processos ativos", kpisAtuais.processos, false],
              ["Valor envolvido", kpisAtuais.valorEnvolvido, false],
              ["Provisão total", kpisAtuais.provisao, false],
              ["Sem provisão adequada", kpisAtuais.semProvisao, true],
            ].map(([label, val, alerta], i) => (
              <div key={i} className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3 min-w-0">
                <div
                  className="text-[16px] font-semibold break-words"
                  style={{ fontFamily: "Georgia, serif", color: alerta ? "#A33B3B" : NAVY }}
                >
                  {val}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mt-1">{label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Contatos do cliente (destinatários dos relatórios) */}
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[12px] font-semibold text-[#44546A] uppercase tracking-wide">Contatos</div>
        <span className="text-[11px] text-[#9AA2AF]">— destinatários do relatório por e-mail</span>
      </div>
      <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden mb-10">
        {contacts.length === 0 ? (
          <div className="px-5 py-4 text-[12.5px] text-[#9AA2AF]">
            Nenhum contato cadastrado. Adicione ao menos um para poder enviar o relatório por e-mail.
          </div>
        ) : (
          contacts.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-5 py-3 ${i !== contacts.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#F0EDE3] flex items-center justify-center shrink-0">
                <Mail size={14} className="text-[#142B4B]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[#1C2430] truncate">{c.nome}</span>
                  {c.principal && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F4EEDD] text-[#8A6D1F]">
                      <Star size={10} /> Principal
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-[#9AA2AF] truncate">{c.email}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {!c.principal && (
                  <button
                    onClick={() => handleSetPrincipal(c.id)}
                    className="flex items-center gap-1 text-[12px] text-[#8A6D1F] font-medium hover:underline"
                    title="Definir como contato principal"
                  >
                    <Star size={12} /> Tornar principal
                  </button>
                )}
                <button
                  onClick={() => handleRemoveContact(c.id)}
                  className="flex items-center gap-1 text-[12px] text-[#A33B3B] font-medium hover:underline"
                  title="Remover contato"
                >
                  <Trash2 size={12} /> Remover
                </button>
              </div>
            </div>
          ))
        )}
        <form onSubmit={handleAddContact} className="flex items-center gap-2 px-5 py-3 border-t border-[#F3F4F6] bg-[#FAFAFB] flex-wrap">
          <input
            value={novoContato.nome}
            onChange={(e) => setNovoContato((v) => ({ ...v, nome: e.target.value }))}
            placeholder="Nome do contato"
            className="flex-1 min-w-[140px] text-[13px] px-3 py-2 rounded-lg border border-[#D9DCE1] focus:outline-none focus:border-[#142B4B]"
          />
          <input
            value={novoContato.email}
            onChange={(e) => setNovoContato((v) => ({ ...v, email: e.target.value }))}
            placeholder="email@empresa.com"
            type="email"
            className="flex-1 min-w-[180px] text-[13px] px-3 py-2 rounded-lg border border-[#D9DCE1] focus:outline-none focus:border-[#142B4B]"
          />
          <label className="flex items-center gap-1.5 text-[12px] text-[#44546A] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={novoContato.principal}
              onChange={(e) => setNovoContato((v) => ({ ...v, principal: e.target.checked }))}
            />
            Principal
          </label>
          <button
            type="submit"
            disabled={salvandoContato}
            className="flex items-center gap-1.5 bg-[#142B4B] text-white text-[12.5px] font-medium px-3 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
          >
            {salvandoContato ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Adicionar
          </button>
        </form>
        {contatoErro && (
          <div className="flex items-center gap-2 px-5 py-2 text-[12px] text-[#A33B3B] border-t border-[#F3F4F6]">
            <AlertTriangle size={13} /> {contatoErro}
          </div>
        )}
      </div>

      {/* Movimentações no intervalo */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-semibold text-[#44546A] uppercase tracking-wide">
          Movimentações no período
        </div>
        <div className="flex items-center gap-1 bg-white border border-[#E2E5EA] rounded-lg p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`text-[12px] px-3 py-1 rounded-md transition-colors ${
                periodo === p.id ? "bg-[#142B4B] text-white font-medium" : "text-[#7A8394] hover:bg-[#F5F6F8]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3 mb-10">
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1">
            <TrendingUp size={12} /> Total
          </div>
          <div className="text-[20px] font-semibold" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
            {intervalo.total}
          </div>
        </div>
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1">Processos novos</div>
          <div className="text-[20px] font-semibold" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
            {intervalo.porTipo.novo}
          </div>
        </div>
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1">Alterações</div>
          <div className="text-[20px] font-semibold" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
            {intervalo.porTipo.movimentacao}
          </div>
        </div>
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1">Acordos</div>
          <div className="text-[20px] font-semibold" style={{ fontFamily: "Georgia, serif", color: "#2F5D45" }}>
            {intervalo.porTipo.acordo}
          </div>
        </div>
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1">Encerrados</div>
          <div className="text-[20px] font-semibold" style={{ fontFamily: "Georgia, serif", color: "#44546A" }}>
            {intervalo.porTipo.encerrado}
          </div>
        </div>
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-4 py-3 min-w-0">
          <div className="text-[10px] uppercase tracking-wide text-[#9AA2AF] mb-1">Valor movimentado</div>
          <div className="text-[15px] font-semibold break-words" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
            {formatMoeda(intervalo.valor)}
          </div>
        </div>
      </div>

      {/* Linha do tempo das versões */}
      <div className="text-[12px] font-semibold text-[#44546A] uppercase tracking-wide mb-3">
        Versões do relatório
      </div>

      {versoes.length === 0 ? (
        <div className="bg-white border border-[#E2E5EA] rounded-lg px-6 py-10 text-center text-[13px] text-[#9AA2AF]">
          Nenhum relatório gerado para este cliente ainda.
          <div className="mt-3">
            <button
              onClick={() => navigate(`/relatorios/novo?clientId=${client.id}`)}
              className="inline-flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors"
            >
              <FilePlus2 size={14} /> Gerar primeiro relatório
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden">
          {versoes.map((v, i) => (
            <div
              key={v.id}
              className={`flex items-center gap-4 px-5 py-4 ${
                i !== versoes.length - 1 ? "border-b border-[#F3F4F6]" : ""
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-[#F0EDE3] flex items-center justify-center shrink-0">
                <span className="text-[12px] font-semibold text-[#142B4B]">v{v.versao}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[#1C2430]">{v.mesReferencia}</span>
                  <StatusBadge status={v.status} />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[#9AA2AF] mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Layers size={11} /> {v.totalMovimentacoes} movimentação(ões)
                  </span>
                  {v.totalAnexos > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip size={11} /> {v.totalAnexos} anexo(s)
                    </span>
                  )}
                  <span>{new Date(v.finalizedAt ?? v.createdAt).toLocaleDateString("pt-BR")}</span>
                  <span>· {v.autor}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => navigate(`/relatorios/${v.id}`)}
                  className="flex items-center gap-1 text-[12px] text-[#44546A] font-medium hover:underline"
                >
                  <Eye size={13} /> Visualizar
                </button>
                {v.docxDisponivel ? (
                  <button
                    onClick={() => handleDownload(v.id)}
                    className="flex items-center gap-1 text-[12px] text-[#142B4B] font-medium hover:underline"
                  >
                    <Download size={13} /> Baixar
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/relatorios/novo?reportId=${v.id}`)}
                    className="flex items-center gap-1 text-[12px] text-[#8A6D1F] font-medium hover:underline"
                  >
                    <ChevronRight size={13} /> Continuar
                  </button>
                )}
                {v.status === "rascunho" && (
                  <button
                    onClick={() => handleDelete(v.id)}
                    title="Excluir rascunho"
                    className="flex items-center gap-1 text-[12px] text-[#A33B3B] font-medium hover:underline"
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-[#A33B3B]">
          <AlertTriangle size={13} /> {erro}
        </div>
      )}
    </div>
  );
}
