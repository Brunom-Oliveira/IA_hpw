import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

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
    if (!trimmed) return;

    setLoading(true);
    setError("");

    const userMessage = {
      id: `${Date.now()}-q`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      const response = await api.post("/rag/ask", {
        question: trimmed,
        topK: Number(topK),
      });

      const data = response.data || {};
      const assistantMessage = {
        id: `${Date.now()}-a`,
        role: "assistant",
        text: data.answer || "Sem resposta do modelo.",
        context: data.context || "",
        usage: data.usage || null,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err?.response?.data?.error || "Falha ao consultar o RAG.");
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError("");
  }

  return (
    <section>
      <header className="page-header">
        <h2>Perguntas RAG</h2>
        <button onClick={clearChat}>Limpar conversa</button>
      </header>

      <div className="chat-box">
        {!messages.length && <p className="chat-empty">Pergunte sobre os documentos e schemas indexados.</p>}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`chat-message ${message.role === "assistant" ? "assistant" : "user"}`}
          >
            <h4>{message.role === "assistant" ? "Assistente" : "Voce"}</h4>
            <p>{message.text}</p>
            {message.role === "assistant" && message.context ? (
              <details>
                <summary>Ver contexto usado</summary>
                <pre>{message.context}</pre>
              </details>
            ) : null}
            {message.role === "assistant" && message.usage ? (
              <small>
                tokens: {message.usage.total_tokens ?? "-"} | tempo: {message.usage.execution_time_ms ?? "-"} ms
              </small>
            ) : null}
          </article>
        ))}
      </div>

      <form className="chat-form" onSubmit={handleAsk}>
        <p className="chat-meta">
          Top K atual: <strong>{topK}</strong> · alterar em <Link to="/settings">Configuracao</Link>
        </p>
        <label>
          Pergunta
          <textarea
            rows={4}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex.: Quais constraints importantes da tabela MERCADORIA_461?"
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Consultando..." : "Perguntar"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}
    </section>
  );
}
