const axios = require("axios");
const crypto = require("crypto");
const { KnowledgeTransformer } = require("./knowledge.transformer");
const { KnowledgeValidator } = require("./knowledge.validator");
const { SchemaParser } = require("../schema/schema.parser");
const { parseDDL } = require("../sql/sqlParser");

const QDRANT_URL = process.env.QDRANT_URL || "http://qdrant:6333";
const COLLECTION_NAME = "knowledge_base";
const VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE || 768);
const DISTANCE = process.env.QDRANT_DISTANCE || "Cosine";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";
const CHAT_MODEL = process.env.LLM_MODEL || "mistral";
const OLLAMA_EMBED_TIMEOUT_MS = Number(process.env.OLLAMA_EMBED_TIMEOUT_MS || 120000);
const OLLAMA_EMBED_RETRIES = Number(process.env.OLLAMA_EMBED_RETRIES || 2);

class KnowledgeService {
  constructor() {
    this.transformer = new KnowledgeTransformer();
    this.validator = new KnowledgeValidator();
    this.schemaParser = new SchemaParser();
    this.collectionReady = false;
  }

  async ensureCollection() {
    if (this.collectionReady) return;

    try {
      await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
      this.collectionReady = true;
      return;
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.error("[knowledge][qdrant] Falha ao verificar colecao:", error.message);
        throw error;
      }
    }

    await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      vectors: {
        size: VECTOR_SIZE,
        distance: DISTANCE,
      },
    });
    this.collectionReady = true;
    console.info("[knowledge][qdrant] Colecao criada:", COLLECTION_NAME);
  }

  async ingestManual(payload) {
    const validation = this.validator.validateManualInput(payload);
    if (!validation.valid) {
      const error = new Error(validation.errors.join("; "));
      error.statusCode = 400;
      throw error;
    }

    const normalized = this.transformer.normalizeInput(payload);
    return this.indexOne(normalized);
  }

  async ingestAudioTranscription(transcription, defaults = {}) {
    if (!transcription || typeof transcription !== "string") {
      const error = new Error("transcription obrigatoria");
      error.statusCode = 400;
      throw error;
    }

    const structured = await this.structureByLlm(transcription, defaults);
    return this.ingestManual(structured);
  }

  async autoProcessAudioTranscription(transcription, defaults = {}, options = {}) {
    if (!transcription || typeof transcription !== "string") {
      const error = new Error("transcription obrigatoria");
      error.statusCode = 400;
      throw error;
    }

    const parsed = await this.extractAudioTicketAndKnowledge(transcription, defaults);
    const shouldSave = Boolean(options.save_to_knowledge);

    if (!shouldSave) {
      return {
        saved: false,
        mantis: parsed.mantis,
        knowledge_item: parsed.knowledge_item,
      };
    }

    const saved = await this.ingestManual(parsed.knowledge_item);
    return {
      saved: true,
      mantis: parsed.mantis,
      knowledge_item: parsed.knowledge_item,
      index_result: saved,
    };
  }

  async ingestSqlContent(sqlText, sourceName = "schema.sql") {
    if (!sqlText || typeof sqlText !== "string") {
      const error = new Error("Conteudo SQL obrigatorio");
      error.statusCode = 400;
      throw error;
    }

    const tableDefs = this.parseSqlWithFallback(sqlText);
    if (!Array.isArray(tableDefs) || tableDefs.length === 0) {
      const error = new Error("Nao foi possivel identificar CREATE TABLE valido no arquivo SQL");
      error.statusCode = 400;
      throw error;
    }

    const indexed = [];
    for (const tableDef of tableDefs) {
      if (!tableDef || !tableDef.table) continue;
      const doc = this.transformer.tableToKnowledgeDocument(tableDef, sourceName);
      const result = await this.indexOne(doc);
      indexed.push({
        table: tableDef.table,
        id: result.id,
      });
    }

    if (indexed.length === 0) {
      const error = new Error("Nenhuma tabela valida encontrada para indexacao");
      error.statusCode = 400;
      throw error;
    }

    return {
      indexed_tables: indexed.map((item) => item.table),
      total: indexed.length,
      items: indexed,
    };
  }

  parseSqlWithFallback(sqlText) {
    try {
      return this.schemaParser.parseSql(sqlText);
    } catch (error) {
      console.warn("[knowledge][sql] Parser principal falhou, usando parser DDL regex:", error.message);
      try {
        const parsed = parseDDL(sqlText);
        const tables = Array.isArray(parsed && parsed.tables) ? parsed.tables : [];
        return tables.map((table) => ({
          table: table.table_name,
          columns: table.columns || [],
          primaryKey: table.primary_key || [],
          check_constraints: table.check_constraints || [],
          foreignKeys: (table.foreign_keys || []).map((fk) => ({
            field: (fk.columns && fk.columns[0]) || "",
            referencedTable: `${fk.references.schema}.${fk.references.table_name}`,
          })),
        }));
      } catch (fallbackError) {
        const invalidError = new Error("Arquivo SQL invalido para parser");
        invalidError.statusCode = 400;
        throw invalidError;
      }
    }
  }

  async indexOne(structuredData) {
    await this.ensureCollection();
    const text = this.transformer.buildStandardText(structuredData);
    const vector = await this.embedText(text);
    const id = this.generateId(structuredData.title || structuredData.category);
    const createdAt = new Date().toISOString();

    const point = {
      id,
      vector,
      payload: {
        category: structuredData.category,
        system: structuredData.system,
        module: structuredData.module,
        tables_related: structuredData.tables_related || [],
        created_at: createdAt,
        title: structuredData.title,
        tags: structuredData.tags || [],
        text,
      },
    };

    await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, { points: [point] });
    console.info(`[knowledge][index] Item indexado: ${point.payload.title}`);

    return { id, payload: point.payload };
  }

  async embedText(text) {
    const maxAttempts = Number.isFinite(OLLAMA_EMBED_RETRIES)
      ? Math.max(1, Math.round(OLLAMA_EMBED_RETRIES))
      : 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await axios.post(
          `${OLLAMA_BASE_URL}/api/embeddings`,
          {
            model: EMBEDDING_MODEL,
            prompt: text,
            keep_alive: "10m",
          },
          {
            timeout: Number.isFinite(OLLAMA_EMBED_TIMEOUT_MS) ? OLLAMA_EMBED_TIMEOUT_MS : 120000,
          },
        );

        const embedding = response.data && response.data.embedding;
        if (!Array.isArray(embedding)) {
          throw new Error("Embedding invalido retornado pelo Ollama");
        }
        return this.normalizeVector(embedding);
      } catch (error) {
        const isRetryable =
          error.code === "ECONNRESET" ||
          error.code === "ECONNREFUSED" ||
          error.code === "ETIMEDOUT" ||
          /socket hang up/i.test(String(error.message || ""));

        if (attempt < maxAttempts && isRetryable) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          continue;
        }

        console.error("[knowledge][embedding] Falha ao gerar embedding:", error.message);
        throw error;
      }
    }
  }

  async structureByLlm(transcription, defaults = {}) {
    const prompt = [
      "Voce e um normalizador tecnico para base de conhecimento.",
      "Converta a transcricao em JSON valido com as chaves:",
      "category, system, module, title, problem, symptoms, cause, solution, tables_related, tags.",
      "Use category=audio_case.",
      "Retorne apenas JSON sem markdown.",
      "",
      `Transcricao: ${transcription}`,
    ].join("\n");

    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: CHAT_MODEL,
      prompt,
      stream: false,
    });

    const raw = response.data && response.data.response ? response.data.response : "{}";
    const parsed = this.tryParseJson(raw);
    return this.transformer.normalizeInput({
      category: "audio_case",
      system: defaults.system || parsed.system || "Nao informado",
      module: defaults.module || parsed.module || "Nao informado",
      title: parsed.title || "Caso derivado de audio",
      problem: parsed.problem || transcription,
      symptoms: parsed.symptoms || [],
      cause: parsed.cause || "",
      solution: parsed.solution || "",
      tables_related: parsed.tables_related || [],
      tags: parsed.tags || ["audio_case"],
    });
  }

  async extractAudioTicketAndKnowledge(transcription, defaults = {}) {
    const prompt = [
      "Voce e um normalizador tecnico para atendimento de suporte.",
      "Retorne JSON valido com as chaves:",
      "mantis_summary, mantis_description, knowledge_item.",
      "knowledge_item deve conter:",
      "category, system, module, title, problem, symptoms, cause, solution, tables_related, tags.",
      "Use category=ticket quando for solicitacao operacional/atendimento.",
      "Use category=audio_case quando nao for ticket de suporte.",
      "mantis_summary deve ter no maximo 120 caracteres.",
      "mantis_description deve ser objetivo e pronto para copiar no MantisBT.",
      "Retorne somente JSON, sem markdown.",
      "",
      `Transcricao: ${transcription}`,
    ].join("\n");

    const response = await axios.post(`${OLLAMA_BASE_URL}/api/generate`, {
      model: CHAT_MODEL,
      prompt,
      stream: false,
    });

    const raw = response.data && response.data.response ? response.data.response : "{}";
    const parsed = this.tryParseJson(raw);

    const knowledgeItem = this.transformer.normalizeInput({
      ...(parsed.knowledge_item || {}),
      category:
        (parsed.knowledge_item && parsed.knowledge_item.category) ||
        parsed.category ||
        "ticket",
      system:
        defaults.system ||
        (parsed.knowledge_item && parsed.knowledge_item.system) ||
        parsed.system ||
        "Nao informado",
      module:
        defaults.module ||
        (parsed.knowledge_item && parsed.knowledge_item.module) ||
        parsed.module ||
        "Nao informado",
      title:
        (parsed.knowledge_item && parsed.knowledge_item.title) ||
        parsed.title ||
        "Caso derivado de audio",
      problem:
        (parsed.knowledge_item && parsed.knowledge_item.problem) ||
        parsed.problem ||
        transcription,
      symptoms:
        (parsed.knowledge_item && parsed.knowledge_item.symptoms) ||
        parsed.symptoms ||
        [],
      cause:
        (parsed.knowledge_item && parsed.knowledge_item.cause) ||
        parsed.cause ||
        "",
      solution:
        (parsed.knowledge_item && parsed.knowledge_item.solution) ||
        parsed.solution ||
        "",
      tables_related:
        (parsed.knowledge_item && parsed.knowledge_item.tables_related) ||
        parsed.tables_related ||
        [],
      tags:
        (parsed.knowledge_item && parsed.knowledge_item.tags) ||
        parsed.tags ||
        ["ticket", "audio"],
    });

    const mantisSummary = this.safeLimit(
      parsed.mantis_summary || knowledgeItem.title || "Solicitacao derivada de audio",
      120
    );
    const mantisDescription = String(
      parsed.mantis_description ||
        [
          `Resumo: ${mantisSummary}`,
          "",
          "Transcricao revisada:",
          transcription,
          "",
          `Causa: ${knowledgeItem.cause || "Nao informado"}`,
          `Solucao/encaminhamento: ${knowledgeItem.solution || "Nao informado"}`,
        ].join("\n")
    ).trim();

    return {
      mantis: {
        summary: mantisSummary,
        description: mantisDescription,
      },
      knowledge_item: knowledgeItem,
    };
  }

  async listItems(category) {
    await this.ensureCollection();
    const response = await axios.post(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      with_payload: true,
      with_vector: false,
      limit: 300,
    });

    const points = this.extractScrollPoints(response.data);
    const items = points.map((point) => ({
      id: point.id,
      ...(point.payload || {}),
    }));

    if (!category) return items;
    return items.filter((item) => item.category === category);
  }

  async getStats() {
    const items = await this.listItems();
    const byCategory = {};

    for (const item of items) {
      const key = item.category || "unknown";
      byCategory[key] = (byCategory[key] || 0) + 1;
    }

    return {
      total: items.length,
      by_category: byCategory,
    };
  }

  extractScrollPoints(data) {
    if (data && data.result && Array.isArray(data.result.points)) {
      return data.result.points;
    }
    if (data && Array.isArray(data.result)) {
      return data.result;
    }
    return [];
  }

  normalizeVector(vector) {
    if (vector.length === VECTOR_SIZE) return vector;
    if (vector.length > VECTOR_SIZE) return vector.slice(0, VECTOR_SIZE);
    return vector.concat(new Array(VECTOR_SIZE - vector.length).fill(0));
  }

  tryParseJson(raw) {
    try {
      const cleaned = String(raw)
        .trim()
        .replace(/^```json/, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
      return JSON.parse(cleaned);
    } catch (error) {
      console.warn("[knowledge][audio] JSON invalido do LLM, usando fallback.");
      return {};
    }
  }

  generateId(seed) {
    return crypto.randomUUID();
  }

  safeLimit(value, max) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
  }
}

module.exports = { KnowledgeService };
