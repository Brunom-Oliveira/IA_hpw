import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

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
  const chatBoxRef = useRef(null);
  const chatTimeoutMs = Number(import.meta.env.VITE_CHAT_TIMEOUT_MS || 420000);

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

  useEffect(() => {
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages]);

  const resolveChatEndpoint = () => {
    const base = String(import.meta.env.VITE_API_URL || "").trim();
    if (!base || base === "/") return "/api/chat";
    return `${base.replace(/\/$/, "")}/api/chat`;
  };

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), chatTimeoutMs);
      const response = await fetch(resolveChatEndpoint(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          topK: Number(topK),
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      if (!response.ok || !response.body) {
        const rawError = await response.text();
        throw new Error(rawError || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let aggregatedText = "";

      const applyPartialMessage = (patch) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m))
        );
      };

      const handleServerChunk = (payload) => {
        if (!payload || typeof payload !== "object") return;
        if (payload.error) throw new Error(String(payload.error));

        if (typeof payload.context === "string" || Array.isArray(payload.sources)) {
          applyPartialMessage({
            context: typeof payload.context === "string" ? payload.context : "",
            sources: Array.isArray(payload.sources) ? payload.sources : [],
          });
          return;
        }

        if (typeof payload.content === "string" && payload.content.length > 0) {
          aggregatedText += payload.content;
          applyPartialMessage({ text: aggregatedText });
        }

        if (payload.done && payload.usage) {
          applyPartialMessage({
            usage: {
              total_tokens: payload.usage.totalTokens ?? payload.usage.total_tokens ?? 0,
              execution_time_ms:
                payload.usage.executionTimeMs ?? payload.usage.execution_time_ms ?? 0,
            },
          });
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .map((l) => l.trim())
            .find((l) => l.startsWith("data:"));
          if (!line) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          try {
            handleServerChunk(JSON.parse(data));
          } catch (parseErr) {
            // ignore malformed partial chunks
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.text
            ? { ...m, text: "Sem resposta do modelo." }
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
      setError(err?.message || "Falha ao consultar o RAG.");
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
          <div className="chat-box" ref={chatBoxRef}>
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
