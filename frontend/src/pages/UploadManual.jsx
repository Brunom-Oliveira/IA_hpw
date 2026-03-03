import { useState } from "react";
import api from "../api";

const manualTimeoutMs = Number(import.meta.env.VITE_MANUAL_UPLOAD_TIMEOUT_MS || 420000);

export default function UploadManual() {
  const [files, setFiles] = useState([]);
  const [system, setSystem] = useState("HARPIA WMS");
  const [module, setModule] = useState("Recepcao");
  const [title, setTitle] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!files.length) {
      setError("Selecione ao menos um arquivo .md ou .txt");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("system", system);
      formData.append("module", module);
      if (title.trim()) formData.append("title", title.trim());

      const response = await api.post("/api/documents/upload-manual", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: Number.isFinite(manualTimeoutMs) ? manualTimeoutMs : 420000,
      });

      setResult(response.data);
    } catch (err) {
      const apiError = err?.response?.data;
      const itemError = Array.isArray(apiError?.items)
        ? apiError.items.find((item) => item?.status === "error")?.error
        : "";
      setError(apiError?.error || itemError || apiError?.message || "Falha ao indexar manual");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Upload de Manual</h2>
          <p className="page-subtitle">Envie arquivo .md/.txt para indexar no RAG automaticamente.</p>
        </div>
      </header>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label className="full">
          Arquivo manual
          <input
            type="file"
            multiple
            accept=".md,.txt,text/markdown,text/plain"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <span className="stat-label">
            Arquivos selecionados: {files.length}
          </span>
        </label>

        <label>
          Sistema
          <input value={system} onChange={(e) => setSystem(e.target.value)} />
        </label>

        <label>
          Modulo
          <input value={module} onChange={(e) => setModule(e.target.value)} />
        </label>

        <label className="full">
          Titulo (opcional)
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Opcional: titulo unico para todos os arquivos"
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "Indexando..." : "Indexar no RAG"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result-box" style={{ marginTop: "1rem" }}>
          <h3>Manuais indexados</h3>
          <p>Arquivos enviados: {result.total_files || 0}</p>
          <p>Processados: {result.processed_files || 0}</p>
          <p>Com falha: {result.failed_files || 0}</p>
          <p>Chunks: {result.total_chunks || 0}</p>
          <p>Inseridos: {result.inserted || 0}</p>
          {Array.isArray(result.items) && result.items.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <strong>Resultado por arquivo</strong>
              <ul style={{ marginTop: "0.45rem", paddingLeft: "1.2rem" }}>
                {result.items.map((item, index) => (
                  <li key={`${item.file_name || "item"}-${index}`}>
                    {item.file_name || "arquivo"} - {item.status}
                    {item.error ? ` (${item.error})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Ver retorno tecnico</summary>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </section>
  );
}
