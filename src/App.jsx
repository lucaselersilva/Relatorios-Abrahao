import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Historico from "./pages/Historico.jsx";
import Clientes from "./pages/Clientes.jsx";
import ClienteDetalhe from "./pages/ClienteDetalhe.jsx";
import NovoRelatorio from "./pages/NovoRelatorio.jsx";
import RelatorioVisualizar from "./pages/RelatorioVisualizar.jsx";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#F7F8FA]">
        <Loader2 size={24} className="animate-spin text-[#142B4B]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/historico" element={<Historico />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/:id" element={<ClienteDetalhe />} />
        <Route path="/relatorios/novo" element={<NovoRelatorio />} />
        <Route path="/relatorios/:id" element={<RelatorioVisualizar />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
