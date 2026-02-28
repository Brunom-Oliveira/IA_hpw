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
        <article className="settings-card">
          <h3>RAG</h3>
          <form onSubmit={saveSettings} className="settings-form">
            <label>
              Top K padrao (chat)
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
            </label>
            <button type="submit">Salvar</button>
          </form>
          {message && <p className="success">{message}</p>}
        </article>

        <article className="settings-card">
          <h3>Administracao</h3>
          <div className="settings-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/add">Inserir Manual</Link>
            <Link to="/upload-audio">Upload Audio</Link>
            <Link to="/upload-sql">Upload SQL</Link>
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
