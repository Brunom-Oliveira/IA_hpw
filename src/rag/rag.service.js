const axios = require("axios");
const { EmbeddingService } = require("./embedding.service");
const { SearchService } = require("./search.service");
const { buildContext } = require("./contextBuilder");
const { assertPromptFitsWindow } = require("./tokenManager");
const { AVAILABLE_CONTEXT } = require("./rag.constants");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const CHAT_MODEL = process.env.LLM_MODEL || "mistral";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 480000);
const RAG_MAX_OUTPUT_TOKENS = Number(process.env.RAG_MAX_OUTPUT_TOKENS || 220);
const RAG_KEEP_ALIVE = process.env.RAG_KEEP_ALIVE || "5m";
const RAG_NUM_CTX = Number(process.env.RAG_NUM_CTX || 2048);
const RAG_MAX_OUTPUT_TOKENS_LOOKUP = Number(process.env.RAG_MAX_OUTPUT_TOKENS_LOOKUP || 120);

class RagService {
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.searchService = new SearchService();
  }

  buildPrompt(context, question, options = {}) {
    const conciseLookup = Boolean(options.conciseLookup);
    if (conciseLookup) {
      return `Sistema:
Voce e analista tecnico de banco de dados.
Responda de forma objetiva e curta.
Use apenas o contexto.
Se nao houver evidencias, diga que nao encontrou.

Formato obrigatorio da resposta:
- Tabela: <nome ou "Nao identificado">
- Coluna(s): <lista ou "Nao identificado">
- Observacao: <1 frase curta>

Contexto:
${context}

Pergunta:
${question}`;
    }

    return `Sistema:
Voce e especialista tecnico em sistemas corporativos. Responda com objetividade e usando apenas o contexto.
Se nao houver informacao suficiente, diga explicitamente que nao encontrou na base.

Contexto:
${context}

Pergunta:
${question}`;
  }

  async ask(question, requestedTopK) {
    const startedAt = Date.now();

    try {
      if (!question || typeof question !== "string") {
        const error = new Error("Pergunta invalida");
        error.statusCode = 400;
        throw error;
      }

      const conciseLookup = this.isLookupQuestion(question);
      const topK = this.resolveTopK(question, requestedTopK, conciseLookup);
      const questionEmbedding = await this.embeddingService.generateEmbedding(question);
      const hits = await this.searchService.searchByVector(questionEmbedding, topK);
      const filteredHits = this.filterHitsForQuestion(hits, question, conciseLookup);

      // Contexto eh montado sob budget fixo de tokens para evitar overflow no modelo.
      const contextData = buildContext(question, filteredHits);
      if (!contextData.context) {
        return {
          answer: "Nao encontrei informacoes suficientes na base para responder com seguranca.",
          context: "",
          matches: filteredHits.length,
          top_k_used: topK,
          context_meta: {
            token_budget: contextData.tokenBudget,
            used_tokens: contextData.usedTokens,
            selected_docs: contextData.selectedDocs,
            deduped_docs: contextData.dedupedDocs,
          },
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            total_tokens: 0,
            execution_time_ms: Date.now() - startedAt,
          },
        };
      }

      const prompt = this.buildPrompt(contextData.context, question, { conciseLookup });

      const estimatedPromptTokens = assertPromptFitsWindow(prompt);
      // Guard final antes do LLM: bloqueia prompts acima da janela de 4096.
      const maxOutputTokens = conciseLookup
        ? (Number.isFinite(RAG_MAX_OUTPUT_TOKENS_LOOKUP) ? RAG_MAX_OUTPUT_TOKENS_LOOKUP : 120)
        : (Number.isFinite(RAG_MAX_OUTPUT_TOKENS) ? RAG_MAX_OUTPUT_TOKENS : 220);

      const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
        model: CHAT_MODEL,
        prompt,
        stream: false,
        keep_alive: RAG_KEEP_ALIVE,
        options: {
          temperature: 0.1,
          num_predict: maxOutputTokens,
          num_ctx: Number.isFinite(RAG_NUM_CTX) ? Math.max(512, Math.round(RAG_NUM_CTX)) : 2048,
        },
      }, {
        timeout: Number.isFinite(OLLAMA_TIMEOUT_MS) ? OLLAMA_TIMEOUT_MS : 480000,
      });

      const inputTokens = Number(response.data && response.data.prompt_eval_count) || estimatedPromptTokens;
      const outputTokens = Number(response.data && response.data.eval_count) || 0;
      const totalTokens = inputTokens + outputTokens;
      const executionTimeMs = Date.now() - startedAt;

      const usage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_tokens: totalTokens,
        execution_time_ms: executionTimeMs,
      };

      console.info("[rag][llm-usage]", {
        ...usage,
        estimated_prompt_tokens: estimatedPromptTokens,
        context_budget_tokens: AVAILABLE_CONTEXT,
        context_used_tokens: contextData.usedTokens,
        selected_docs: contextData.selectedDocs,
        deduped_docs: contextData.dedupedDocs,
        top_k_used: topK,
        concise_lookup: conciseLookup,
      });

      return {
        answer: (response.data && response.data.response) || "",
        context: contextData.context,
        matches: filteredHits.length,
        top_k_used: topK,
        context_meta: {
          token_budget: contextData.tokenBudget,
          used_tokens: contextData.usedTokens,
          selected_docs: contextData.selectedDocs,
          deduped_docs: contextData.dedupedDocs,
        },
        usage,
      };
    } catch (error) {
      const upstreamStatus = error.response && error.response.status;
      const upstreamBody = error.response && error.response.data;
      const upstreamErrorMessage =
        (upstreamBody && (upstreamBody.error || upstreamBody.message)) || null;

      console.error("[rag][ask] Falha:", {
        message: error.message,
        status: upstreamStatus || null,
        upstream: upstreamBody || null,
      });

      if (upstreamErrorMessage && !error.statusCode) {
        error.statusCode = upstreamStatus || 500;
        error.message = String(upstreamErrorMessage);
      }

      throw error;
    }
  }

  resolveTopK(question, requestedTopK, conciseLookup = false) {
    const parsedTopK = Number(requestedTopK);
    if (Number.isFinite(parsedTopK)) {
      const capped = Math.min(10, Math.max(1, Math.round(parsedTopK)));
      return conciseLookup ? Math.min(2, capped) : capped;
    }

    if (conciseLookup) return 2;
    return this.chooseTopK(question);
  }

  chooseTopK(question) {
    const normalized = String(question || "").toLowerCase();
    const estimatedQuestionTokens = Math.ceil(normalized.length / 4);
    const deepTechnicalHints = ["join", "indice", "index", "foreign key", "transaction", "deadlock", "timeout"];

    if (estimatedQuestionTokens <= 20) return 5;
    if (estimatedQuestionTokens >= 80 || deepTechnicalHints.some((hint) => normalized.includes(hint))) return 10;
    return 8;
  }

  isLookupQuestion(question) {
    const normalized = String(question || "").toLowerCase();
    const hints = [
      "onde fica",
      "qual tabela",
      "qual coluna",
      "em qual tabela",
      "em qual coluna",
      "onde vejo",
      "onde posso ver",
      "embalagem",
      "campo",
    ];
    return hints.some((hint) => normalized.includes(hint));
  }

  filterHitsForQuestion(hits, question, conciseLookup) {
    const safeHits = Array.isArray(hits) ? hits : [];
    if (!conciseLookup || safeHits.length <= 1) return safeHits;

    const tableMatch = String(question || "").match(/tabela\s+([a-z0-9_]+)/i);
    const requestedTable = tableMatch ? String(tableMatch[1] || "").toUpperCase() : "";

    if (requestedTable) {
      const byTable = safeHits.filter((hit) => {
        const text = String((hit && hit.payload && hit.payload.text) || hit.text || "").toUpperCase();
        return text.includes(requestedTable);
      });
      if (byTable.length) return byTable;
    }

    // Em perguntas objetivas, prioriza documentos de schema e elimina ruido.
    const schemaFirst = safeHits.filter((hit) => {
      const category = String(hit && hit.payload && hit.payload.category ? hit.payload.category : "").toLowerCase();
      return category === "schema";
    });

    return schemaFirst.length ? schemaFirst : safeHits;
  }
}

module.exports = { RagService };
