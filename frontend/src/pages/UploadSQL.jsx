import { useState } from "react";
import api from "../api";

export default function UploadSQL() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) {
      setError("Selecione um arquivo .sql");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await api.post("/knowledge/upload-sql", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(response.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao processar SQL");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Upload SQL</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Arquivo SQL
          <input type="file" accept=".sql" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Processando..." : "Processar"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result-box">
          <h3>Tabelas detectadas</h3>
          <ul>
            {(result.indexed_tables || []).map((table) => (
              <li key={table}>{table}</li>
            ))}
          </ul>
          <p>Total: {result.total || 0}</p>
        </div>
      )}
    </section>
  );
}

