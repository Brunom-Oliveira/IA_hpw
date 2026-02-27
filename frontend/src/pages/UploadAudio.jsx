import { useState } from "react";
import api from "../api";

export default function UploadAudio() {
  const [transcription, setTranscription] = useState("");
  const [system, setSystem] = useState("");
  const [module, setModule] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await api.post("/knowledge/upload-audio", {
        transcription,
        system,
        module,
      });
      setResult(response.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao estruturar transcricao");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Upload Áudio (via transcrição)</h2>
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Sistema
          <input value={system} onChange={(e) => setSystem(e.target.value)} />
        </label>
        <label>
          Módulo
          <input value={module} onChange={(e) => setModule(e.target.value)} />
        </label>
        <label className="full">
          Transcrição
          <textarea rows={12} value={transcription} onChange={(e) => setTranscription(e.target.value)} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Processando..." : "Estruturar e Salvar"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
      {result && (
        <div className="result-box">
          <h3>Item indexado</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}

