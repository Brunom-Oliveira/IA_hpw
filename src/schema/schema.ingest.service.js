const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
const { SchemaParser } = require("./schema.parser");
const { SchemaTransformer } = require("./schema.transformer");
const { EmbeddingService } = require("../rag/embedding.service");

const QDRANT_URL = process.env.QDRANT_URL || "http://qdrant:6333";
const COLLECTION_NAME = "schema_documents";
const VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE || 768);
const DISTANCE = process.env.QDRANT_DISTANCE || "Cosine";
const SQL_SCHEMA_PATH = process.env.SCHEMA_SQL_PATH || "./docs/schema.sql";

class SchemaIngestService {
  constructor() {
    this.parser = new SchemaParser();
    this.transformer = new SchemaTransformer();
    this.embeddingService = new EmbeddingService();
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
        console.error("[schema][qdrant] Erro ao verificar colecao:", error.message);
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
    console.info("[schema][qdrant] Colecao criada:", COLLECTION_NAME);
  }

  async loadSqlFile() {
    const absolutePath = path.resolve(process.cwd(), SQL_SCHEMA_PATH);
    try {
      const content = await fs.readFile(absolutePath, "utf-8");
      return { path: absolutePath, content };
    } catch (error) {
      console.error("[schema][ingest] Falha ao ler SQL:", absolutePath);
      throw new Error("Nao foi possivel ler ./docs/schema.sql");
    }
  }

  async upsert(points) {
    await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, { points });
  }

  async ingestFromSqlFile() {
    await this.ensureCollection();
    const sql = await this.loadSqlFile();
    const tables = this.parser.parseSql(sql.content);

    if (!tables.length) {
      return {
        file: sql.path,
        indexed_tables: [],
        total: 0,
      };
    }

    const createdAt = new Date().toISOString();
    const points = [];
    const indexedTables = [];

    for (const tableDef of tables) {
      const semanticText = this.transformer.toSemanticText(tableDef);
      const embedding = await this.embeddingService.generateEmbedding(semanticText);
      const pointId = `${tableDef.table}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

      points.push({
        id: pointId,
        vector: embedding,
        payload: {
          category: "schema",
          table: tableDef.table,
          text: semanticText,
          created_at: createdAt,
        },
      });
      indexedTables.push(tableDef.table);
    }

    await this.upsert(points);
    console.info(`[schema][ingest] ${points.length} tabelas indexadas em ${COLLECTION_NAME}`);

    return {
      file: sql.path,
      indexed_tables: indexedTables,
      total: indexedTables.length,
    };
  }
}

module.exports = { SchemaIngestService };

