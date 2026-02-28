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

  async ingestSqlContent(sqlText, sourceName = "schema.sql") {
    if (!sqlText || typeof sqlText !== "string") {
      const error = new Error("Conteudo SQL obrigatorio");
      error.statusCode = 400;
      throw error;
    }

    const tableDefs = this.parseSqlWithFallback(sqlText);
    const indexed = [];
    for (const tableDef of tableDefs) {
      const doc = this.transformer.tableToKnowledgeDocument(tableDef, sourceName);
      const result = await this.indexOne(doc);
      indexed.push({
        table: tableDef.table,
        id: result.id,
      });
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
      const parsed = parseDDL(sqlText);
      const tables = Array.isArray(parsed && parsed.tables) ? parsed.tables : [];
      return tables.map((table) => ({
        table: table.table_name,
        columns: table.columns || [],
        primaryKey: table.primary_key || [],
        foreignKeys: (table.foreign_keys || []).map((fk) => ({
          field: (fk.columns && fk.columns[0]) || "",
          referencedTable: `${fk.references.schema}.${fk.references.table_name}`,
        })),
      }));
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
    const response = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
      model: EMBEDDING_MODEL,
      prompt: text,
    });

    const embedding = response.data && response.data.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error("Embedding invalido retornado pelo Ollama");
    }
    return this.normalizeVector(embedding);
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
}

module.exports = { KnowledgeService };
