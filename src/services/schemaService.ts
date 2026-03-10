import { promises as fs } from "fs";
import path from "path";
import axios from "axios";
import { singleton } from "tsyringe";
import { env } from "../utils/env";
import { EmbeddingService } from "./llm/embeddingService";
import { SchemaTransformer } from "./schemaTransformer";
import { SchemaParser } from "../schema/schemaParser";
import { parseDDL, ParsedSchemaTable as DdlParsedSchemaTable } from "../sql/sqlParser";
import { SchemaDocument, transformDDLToDocuments } from "../sql/ddlTransformer";
import { indexSchemaDocuments } from "../sql/schemaIndexer";
import { buildRagMetadata, extractTableSuffix } from "../utils/ragMetadata";
import { ragQueryCache } from "./ragQueryCache";
import { QdrantIndexService } from "./vector-db/qdrantIndexService";

const SCHEMA_DOCUMENTS_COLLECTION = "schema_documents";
const SCHEMA_SQL_PATH = process.env.SCHEMA_SQL_PATH || "./docs/schema.sql";

@singleton()
export class SchemaService {
  private readonly parser = new SchemaParser();
  private readonly transformer = new SchemaTransformer();
  private readonly indexService = new QdrantIndexService();
  private collectionReady = false;

  constructor(private readonly embeddingService: EmbeddingService) {}

  async ingestFromSqlFile(): Promise<{ file: string; indexed_tables: string[]; total: number }> {
    await this.ensureSchemaDocumentsCollection();
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
    const indexedTables: string[] = [];

    for (const tableDef of tables) {
      const semanticText = this.transformer.toSemanticText(tableDef);
      const embedding = await this.embeddingService.embed(semanticText);
      const normalizedVector = this.normalizeVector(embedding);

      points.push({
        id: `${tableDef.table}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`,
        vector: normalizedVector,
        payload: {
          created_at: createdAt,
          text: semanticText,
          table: tableDef.table,
          ...buildRagMetadata({
            category: "schema",
            title: `Estrutura da tabela ${tableDef.table}`,
            source: path.basename(sql.path),
            system: path.basename(sql.path),
            module: "schema",
            fileName: path.basename(sql.path),
            text: semanticText,
            tableName: tableDef.table,
            relatedTables: (tableDef.foreignKeys || []).map((fk) => fk.referencedTable),
            documentType: "schema_table",
          }),
          table_suffix: extractTableSuffix(tableDef.table),
        },
      });
      indexedTables.push(tableDef.table);
    }

    await axios.put(`${env.qdrantUrl}/collections/${SCHEMA_DOCUMENTS_COLLECTION}/points`, { points });
    ragQueryCache.invalidateByCollections([SCHEMA_DOCUMENTS_COLLECTION]);
    ragQueryCache.invalidateBySourceKeys([path.basename(sql.path)]);

    return {
      file: sql.path,
      indexed_tables: indexedTables,
      total: indexedTables.length,
    };
  }

  async uploadSql(sql: string): Promise<{
    summary: { tables_found: number; documents_generated: number; indexed_points: number };
    tables: Array<{
      schema: string;
      table_name: string;
      columns: number;
      primary_key: string[];
      foreign_keys: number;
      indexes: number;
      triggers: number;
      checks: number;
    }>;
  }> {
    const parsed = parseDDL(sql);
    if (!Array.isArray(parsed.tables) || parsed.tables.length === 0) {
      const error = new Error("Nenhuma tabela CREATE TABLE encontrada no script");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const documents: SchemaDocument[] = transformDDLToDocuments(parsed);
    const indexing = await indexSchemaDocuments(documents);
    ragQueryCache.invalidateByCollections(["schema_knowledge"]);

    return {
      summary: {
        tables_found: parsed.tables.length,
        documents_generated: documents.length,
        indexed_points: Number(indexing.indexed_points || 0),
      },
      tables: parsed.tables.map((table: DdlParsedSchemaTable) => ({
        schema: table.schema,
        table_name: table.table_name,
        columns: Array.isArray(table.columns) ? table.columns.length : 0,
        primary_key: Array.isArray(table.primary_key) ? table.primary_key : [],
        foreign_keys: Array.isArray(table.foreign_keys) ? table.foreign_keys.length : 0,
        indexes: Array.isArray(table.indexes) ? table.indexes.length : 0,
        triggers: Array.isArray(table.triggers) ? table.triggers.length : 0,
        checks: Array.isArray(table.check_constraints) ? table.check_constraints.length : 0,
      })),
    };
  }

  private async ensureSchemaDocumentsCollection(): Promise<void> {
    if (this.collectionReady) return;

    try {
      await axios.get(`${env.qdrantUrl}/collections/${SCHEMA_DOCUMENTS_COLLECTION}`);
      this.collectionReady = true;
      // Assegurar índices mesmo se collection já existe
      await this.indexService.ensureIndices(SCHEMA_DOCUMENTS_COLLECTION);
      return;
    } catch (error: any) {
      if (error?.response?.status !== 404) throw error;
    }

    await axios.put(`${env.qdrantUrl}/collections/${SCHEMA_DOCUMENTS_COLLECTION}`, {
      vectors: {
        size: env.qdrantVectorSize,
        distance: env.qdrantDistance,
      },
    });
    this.collectionReady = true;
    // Criar índices após criar collection
    await this.indexService.ensureIndices(SCHEMA_DOCUMENTS_COLLECTION);
  }

  private async loadSqlFile(): Promise<{ path: string; content: string }> {
    const absolutePath = path.resolve(process.cwd(), SCHEMA_SQL_PATH);
    try {
      const content = await fs.readFile(absolutePath, "utf-8");
      return { path: absolutePath, content };
    } catch {
      throw new Error("Nao foi possivel ler ./docs/schema.sql");
    }
  }

  private normalizeVector(vector: number[]): number[] {
    if (vector.length === env.qdrantVectorSize) return vector;
    if (vector.length > env.qdrantVectorSize) return vector.slice(0, env.qdrantVectorSize);
    return vector.concat(new Array(env.qdrantVectorSize - vector.length).fill(0));
  }
}
