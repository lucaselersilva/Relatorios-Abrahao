import React from "react";

const NAVY = "#142B4B";

export function ErrorScreen({ title, message }) {
  return (
    <div className="min-h-screen w-full bg-[#F7F8FA] flex items-center justify-center p-6">
      <div className="bg-white border border-[#E2E5EA] rounded-xl px-8 py-8 w-full max-w-md text-center">
        <h1 className="text-[16px] font-semibold mb-3" style={{ fontFamily: "Georgia, serif", color: NAVY }}>
          {title}
        </h1>
        <p className="text-[13px] text-[#44546A] leading-relaxed whitespace-pre-line">{message}</p>
      </div>
    </div>
  );
}

// Evita a "tela branca": qualquer erro de renderização vira uma mensagem legível
// em vez de um <div id="root"> vazio sem nenhuma pista do que aconteceu.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Erro não tratado na aplicação:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorScreen
          title="Algo deu errado"
          message={`A aplicação encontrou um erro inesperado. Recarregue a página; se persistir, avise o suporte.\n\n${
            this.state.error?.message || ""
          }`}
        />
      );
    }
    return this.props.children;
  }
}
