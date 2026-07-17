import React, { useEffect, useState } from "react";
import { X, Mail, Loader2, Send, CheckCircle2, AlertTriangle, Star } from "lucide-react";
import { api } from "../lib/api.js";

// Modal "Enviar ao cliente": escolhe contato(s) do cliente e dispara o envio.
// Sem provedor de e-mail configurado, o servidor devolve um mailto e a mensagem
// é aberta no cliente de e-mail do próprio advogado (com o link seguro).
// Recebe `contacts` (opcional) ou busca pelos contatos via `clientId`.
export default function EnviarEmailModal({ reportId, clientId, contacts: contactsProp, onClose, onSent }) {
  const [contacts, setContacts] = useState(contactsProp ?? null);
  const [selected, setSelected] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (contactsProp) {
      setContacts(contactsProp);
      return;
    }
    if (clientId) {
      api
        .getClient(clientId)
        .then((d) => setContacts(d.contacts ?? []))
        .catch((e) => setErro(e.message));
    }
  }, [contactsProp, clientId]);

  // Pré-seleciona o contato principal (ou todos, se nenhum for principal).
  useEffect(() => {
    if (!contacts) return;
    const principais = contacts.filter((c) => c.principal);
    const base = principais.length ? principais : contacts;
    setSelected(Object.fromEntries(base.map((c) => [c.id, true])));
  }, [contacts]);

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selecionados = (contacts ?? []).filter((c) => selected[c.id]);

  const handleEnviar = async () => {
    setErro("");
    if (!selecionados.length) {
      setErro("Selecione ao menos um contato.");
      return;
    }
    setEnviando(true);
    try {
      const res = await api.sendReportEmail(reportId, { contactIds: selecionados.map((c) => c.id) });
      if (res.configured === false) {
        // Sem provedor: abre o e-mail já preenchido no cliente de e-mail do advogado.
        window.location.href = res.mailto;
        setResultado({ tipo: "manual", to: res.to });
      } else {
        setResultado({ tipo: "enviado", results: res.results ?? [] });
      }
      onSent?.();
    } catch (e) {
      setErro(e.message || "Erro ao enviar o e-mail.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EEF0F3]">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#142B4B]">
            <Mail size={16} /> Enviar ao cliente
          </div>
          <button onClick={onClose} className="text-[#9AA2AF] hover:text-[#142B4B]">
            <X size={17} />
          </button>
        </div>

        <div className="px-5 py-4">
          {resultado ? (
            <div className="flex flex-col gap-3">
              {resultado.tipo === "manual" ? (
                <div className="flex items-start gap-2 bg-[#F4EEDD] text-[#8A6D1F] text-[13px] px-4 py-3 rounded-lg">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                  <div>
                    E-mail preparado no seu cliente de e-mail (Gmail/Outlook) para{" "}
                    <strong>{resultado.to?.join(", ")}</strong>. Revise e clique em enviar por lá. O envio foi registrado
                    na linha do tempo do cliente.
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {resultado.results.map((r) => (
                    <div
                      key={r.email}
                      className={`flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-lg ${
                        r.status === "enviado" ? "bg-[#E4EDE7] text-[#2F5D45]" : "bg-[#FBEAEA] text-[#A33B3B]"
                      }`}
                    >
                      {r.status === "enviado" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      <span className="font-medium">{r.email}</span>
                      <span className="text-[12px] opacity-80">
                        {r.status === "enviado" ? "enviado" : `falhou: ${r.error ?? "erro"}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={onClose}
                className="mt-1 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2 rounded-lg hover:bg-[#1c3a63] transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : contacts === null ? (
            <div className="flex items-center gap-2 text-[13px] text-[#7A8394] py-4">
              <Loader2 size={15} className="animate-spin" /> Carregando contatos…
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-[13px] text-[#7A8394] py-2">
              Este cliente não tem contatos cadastrados. Cadastre ao menos um contato na página do cliente para poder
              enviar o relatório.
            </div>
          ) : (
            <>
              <div className="text-[12px] text-[#7A8394] mb-3">
                Selecione quem recebe. O e-mail leva o link seguro do relatório (abre no celular, sem login).
              </div>
              <div className="flex flex-col gap-1.5 mb-4">
                {contacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[#E2E5EA] cursor-pointer hover:bg-[#F7F8FA]"
                  >
                    <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggle(c.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-[#1C2430] truncate">{c.nome}</span>
                        {c.principal && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F4EEDD] text-[#8A6D1F]">
                            <Star size={9} /> Principal
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] text-[#9AA2AF] truncate">{c.email}</div>
                    </div>
                  </label>
                ))}
              </div>

              {erro && (
                <div className="flex items-center gap-2 text-[12px] text-[#A33B3B] mb-3">
                  <AlertTriangle size={13} /> {erro}
                </div>
              )}

              <button
                onClick={handleEnviar}
                disabled={enviando}
                className="w-full flex items-center justify-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
              >
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar ao cliente
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
