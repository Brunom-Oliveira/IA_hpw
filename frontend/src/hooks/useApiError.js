import { useState } from "react";

export function useApiError() {
  const [error, setError] = useState(null);

  const handleError = (err) => {
    if (typeof err === "string") {
      setError({ message: err, type: "generic" });
    } else if (err?.type) {
      setError(err);
    } else {
      setError({ message: "Erro desconhecido", type: "unknown" });
    }
  };

  const clearError = () => setError(null);

  const getDisplayMessage = () => {
    if (!error) return "";

    switch (error.type) {
      case "server":
        return `⚠️ Erro do servidor (${error.status}). Tente novamente em alguns minutos.`;
      case "auth":
        return "🔒 Você não tem permissão. Faça login novamente.";
      case "validation":
        return `📋 ${error.message}`;
      case "timeout":
        return "⏱️ Requisição demorou demais. Tente novamente.";
      case "network":
        return "🌐 Sem conexão com o servidor.";
      case "ratelimit":
        return "⏸️ Muitas requisições. Aguarde alguns minutos antes de tentar novamente.";
      case "generic":
      case "unknown":
        return `❌ ${error.message}`;
      default:
        return error.message || "Erro inesperado";
    }
  };

  return {
    error,
    setError,
    handleError,
    clearError,
    displayMessage: getDisplayMessage(),
    hasError: !!error,
  };
}
