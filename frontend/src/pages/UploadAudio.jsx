import { useState } from "react";
import api from "../api";

export default function UploadAudio() {
  const [audioFile, setAudioFile] = useState(null);
  const [transcription, setTranscription] = useState("");
  const [system, setSystem] = useState("");
  const [module, setModule] = useState("");
  const [saveToKnowledge, setSaveToKnowledge] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState(null);
  const [mantisSummary, setMantisSummary] = useState("");
  const [mantisDescription, setMantisDescription] = useState("");
  const [knowledgePreview, setKnowledgePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleTranscribe(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setTranscriptionResult(null);
    setMantisSummary("");
    setMantisDescription("");
    setKnowledgePreview(null);

    try {
      if (!audioFile) {
        throw new Error("Selecione um arquivo de audio para transcrever");
      }

      const formData = new FormData();
      formData.append("audio", audioFile);

      const response = await api.post("/api/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: Number(import.meta.env.VITE_AUDIO_TRANSCRIBE_TIMEOUT_MS || 300000),
      });

      const text = response?.data?.text || "";
      if (!text) {
        throw new Error("A transcricao retornou vazia");
      }

      setTranscription(text);
      setTranscriptionResult(response.data);
      const shouldSave = saveToKnowledge
        ? window.confirm("Deseja salvar esta transcricao na base de conhecimento agora?")
        : false;

      const autoResponse = await api.post("/knowledge/auto-audio", {
        transcription: text,
        system,
        module,
        save_to_knowledge: shouldSave,
      });
      const payload = autoResponse.data || {};
      setResult(payload);
      setMantisSummary((payload.mantis && payload.mantis.summary) || "");
      setMantisDescription((payload.mantis && payload.mantis.description) || "");
      setKnowledgePreview(payload.knowledge_item || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Falha ao transcrever audio");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveText(event) {
    event.preventDefault();
    const confirmed = window.confirm("Deseja salvar o texto atual na base de conhecimento?");
    if (!confirmed) return;

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

  async function handleGenerateFromText(saveToKnowledgeFlag = false) {
    if (!transcription.trim()) {
      setError("Informe uma transcricao para gerar o resumo e a versao de base.");
      return;
    }

    let shouldSave = Boolean(saveToKnowledgeFlag);
    if (shouldSave) {
      const confirmed = window.confirm("Deseja salvar esta versao na base de conhecimento?");
      if (!confirmed) return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const autoResponse = await api.post("/knowledge/auto-audio", {
        transcription,
        system,
        module,
        save_to_knowledge: shouldSave,
      });
      const payload = autoResponse.data || {};
      setResult(payload);
      setMantisSummary((payload.mantis && payload.mantis.summary) || "");
      setMantisDescription((payload.mantis && payload.mantis.description) || "");
      setKnowledgePreview(payload.knowledge_item || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Falha ao gerar resumo e versao para base");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h2>Transcricao de Audio (Whisper)</h2>

      <form className="form-grid" onSubmit={handleTranscribe}>
        <label className="full">
          Arquivo de audio
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
            onChange={(e) => {
              setAudioFile(e.target.files?.[0] || null);
              setError("");
              setTranscriptionResult(null);
            }}
          />
          <span className="stat-label">Envie um audio para transcricao automatica via Whisper.</span>
        </label>

        <label>
          Sistema
          <input value={system} onChange={(e) => setSystem(e.target.value)} />
        </label>

        <label>
          Modulo
          <input value={module} onChange={(e) => setModule(e.target.value)} />
        </label>

        <label className="full checkbox-row">
          <input
            type="checkbox"
            checked={saveToKnowledge}
            onChange={(e) => setSaveToKnowledge(e.target.checked)}
          />
          <span>Salvar transcricao na base de conhecimento</span>
        </label>

        <div className="full action-row">
          <button type="submit" disabled={loading || !audioFile}>
            {loading ? "Processando..." : "Transcrever com Whisper"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={loading || !transcription.trim()}
            onClick={handleSaveText}
          >
            {loading ? "Processando..." : "Salvar texto na base"}
          </button>
        </div>

        <p className="full stat-label">
          Se a opcao de salvar estiver ativa, o botao de transcricao ja transcreve e salva.
        </p>
      </form>

      <form className="form-grid" onSubmit={handleSaveText} style={{ marginTop: "1rem" }}>
        <label className="full">
          Transcricao
          <textarea rows={12} value={transcription} onChange={(e) => setTranscription(e.target.value)} />
          <span className="stat-label">Voce pode editar o texto antes de salvar.</span>
        </label>
        <div className="full action-row">
          <button
            type="button"
            className="secondary"
            disabled={loading || !transcription.trim()}
            onClick={() => handleGenerateFromText(false)}
          >
            {loading ? "Processando..." : "Gerar resumo + versao base (sem salvar)"}
          </button>
          <button
            type="button"
            disabled={loading || !transcription.trim()}
            onClick={() => handleGenerateFromText(true)}
          >
            {loading ? "Processando..." : "Gerar e salvar na base"}
          </button>
        </div>
        <button type="submit" disabled={loading || !transcription.trim()}>
          {loading ? "Processando..." : "Estruturar e Salvar"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {transcriptionResult && (
        <div className="result-box">
          <h3>Transcricao concluida</h3>
          <pre>{JSON.stringify(transcriptionResult, null, 2)}</pre>
        </div>
      )}

      {result && (
        <div className="result-box">
          <h3>Resultado automatico</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}

      {(mantisSummary || mantisDescription) && (
        <div className="result-box">
          <h3>Resumo para MantisBT</h3>
          <label>
            Summary
            <textarea rows={2} value={mantisSummary} readOnly />
          </label>
          <label>
            Description
            <textarea rows={8} value={mantisDescription} readOnly />
          </label>
        </div>
      )}

      {knowledgePreview && (
        <div className="result-box">
          <h3>Preview para base de conhecimento</h3>
          <pre>{JSON.stringify(knowledgePreview, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
