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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [copiedField, setCopiedField] = useState("");

  const isBusy = isTranscribing || isGenerating || isSaving;
  const statusLabel = isTranscribing
    ? "Transcrevendo"
    : isGenerating
      ? "Gerando"
      : isSaving
        ? "Salvando"
        : "Pronto";
  const statusClass = isBusy ? "busy" : "idle";

  async function copyText(value, field) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(""), 1600);
    } catch (_err) {
      setError("Nao foi possivel copiar automaticamente.");
    }
  }

  async function handleTranscribe(event) {
    event.preventDefault();
    setActiveAction("transcribe");
    setIsTranscribing(true);
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

      setIsGenerating(true);
      const autoResponse = await api.post("/knowledge/auto-audio", {
        transcription: text,
        system,
        module,
        save_to_knowledge: shouldSave,
      }, {
        timeout: Number(import.meta.env.VITE_AUDIO_AUTO_TIMEOUT_MS || 180000),
      });
      const payload = autoResponse.data || {};
      setResult(payload);
      setMantisSummary((payload.mantis && payload.mantis.summary) || "");
      setMantisDescription((payload.mantis && payload.mantis.description) || "");
      setKnowledgePreview(payload.knowledge_item || null);
      setIsGenerating(false);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Falha ao transcrever audio");
    } finally {
      setIsTranscribing(false);
      setIsGenerating(false);
      setActiveAction(null);
    }
  }

  async function handleSaveText(event) {
    event.preventDefault();
    const confirmed = window.confirm("Deseja salvar o texto atual na base de conhecimento?");
    if (!confirmed) return;

    setActiveAction("saveText");
    setIsSaving(true);
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
      setIsSaving(false);
      setActiveAction(null);
    }
  }

  async function handleGenerateFromText(saveToKnowledgeFlag = false) {
    if (!transcription.trim()) {
      setError("Informe uma transcricao para gerar o resumo e a versao de base.");
      return;
    }

    let shouldSave = Boolean(saveToKnowledgeFlag);
    setActiveAction(shouldSave ? "generateAndSave" : "generateOnly");
    if (shouldSave) {
      const confirmed = window.confirm("Deseja salvar esta versao na base de conhecimento?");
      if (!confirmed) {
        setActiveAction(null);
        return;
      }
    }

    setIsGenerating(true);
    setError("");
    setResult(null);
    try {
      const autoResponse = await api.post("/knowledge/auto-audio", {
        transcription,
        system,
        module,
        save_to_knowledge: shouldSave,
      }, {
        timeout: Number(import.meta.env.VITE_AUDIO_AUTO_TIMEOUT_MS || 180000),
      });
      const payload = autoResponse.data || {};
      setResult(payload);
      setMantisSummary((payload.mantis && payload.mantis.summary) || "");
      setMantisDescription((payload.mantis && payload.mantis.description) || "");
      setKnowledgePreview(payload.knowledge_item || null);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Falha ao gerar resumo e versao para base");
    } finally {
      setIsGenerating(false);
      setActiveAction(null);
    }
  }

  return (
    <section className="audio-page">
      <header className="page-header">
        <div>
          <h2>Transcricao de Audio (Whisper)</h2>
          <p className="page-subtitle">
            Gere automaticamente transcricao, resumo para MantisBT e versao estruturada para pesquisa.
          </p>
        </div>
        <div className={`status-pill ${statusClass}`}>{statusLabel}</div>
      </header>

      <form className="form-grid audio-step" onSubmit={handleTranscribe}>
        <h3 className="full step-title">Etapa 1 - Transcrever audio</h3>
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
          <button type="submit" disabled={isBusy || !audioFile}>
            {activeAction === "transcribe" ? "Transcrevendo..." : "Transcrever com Whisper"}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={isBusy || !transcription.trim()}
            onClick={handleSaveText}
          >
            {activeAction === "saveText" ? "Salvando..." : "Salvar texto na base"}
          </button>
        </div>

        <p className="full stat-label">
          Se a opcao de salvar estiver ativa, o botao de transcricao ja transcreve e salva.
        </p>
      </form>

      <form className="form-grid audio-step" onSubmit={handleSaveText} style={{ marginTop: "1rem" }}>
        <h3 className="full step-title">Etapa 2 - Revisar e gerar saidas</h3>
        <label className="full">
          Transcricao
          <textarea rows={12} value={transcription} onChange={(e) => setTranscription(e.target.value)} />
          <span className="stat-label">Voce pode editar o texto antes de salvar.</span>
        </label>
        <div className="full action-row">
          <button
            type="button"
            className="secondary"
            disabled={isBusy || !transcription.trim()}
            onClick={() => handleGenerateFromText(false)}
          >
            {activeAction === "generateOnly"
              ? "Gerando..."
              : "Gerar resumo + versao base (sem salvar)"}
          </button>
          <button
            type="button"
            disabled={isBusy || !transcription.trim()}
            onClick={() => handleGenerateFromText(true)}
          >
            {activeAction === "generateAndSave" ? "Gerando..." : "Gerar e salvar na base"}
          </button>
        </div>
        <button type="submit" disabled={isBusy || !transcription.trim()}>
          {activeAction === "saveText" ? "Salvando..." : "Salvar transcricao manual na base"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="result-stack">
        {transcriptionResult && (
          <div className="result-box">
            <div className="result-header">
              <h3>Transcricao concluida</h3>
              <span className="badge">Whisper</span>
            </div>
            <p className="stat-label">Texto transcrito pronto para revisao e uso nas etapas seguintes.</p>
            <details>
              <summary>Ver retorno tecnico</summary>
              <pre>{JSON.stringify(transcriptionResult, null, 2)}</pre>
            </details>
          </div>
        )}

        {(mantisSummary || mantisDescription) && (
          <div className="result-box">
            <div className="result-header">
              <h3>Resumo para MantisBT</h3>
              <span className="badge">Pronto para copiar</span>
            </div>
            <label>
              Summary
              <textarea rows={2} value={mantisSummary} readOnly />
            </label>
            <div className="result-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => copyText(mantisSummary, "summary")}
              >
                {copiedField === "summary" ? "Copiado!" : "Copiar Summary"}
              </button>
            </div>
            <label>
              Description
              <textarea rows={8} value={mantisDescription} readOnly />
            </label>
            <div className="result-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => copyText(mantisDescription, "description")}
              >
                {copiedField === "description" ? "Copiado!" : "Copiar Description"}
              </button>
            </div>
          </div>
        )}

        {knowledgePreview && (
          <div className="result-box">
            <div className="result-header">
              <h3>Preview para base de conhecimento</h3>
              <span className="badge">JSON estruturado</span>
            </div>
            <pre>{JSON.stringify(knowledgePreview, null, 2)}</pre>
            <div className="result-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => copyText(JSON.stringify(knowledgePreview, null, 2), "knowledge")}
              >
                {copiedField === "knowledge" ? "Copiado!" : "Copiar JSON"}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="result-box">
            <div className="result-header">
              <h3>Resultado da operacao</h3>
              <span className="badge">{result.saved ? "Salvo" : "Nao salvo"}</span>
            </div>
            <details>
              <summary>Ver detalhes da operacao</summary>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </details>
            <div className="result-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setResult(null);
                  setTranscriptionResult(null);
                  setMantisSummary("");
                  setMantisDescription("");
                  setKnowledgePreview(null);
                }}
              >
                Limpar resultados
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
