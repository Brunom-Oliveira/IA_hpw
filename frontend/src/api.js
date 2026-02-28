import axios from "axios";

const timeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 420000);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  timeout: Number.isFinite(timeoutMs) ? timeoutMs : 420000,
});

export default api;
