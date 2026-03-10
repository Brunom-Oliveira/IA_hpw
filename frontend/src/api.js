import axios from "axios";

const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 60000);
export const RAG_ADMIN_TOKEN_KEY = "rag_admin_token";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  timeout: Number.isFinite(timeoutMs) ? timeoutMs : 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(RAG_ADMIN_TOKEN_KEY) || import.meta.env.VITE_RAG_ADMIN_TOKEN || "";
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data, headers } = error.response;
      const base = { status, requestId: headers?.["x-request-id"] };
      if (status >= 500) {
        return Promise.reject({ type: "server", message: "Erro ao processar sua requisição. Tente novamente.", ...base });
      }
      if (status === 401 || status === 403) {
        return Promise.reject({ type: "auth", message: "Você não tem permissão para acessar este recurso.", ...base });
      }
      if (status === 400) {
        return Promise.reject({
          type: "validation",
          message: data?.error || "Dados inválidos.",
          details: data?.details,
          ...base,
        });
      }
      if (status === 429) {
        return Promise.reject({ type: "ratelimit", message: "Muitas requisições. Aguarde e tente novamente.", ...base });
      }
    } else if (error.code === "ECONNABORTED") {
      return Promise.reject({ type: "timeout", message: "A requisição demorou muito tempo. Tente novamente." });
    } else if (error.message === "Network Error") {
      return Promise.reject({ type: "network", message: "Sem conexão com o servidor." });
    }
    return Promise.reject({ type: "unknown", message: error.message || "Erro inesperado" });
  },
);

export default api;
