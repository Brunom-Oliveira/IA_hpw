import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const TOP_K_KEY = "rag_top_k";

export default function Settings() {
  const [topK, setTopK] = useState("6");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(TOP_K_KEY);
    if (saved) setTopK(saved);
  }, []);

  function saveSettings(event) {
    event.preventDefault();
    const value = clampTopK(Number(topK));
    localStorage.setItem(TOP_K_KEY, String(value));
    setTopK(String(value));
    setMessage("Configuracoes salvas.");
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
