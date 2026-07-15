import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { FilePlus2, History, Users, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { LOGO_SRC } from "../assets/logo.js";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-colors ${
      isActive ? "bg-[#F0EDE3] text-[#142B4B] font-medium" : "text-[#5C6470] hover:bg-[#F5F6F8]"
    }`;

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] text-[#1C2430] flex" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <div className="w-60 shrink-0 border-r border-[#E2E5EA] bg-white min-h-screen flex flex-col">
        <div className="px-5 pt-6 pb-5 border-b border-[#EEF0F3]">
          <img src={LOGO_SRC} alt="Abrahão Advogados" className="h-9 w-auto object-contain" />
          <div className="text-[10px] text-[#9AA2AF] mt-2 tracking-wide">Portal de Relatórios</div>
        </div>

        <div className="px-3 pt-4">
          <NavLink
            to="/relatorios/novo"
            className="w-full flex items-center gap-2 bg-[#142B4B] text-white text-[13px] font-medium px-3.5 py-2.5 rounded-lg hover:bg-[#1c3a63] transition-colors"
          >
            <FilePlus2 size={15} /> Novo relatório
          </NavLink>
        </div>

        <div className="px-3 mt-5 flex flex-col gap-0.5">
          <div className="text-[10px] font-semibold text-[#9AA2AF] uppercase tracking-wide px-2.5 mb-1.5">Navegação</div>
          <NavLink to="/historico" className={navLinkClass}>
            <History size={15} /> Histórico de relatórios
          </NavLink>
          <NavLink to="/clientes" className={navLinkClass}>
            <Users size={15} /> Clientes
          </NavLink>
        </div>

        <div className="mt-auto px-5 py-4 border-t border-[#EEF0F3]">
          <div className="text-[12px] font-medium text-[#44546A]">{user?.name || "Escritório Abrahão"}</div>
          <div className="text-[11px] text-[#9AA2AF] mb-2">{user?.email}</div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-[11px] text-[#9AA2AF] hover:text-[#A33B3B]">
            <LogOut size={12} /> Sair
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
