import axios, { AxiosResponse } from "axios";
import { env } from "../utils/env";
import { buildRagMetadata, extractPrimaryTableName } from "../utils/ragMetadata";
import { ragQueryCache } from "./ragQueryCache";

type QdrantScrollPoint = {
  id: string | number;
  payload?: Record<string, unknown>;
};

type ReindexCollectionResult = {
  collection: string;
  scanned_points: number;
  updated_points: number;
};

type QdrantScrollResult = {
  points?: QdrantScrollPoint[];
  next_page_offset?: string | number | null;
};

type QdrantScrollResponse = {
  result?: QdrantScrollResult | QdrantScrollPoint[];
};

export class RagMetadataReindexService {
  private readonly batchSize = Number(process.env.RAG_REINDEX_BATCH_SIZE || 100);

  async reindexAllCollections(): Promise<{ collections: ReindexCollectionResult[]; total_scanned: number; total_updated: number }> {
    const collections = this.getTargetCollections();
    const results: ReindexCollectionResult[] = [];

    for (const collection of collections) {
      const result = await this.reindexCollection(collection);
      results.push(result);
    }

    ragQueryCache.clear();

    return {
      collections: results,
      total_scanned: results.reduce((sum, item) => sum + item.scanned_points, 0),
      total_updated: results.reduce((sum, item) => sum + item.updated_points, 0),
    };
  }

  private async reindexCollection(collection: string): Promise<ReindexCollectionResult> {
    let offset: string | number | null = null;
    let scannedPoints = 0;
    let updatedPoints = 0;

    while (true) {
      const response: AxiosResponse<QdrantScrollResponse> = await axios.post(`${env.qdrantUrl}/collections/${collection}/points/scroll`, {
        with_payload: true,
        with_vector: false,
        limit: this.batchSize,
        offset: offset || undefined,
      });

      const result: QdrantScrollResult | QdrantScrollPoint[] | undefined = response.data?.result;
      const points = this.extractPoints(result);
      if (!points.length) break;

      scannedPoints += points.length;

      const updates = points
        .map((point) => ({
          id: point.id,
          payload: this.buildEnrichedPayload(point.payload || {}),
        }))
        .filter((item) => item.payload !== null) as Array<{ id: string | number; payload: Record<string, unknown> }>;

      if (updates.length) {
        await Promise.all(
          updates.map((item) =>
            axios.post(`${env.qdrantUrl}/collections/${collection}/points/payload`, {
              payload: item.payload,
              points: [item.id],
            })
          )
        );
        updatedPoints += updates.length;
      }

      offset = this.extractNextOffset(result);
      if (!offset) break;
    }

    return {
      collection,
      scanned_points: scannedPoints,
      updated_points: updatedPoints,
    };
  }

  private buildEnrichedPayload(payload: Record<string, unknown>): Record<string, unknown> | null {
    const text = String(payload.text || "").trim();
    const category = String(payload.category || "general").trim();
    const title = String(payload.title || payload.source || payload.file_name || "Documento").trim();
    const source = String(payload.source || payload.file_name || title).trim();
    const system = String(payload.system || "Nao informado").trim();
    const module = String(payload.module || "Nao informado").trim();
    const fileName = String(payload.file_name || source || title).trim();

    if (!text && !title && !source) return null;

    const relatedTables = this.normalizeStringArray(payload.related_tables ?? payload.tables_related);
    const tags = this.normalizeStringArray(payload.tags);
    const explicitTableName = String(payload.table_name || payload.table || relatedTables[0] || extractPrimaryTableName(`${title}\n${source}\n${text}`)).trim();
    const metadata = buildRagMetadata({
      category,
      title,
      source,
      system,
      module,
      fileName,
      text,
      chunk: this.toOptionalNumber(payload.chunk ?? payload.chunk_index),
      totalChunks: this.toOptionalNumber(payload.total_chunks ?? payload.chunks_total),
      tableName: explicitTableName,
      relatedTables,
      tags,
      documentType: typeof payload.document_type === "string" ? payload.document_type : undefined,
      section: typeof payload.section === "string" ? payload.section : undefined,
    });

    return {
      ...payload,
      ...metadata,
      related_tables: payload.related_tables ?? relatedTables,
      tables_related: payload.tables_related ?? relatedTables,
      tags: payload.tags ?? tags,
    };
  }

  private getTargetCollections(): string[] {
    return Array.from(
      new Set([env.qdrantCollection, "schema_documents", "schema_knowledge"].filter(Boolean))
    );
  }

  private extractPoints(result: QdrantScrollResult | QdrantScrollPoint[] | undefined): QdrantScrollPoint[] {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.points)) return result.points;
    return [];
  }

  private extractNextOffset(result: QdrantScrollResult | QdrantScrollPoint[] | undefined): string | number | null {
    if (!result || Array.isArray(result)) return null;
    return result.next_page_offset ?? null;
  }

  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string" && value.trim()) {
      return value.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  private toOptionalNumber(value: unknown): number | undefined {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
