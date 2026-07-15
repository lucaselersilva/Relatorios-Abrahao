import React, { useEffect, useState } from "react";
import { Building2, Plus, Loader2 } from "lucide-react";
import { api } from "../lib/api.js";

const NAVY = "#142B4B";

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = () => api.listClients().then(setClients).catch(console.error).finally(() => setLoading(false));

  useEffect(() => {
    carregar();
  }, []);

  const handleCriar = async (e) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setCriando(true);
    setErro("");
    try {
      await api.createClient(novoNome.trim());
      setNovoNome("");
      await carregar();
    } catch (err) {
      setErro(err.message || "Erro ao criar cliente");
    } finally {
      setCriando(false);
    }
  };

  return (
    <div className="px-10 py-10 max-w-3xl">
      <h1 className="text-[22px] font-semibold mb-1" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
        Clientes
      </h1>
      <p className="text-[13px] text-[#7A8394] mb-6">Clientes do escritório para os quais relatórios podem ser gerados.</p>

      <form onSubmit={handleCriar} className="flex items-center gap-2 mb-6">
        <input
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          placeholder="Nome do novo cliente…"
          className="flex-1 text-[13px] border border-[#D9DCE1] rounded-lg px-3 py-2.5 outline-none focus:border-[#9C7C38]"
        />
        <button
          type="submit"
          disabled={criando}
          className="flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
        >
          {criando ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar cliente
        </button>
      </form>
      {erro && <div className="text-[12px] text-[#A33B3B] mb-4">{erro}</div>}

      <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden">
        {loading ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#9AA2AF]">Carregando…</div>
        ) : clients.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-[#9AA2AF]">Nenhum cliente cadastrado ainda.</div>
        ) : (
          clients.map((c, i) => (
            <div
              key={c.id}
              className={`flex items-center gap-3 px-5 py-3.5 ${i !== clients.length - 1 ? "border-b border-[#F3F4F6]" : ""}`}
            >
              <Building2 size={16} className="text-[#9AA2AF]" />
              <div className="text-[13px] font-medium text-[#1C2430]">{c.nome}</div>
              <div className="text-[11px] text-[#9AA2AF] ml-auto">
                Cliente desde {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
