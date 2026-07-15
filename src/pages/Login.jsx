import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { LOGO_SRC } from "../assets/logo.js";

const NAVY = "#142B4B";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/historico", { replace: true });
    } catch (err) {
      setError(err.message || "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E5EA] rounded-xl px-8 py-8 w-full max-w-sm">
        <img src={LOGO_SRC} alt="Abrahão Advogados" className="h-9 w-auto object-contain mx-auto mb-6" />
        <h1 className="text-[18px] font-semibold text-center mb-6" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
          Portal de Relatórios
        </h1>

        <label className="block text-[12px] font-medium text-[#44546A] mb-1">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 text-[13px] border border-[#D9DCE1] rounded-lg px-3 py-2 outline-none focus:border-[#9C7C38]"
          placeholder="voce@abrahaoadv.com.br"
        />

        <label className="block text-[12px] font-medium text-[#44546A] mb-1">Senha</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 text-[13px] border border-[#D9DCE1] rounded-lg px-3 py-2 outline-none focus:border-[#9C7C38]"
          placeholder="••••••••"
        />

        {error && <div className="text-[12px] text-[#A33B3B] mb-4">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-4 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors disabled:opacity-60"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Entrar
        </button>
      </form>
    </div>
  );
}
