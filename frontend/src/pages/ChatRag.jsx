import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const chatTimeoutMs = Number(import.meta.env.VITE_CHAT_TIMEOUT_MS || 420000);

export default function ChatRag() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState({
    phase: "",
    startedAt: 0,
    elapsedMs: 0,
  });

  const topK = useMemo(() => {
    const saved = Number(localStorage.getItem("rag_top_k") || 6);
    if (!Number.isFinite(saved)) return 6;
    return Math.min(10, Math.max(1, Math.round(saved)));
  }, [messages.length]);

  useEffect(() => {
    if (!loading || !status.startedAt) return;

    const timer = setInterval(() => {
      setStatus((prev) => ({
        ...prev,
        elapsedMs: Date.now() - prev.startedAt,
      }));
    }, 400);

    return () => clearInterval(timer);
  }, [loading, status.startedAt]);

  async function handleAsk(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const startedAt = Date.now();
    setLoading(true);
    setError("");
    setStatus({
      phase: "Iniciando consulta...",
      startedAt,
      elapsedMs: 0,
    });

    const userMessage = {
      id: `${Date.now()}-q`,
      role: "user",
      text: trimmed,
    };

    const assistantId = `${Date.now()}-a`;
    const assistantMessage = {
      id: assistantId,
      role: "assistant",
      text: "",
      context: "",
      usage: null,
      sources: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setQuestion("");

    const phaseTimers = [
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, phase: "Buscando contexto na base..." }));
      }, 500),
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, phase: "Ranqueando trechos relevantes..." }));
      }, 2200),
      setTimeout(() => {
        setStatus((prev) => ({ ...prev, phase: "Gerando resposta tecnica..." }));
      }, 5200),
    ];

    try {
      const response = await api.post(
        "/rag/ask",
        {
          question: trimmed,
          topK: Number(topK),
        },
        {
          timeout: chatTimeoutMs,
        }
      );

      const payload = response?.data || {};
      const answer = typeof payload.answer === "string" ? payload.answer : "";
      const context = typeof payload.context === "string" ? payload.context : "";
      const usageRaw = payload.usage || {};
      const sources = Array.isArray(payload.sources) ? payload.sources : [];

      const usage = usageRaw
        ? {
            total_tokens: usageRaw.total_tokens ?? usageRaw.totalTokens ?? 0,
            execution_time_ms: usageRaw.execution_time_ms ?? usageRaw.executionTimeMs ?? 0,
          }
        : null;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                text: answer || "Sem resposta do modelo.",
                context,
                sources,
                usage,
              }
            : m
        )
      );
      setStatus((prev) => ({ ...prev, phase: "Resposta pronta." }));
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, text: "Falha ao gerar resposta." } : m
        )
      );
      setError(err?.response?.data?.error || err.message || "Falha ao consultar o RAG.");
      setStatus((prev) => ({ ...prev, phase: "Falha ao consultar o servidor." }));
    } finally {
      phaseTimers.forEach((id) => clearTimeout(id));
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError("");
    setStatus({ phase: "", startedAt: 0, elapsedMs: 0 });
  }

  const elapsedSeconds = Math.floor(status.elapsedMs / 1000);

  return (
    <section className="chat-view">
      <header className="page-header">
        <h2>Perguntas Assistente</h2>
        <button onClick={clearChat} className="secondary">Limpar conversa</button>
      </header>

      <div className="chat-container">
        <div className="chat-box">
          {!messages.length && (
            <div className="chat-empty">
              <h3>Como posso ajudar hoje?</h3>
              <p>Pergunte sobre logistica, schemas SQL ou manuais do HarpiaWMS.</p>
            </div>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`chat-message ${message.role === "assistant" ? "assistant" : "user"}`}
            >
              <h4>{message.role === "assistant" ? "Harpia AI" : "Voce"}</h4>
              <p>{message.text || (message.role === "assistant" ? "..." : "")}</p>

              {message.role === "assistant" && (
                <div className="chat-meta">
                  {message.sources?.length > 0 && (
                    <div className="sources-list">
                      <small>Fontes: </small>
                      {message.sources.map((s, idx) => (
                        <span key={idx} className="source-tag" title={s.category}>
                          {s.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {message.usage && (
                    <span>
                      {message.usage.total_tokens} tokens - {message.usage.execution_time_ms}ms
                    </span>
                  )}
                  {message.context && (
                    <details>
                      <summary>Ver Contexto RAG</summary>
                      <pre className="context-detail">{message.context}</pre>
                    </details>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>

        <form className="chat-form" onSubmit={handleAsk}>
          {loading && (
            <div className="chat-progress" aria-live="polite">
              <div className="chat-progress-head">
                <strong>{status.phase || "Processando..."}</strong>
                <span>{elapsedSeconds}s</span>
              </div>
              <div className="chat-progress-bar">
                <div className="chat-progress-indicator" />
              </div>
            </div>
          )}
          <div className="chat-input-wrapper">
            <textarea
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Digite sua duvida tecnica..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk(e);
                }
              }}
            />
            <button type="submit" disabled={loading}>
              {loading ? "..." : "Enviar"}
            </button>
          </div>
          <p className="chat-hint">
            Top K: <strong>{topK}</strong> - <Link to="/settings">Ajustar nas configuracoes</Link>
          </p>
        </form>
      </div>

      {error && <p className="error-toast">{error}</p>}
    </section>
  );
}
