import axios from "axios";
import { randomUUID } from "crypto";
import { env } from "../utils/env";
import { EmbeddingService } from "../services/llm/embeddingService";
import { SchemaDocument } from "./ddlTransformer";
import { buildRagMetadata, extractTableSuffix } from "../utils/ragMetadata";

const COLLECTION_NAME = "schema_knowledge";

export function estimateTokens(text: string): number {
  return Math.ceil(String(text || "").length / 4);
}

export function chunkLargeDocument(text: string, maxTokens = 800, overlapTokens = 120): string[] {
  const normalized = String(text || "").trim();
  if (!normalized) return [];

  const words = normalized.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    let end = start;
    let tokenCount = 0;

    while (end < words.length) {
      const projected = tokenCount + estimateTokens(words[end]);
      if (projected > maxTokens) break;
      tokenCount = projected;
      end += 1;
    }

    if (end === start) end = start + 1;
    chunks.push(words.slice(start, end).join(" "));

    const overlapWords = estimateOverlapWords(words, end, overlapTokens);
    start = Math.max(end - overlapWords, start + 1);
  }

  return chunks;
}

export async function indexSchemaDocuments(documents: SchemaDocument[]): Promise<{ indexed_points: number; documents_indexed: number }> {
  const docs = Array.isArray(documents) ? documents : [];
  if (!docs.length) {
    return { indexed_points: 0, documents_indexed: 0 };
  }

  await ensureCollection();
  const createdAt = new Date().toISOString();
  const points = [];
  const embeddingService = new EmbeddingService();

  for (const doc of docs) {
    const tokenCount = estimateTokens(doc.text);
    const chunks = tokenCount > 1500 ? chunkLargeDocument(doc.text, 800, 120) : [doc.text];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const textChunk = chunks[chunkIndex];
      const embedding = await embeddingService.embed(textChunk);
      const vector = normalizeVector(embedding);
      points.push({
        id: randomUUID(),
        vector,
        payload: {
          created_at: createdAt,
          chunk_index: chunkIndex,
          chunks_total: chunks.length,
          text: textChunk,
          schema: doc.schema,
          related_tables: doc.related_tables || [],
          ...buildRagMetadata({
            title: buildSchemaDocumentTitle(doc),
            source: `${doc.table_name}.SQL`,
            category: "schema",
            system: `${doc.table_name}.SQL`,
            module: "schema",
            fileName: `${doc.table_name}.SQL`,
            text: textChunk,
            tableName: doc.table_name,
            relatedTables: doc.related_tables || [],
            documentType: doc.document_type,
            section: mapSectionFromDocumentType(doc.document_type),
          }),
          table_suffix: extractTableSuffix(doc.table_name),
        },
      });
    }
  }

  await axios.put(`${env.qdrantUrl}/collections/${COLLECTION_NAME}/points`, { points });
  console.info(`[schema][indexer] ${points.length} pontos indexados em ${COLLECTION_NAME}`);

  return {
    indexed_points: points.length,
    documents_indexed: docs.length,
  };
}

function estimateOverlapWords(words: string[], end: number, overlapTokens: number): number {
  let tokenCount = 0;
  let count = 0;
  for (let i = end - 1; i >= 0; i -= 1) {
    tokenCount += estimateTokens(words[i]);
    if (tokenCount >= overlapTokens) break;
    count += 1;
  }
  return Math.max(5, count);
}

async function ensureCollection(): Promise<void> {
  try {
    await axios.get(`${env.qdrantUrl}/collections/${COLLECTION_NAME}`);
    return;
  } catch (error: any) {
    if (error?.response?.status !== 404) {
      console.error("[schema][indexer] Falha ao validar colecao:", error?.message);
      throw error;
    }
  }

  await axios.put(`${env.qdrantUrl}/collections/${COLLECTION_NAME}`, {
    vectors: {
      size: env.qdrantVectorSize,
      distance: env.qdrantDistance,
    },
  });
  console.info(`[schema][indexer] Colecao criada: ${COLLECTION_NAME}`);
}

function normalizeVector(vector: number[]): number[] {
  if (vector.length === env.qdrantVectorSize) return vector;
  if (vector.length > env.qdrantVectorSize) return vector.slice(0, env.qdrantVectorSize);
  return vector.concat(new Array(env.qdrantVectorSize - vector.length).fill(0));
}

function buildSchemaDocumentTitle(doc: SchemaDocument): string {
  switch (doc.document_type) {
    case "constraints":
      return `Constraints da tabela ${doc.table_name}`;
    case "triggers":
      return `Triggers da tabela ${doc.table_name}`;
    case "relationships":
      return `Relacionamentos da tabela ${doc.table_name}`;
    default:
      return `Estrutura da tabela ${doc.table_name}`;
  }
}

function mapSectionFromDocumentType(documentType: SchemaDocument["document_type"]): string {
  switch (documentType) {
    case "constraints":
      return "constraints";
    case "triggers":
      return "triggers";
    case "relationships":
      return "relationships";
    default:
      return "schema_overview";
  }
}
