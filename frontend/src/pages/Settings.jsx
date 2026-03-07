import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const TOP_K_KEY = "rag_top_k";

export default function Settings() {
  const [topK, setTopK] = useState("6");
  const [message, setMessage] = useState("");
  const [ragStats, setRagStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(TOP_K_KEY);
    if (saved) setTopK(saved);
    loadRagStats();
  }, []);

  function saveSettings(event) {
    event.preventDefault();
    const value = clampTopK(Number(topK));
    localStorage.setItem(TOP_K_KEY, String(value));
    setTopK(String(value));
    setMessage("Configuracoes salvas.");
  }

  async function loadRagStats() {
    setStatsLoading(true);
    setStatsError("");
    try {
      const { data } = await api.get("/api/rag/stats");
      setRagStats(data);
    } catch (error) {
      setStatsError(error?.response?.data?.error || error?.message || "Falha ao carregar diagnostico do RAG.");
    } finally {
      setStatsLoading(false);
    }
  }

  return (
    <section>
      <header className="page-header">
        <h2>Configuracao</h2>
      </header>

      <div className="settings-grid">
        <article className="card">
          <h3>Preferencias da IA</h3>
          <form onSubmit={saveSettings} className="settings-form">
            <label>
              Limite de Precisao (Top K)
              <input
                type="number"
                min="1"
                max="10"
                value={topK}
                onChange={(e) => {
                  setTopK(e.target.value);
                  setMessage("");
                }}
              />
              <span className="stat-label">Define quantos trechos de documento a inteligencia deve ler.</span>
            </label>
            <button type="submit">Salvar Definicoes</button>
          </form>
          {message && <p className="success" style={{ marginTop: "1rem" }}>{message}</p>}
        </article>

        <article className="card">
          <h3>Central de Administracao</h3>
          <div className="settings-links">
            <Link to="/dashboard">Dashboard Geral</Link>
            <Link to="/add">Novo Conhecimento</Link>
            <Link to="/upload-audio">Transcricao de Audio (Whisper)</Link>
            <Link to="/upload-manual">Upload de Manual (.md/.txt)</Link>
            <Link to="/upload-sql">Mapear Schema SQL</Link>
          </div>
        </article>

        <article className="card full-span">
          <div className="settings-card-head">
            <div>
              <h3>Diagnostico do RAG</h3>
              <span className="stat-label">Estado atual do cache e da janela de contexto do backend.</span>
            </div>
            <button type="button" className="secondary" onClick={loadRagStats} disabled={statsLoading}>
              {statsLoading ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          {statsError && <p className="error">{statsError}</p>}

          {ragStats && (
            <div className="settings-stats-grid">
              <div className="settings-stat-box">
                <strong>{ragStats.cache?.size ?? 0}</strong>
                <span>Entradas em cache</span>
              </div>
              <div className="settings-stat-box">
                <strong>{Math.round((ragStats.cache?.ttl_ms ?? 0) / 1000)}s</strong>
                <span>TTL do cache</span>
              </div>
              <div className="settings-stat-box">
                <strong>{ragStats.cache?.max_items ?? 0}</strong>
                <span>Limite do cache</span>
              </div>
              <div className="settings-stat-box">
                <strong>{ragStats.config?.available_context_tokens ?? 0}</strong>
                <span>Tokens de contexto</span>
              </div>
              <div className="settings-stat-box">
                <strong>{ragStats.config?.max_context_documents ?? 0}</strong>
                <span>Documentos por resposta</span>
              </div>
              <div className="settings-stat-box">
                <strong>{ragStats.config?.max_chunks_per_source ?? 0}</strong>
                <span>Chunks por fonte</span>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function clampTopK(value) {
  if (!Number.isFinite(value)) return 6;
  if (value < 1) return 1;
  if (value > 10) return 10;
  return Math.round(value);
}
