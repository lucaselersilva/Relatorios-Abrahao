import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ErrorBoundary, ErrorScreen } from "./components/ErrorBoundary.jsx";
import { supabaseConfigError } from "./lib/supabaseClient.js";
import { initMonitoring } from "./lib/monitoring.js";
import "./index.css";

// Liga o monitoramento de erros se houver VITE_SENTRY_DSN (senão, no-op).
initMonitoring();

const root = ReactDOM.createRoot(document.getElementById("root"));

// Sem as variáveis do Supabase, nada funciona — mostramos o motivo em vez de
// deixar a app quebrar com uma tela branca.
if (supabaseConfigError) {
  root.render(
    <React.StrictMode>
      <ErrorScreen title="Configuração incompleta" message={supabaseConfigError} />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
