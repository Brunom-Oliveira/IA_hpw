const axios = require("axios");
const { EmbeddingService } = require("./embedding.service");
const { SearchService } = require("./search.service");
const { buildContext } = require("./contextBuilder");
const { assertPromptFitsWindow } = require("./tokenManager");
const { AVAILABLE_CONTEXT } = require("./rag.constants");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const CHAT_MODEL = process.env.LLM_MODEL || "mistral";
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 90000);
const RAG_MAX_OUTPUT_TOKENS = Number(process.env.RAG_MAX_OUTPUT_TOKENS || 120);
const RAG_KEEP_ALIVE = process.env.RAG_KEEP_ALIVE || "5m";
const RAG_NUM_CTX = Number(process.env.RAG_NUM_CTX || 1024);
const RAG_MAX_OUTPUT_TOKENS_LOOKUP = Number(process.env.RAG_MAX_OUTPUT_TOKENS_LOOKUP || 90);
const RAG_TOPK_DEFAULT = Number(process.env.RAG_TOPK_DEFAULT || 2);
const RAG_TOPK_MAX = Number(process.env.RAG_TOPK_MAX || 3);
const RAG_MIN_SCORE = Number(process.env.RAG_MIN_SCORE || 0.15);
const RAG_CACHE_TTL_MS = Number(process.env.RAG_CACHE_TTL_MS || 900000);
const RAG_CACHE_MAX_ITEMS = Number(process.env.RAG_CACHE_MAX_ITEMS || 300);

class RagService {
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.searchService = new SearchService();
    this.answerCache = new Map();
  }

  buildPrompt(context, question, options = {}) {
    const conciseLookup = Boolean(options.conciseLookup);
    if (conciseLookup) {
      return `Sistema:
Voce e analista tecnico de banco de dados.
Responda de forma objetiva e curta.
Use apenas o contexto.
Se nao houver evidencias, responda exatamente: Nao encontrei no contexto.
Nao invente tabela, coluna ou constraint.

Formato obrigatorio da resposta:
- Tabela: <nome ou "Nao identificado">
- Coluna(s): <lista ou "Nao identificado">
- Observacao: <1 frase curta e direta>

Contexto:
${context}

Pergunta:
${question}`;
    }

    return `Sistema:
Voce e especialista tecnico em sistemas corporativos. Responda com objetividade e usando apenas o contexto.
Se nao houver informacao suficiente, responda exatamente: Nao encontrei no contexto.
Nao inclua explicacoes longas. Limite a resposta em no maximo 5 linhas.

Contexto:
${context}

Pergunta:
${question}`;
  }

  async ask(question, requestedTopK) {
    const startedAt = Date.now();

    try {
      if (!question || typeof question !== "string" || !question.trim()) {
        const error = new Error("Pergunta invalida");
        error.statusCode = 400;
        throw error;
      }

      const normalizedQuestion = question.trim();
      const conciseLookup = this.isLookupQuestion(normalizedQuestion);
      const topK = this.resolveTopK(normalizedQuestion, requestedTopK, conciseLookup);
      const cacheKey = this.buildCacheKey(normalizedQuestion, topK, conciseLookup);
      const cached = this.getCachedAnswer(cacheKey);
      if (cached) {
        return {
          ...cached,
          cache_hit: true,
        };
      }

      const questionEmbedding = await this.embeddingService.generateEmbedding(normalizedQuestion);
      const hits = await this.searchService.searchByVector(questionEmbedding, topK);
      const filteredHits = this.filterHitsForQuestion(hits, normalizedQuestion, conciseLookup);

      // Contexto eh montado sob budget fixo de tokens para evitar overflow no modelo.
      const contextData = buildContext(normalizedQuestion, filteredHits);
      if (!contextData.context) {
        const fallback = {
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
        this.setCachedAnswer(cacheKey, fallback);
        return fallback;
      }

      const deterministicAnswer = this.tryDeterministicSchemaAnswer(normalizedQuestion, contextData.context);
      if (deterministicAnswer) {
        const deterministic = {
          answer: deterministicAnswer,
          context: contextData.context,
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
        this.setCachedAnswer(cacheKey, deterministic);
        return deterministic;
      }

      const prompt = this.buildPrompt(contextData.context, normalizedQuestion, { conciseLookup });

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

      const result = {
        answer: this.normalizeAnswer((response.data && response.data.response) || "", conciseLookup),
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

      this.setCachedAnswer(cacheKey, result);
      return result;
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
      const capped = Math.min(RAG_TOPK_MAX, Math.max(1, Math.round(parsedTopK)));
      return conciseLookup ? Math.min(2, capped) : capped;
    }

    if (conciseLookup) return Math.min(2, RAG_TOPK_DEFAULT);
    return this.chooseTopK(question);
  }

  chooseTopK(question) {
    const normalized = String(question || "").toLowerCase();
    const estimatedQuestionTokens = Math.ceil(normalized.length / 4);
    const deepTechnicalHints = ["join", "indice", "index", "foreign key", "transaction", "deadlock", "timeout", "check constraint"];

    if (estimatedQuestionTokens <= 20) return Math.min(2, RAG_TOPK_MAX);
    if (estimatedQuestionTokens >= 80 || deepTechnicalHints.some((hint) => normalized.includes(hint))) return Math.min(3, RAG_TOPK_MAX);
    return Math.min(Math.max(2, RAG_TOPK_DEFAULT), RAG_TOPK_MAX);
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
      "check constraint",
      "restricao",
    ];
    return hints.some((hint) => normalized.includes(hint));
  }

  filterHitsForQuestion(hits, question, conciseLookup) {
    const safeHits = (Array.isArray(hits) ? hits : [])
      .filter((hit) => this.isHitAboveThreshold(hit))
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    if (!safeHits.length) return [];
    if (!conciseLookup || safeHits.length <= 1) return safeHits.slice(0, RAG_TOPK_MAX);

    const tableMatch = String(question || "").match(/tabela\s+([a-z0-9_]+)/i);
    const requestedTable = tableMatch ? String(tableMatch[1] || "").toUpperCase() : "";

    if (requestedTable) {
      const byTable = safeHits.filter((hit) => {
        const text = String((hit && hit.payload && hit.payload.text) || hit.text || "").toUpperCase();
        return text.includes(requestedTable);
      });
      if (byTable.length) return byTable.slice(0, RAG_TOPK_MAX);
    }

    const isCheckQuestion = this.isCheckConstraintQuestion(question);
    if (isCheckQuestion) {
      const checkOnly = safeHits.filter((hit) => {
        const text = String((hit && hit.payload && hit.payload.text) || hit.text || "").toLowerCase();
        return text.includes("check");
      });
      if (checkOnly.length) return checkOnly.slice(0, RAG_TOPK_MAX);
    }

    // Em perguntas objetivas, prioriza documentos de schema.
    const schemaFirst = safeHits.filter((hit) => {
      const category = String(hit && hit.payload && hit.payload.category ? hit.payload.category : "").toLowerCase();
      return category === "schema";
    });

    return schemaFirst.length ? schemaFirst.slice(0, RAG_TOPK_MAX) : safeHits.slice(0, RAG_TOPK_MAX);
  }

  isHitAboveThreshold(hit) {
    const score = Number(hit && hit.score);
    if (!Number.isFinite(score)) return true;
    return score >= RAG_MIN_SCORE;
  }

  isCheckConstraintQuestion(question) {
    const normalized = String(question || "").toLowerCase();
    return normalized.includes("check constraint")
      || normalized.includes("check constraints")
      || normalized.includes("restricao check")
      || normalized.includes("restricoes check");
  }

  tryDeterministicSchemaAnswer(question, context) {
    if (!this.isCheckConstraintQuestion(question)) return "";

    const normalizedContext = String(context || "");
    if (!normalizedContext.trim()) return "";

    const requestedTable = this.extractRequestedTable(question);
    const constraints = this.extractCheckConstraints(normalizedContext, requestedTable);

    if (!constraints.length) {
      if (requestedTable) return `Nao encontrei CHECK constraints da tabela ${requestedTable} no contexto.`;
      return "Nao encontrei CHECK constraints no contexto.";
    }

    const header = requestedTable
      ? `CHECK constraints da tabela ${requestedTable}:`
      : "CHECK constraints encontradas no contexto:";

    return `${header}\n${constraints.map((item) => `- ${item}`).join("\n")}`;
  }

  extractRequestedTable(question) {
    const tableMatch = String(question || "").match(/tabela\s+([a-z0-9_]+)/i);
    if (tableMatch && tableMatch[1]) return String(tableMatch[1]).toUpperCase();

    const fallback = String(question || "").match(/\b[A-Z]{2,}[A-Z0-9_]*_[0-9]{2,}\b/);
    return fallback && fallback[0] ? String(fallback[0]).toUpperCase() : "";
  }

  extractCheckConstraints(context, requestedTable) {
    const results = [];
    const seen = new Set();

    const patterns = [
      /CONSTRAINT\s+([A-Z0-9_$#]+)\s+CHECK\s*\(([^)]+)\)/gi,
      /\b(ECC[_A-Z0-9$#]+)\s*CHECK\s*\(([^)]+)\)/gi,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(context)) !== null) {
        const name = String(match[1] || "").trim();
        const expression = String(match[2] || "").replace(/\s+/g, " ").trim();
        if (!name || !expression) continue;

        if (requestedTable && !expression.toUpperCase().includes(requestedTable)) {
          continue;
        }

        const key = `${name}|${expression}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(`${name}: CHECK (${expression})`);
      }
    });

    return results.slice(0, 12);
  }

  normalizeAnswer(answer, conciseLookup) {
    const value = String(answer || "").trim();
    if (!value) return "Nao encontrei no contexto.";
    if (!conciseLookup) return value;

    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) return "Nao encontrei no contexto.";
    return lines.slice(0, 5).join("\n");
  }

  buildCacheKey(question, topK, conciseLookup) {
    return `${String(question || "").toLowerCase().trim()}|${topK}|${conciseLookup ? 1 : 0}`;
  }

  getCachedAnswer(key) {
    const value = this.answerCache.get(key);
    if (!value) return null;

    if (Date.now() > value.expiresAt) {
      this.answerCache.delete(key);
      return null;
    }

    return value.data;
  }

  setCachedAnswer(key, data) {
    if (!data) return;

    if (this.answerCache.size >= RAG_CACHE_MAX_ITEMS) {
      const firstKey = this.answerCache.keys().next().value;
      if (firstKey) this.answerCache.delete(firstKey);
    }

    this.answerCache.set(key, {
      expiresAt: Date.now() + RAG_CACHE_TTL_MS,
      data,
    });
  }
}

module.exports = { RagService };
