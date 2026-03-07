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
    config.headers["x-rag-admin-token"] = token;
  }
  return config;
});

export default api;
