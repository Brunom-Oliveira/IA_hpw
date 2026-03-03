import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const chatTimeoutMs = Number(import.meta.env.VITE_CHAT_TIMEOUT_MS || 420000);

export default function ChatRag() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);

  const topK = useMemo(() => {
    const saved = Number(localStorage.getItem("rag_top_k") || 6);
    if (!Number.isFinite(saved)) return 6;
    return Math.min(10, Math.max(1, Math.round(saved)));
  }, [messages.length]);

  async function handleAsk(event) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");

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

    try {
      const response = await fetch(`${api.defaults.baseURL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          topK: Number(topK),
          stream: true,
        }),
        signal: AbortSignal.timeout(chatTimeoutMs),
      });

      if (!response.ok) {
        let errorMessage = "Falha na conexao com o servidor.";
        try {
          const payload = await response.json();
          if (payload && payload.error) {
            errorMessage = String(payload.error);
          }
        } catch (_err) {
          // keep default
        }
        throw new Error(errorMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value);
        const lines = chunkText.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));

              if (data.sources) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, sources: data.sources, context: data.context } : m
                  )
                );
              } else if (data.done) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, usage: data.usage } : m))
                );
              } else if (data.content) {
                accumulatedText += data.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, text: accumulatedText } : m))
                );
              } else if (data.error) {
                throw new Error(String(data.error));
              }
            } catch (_e) {
              // ignore partial json chunks
            }
          }
        }
      }
    } catch (err) {
      setError(err.message || "Falha ao consultar o RAG.");
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

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
