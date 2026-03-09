import axios from "axios";
import { DocumentChunk, SearchResult, VectorDbPort } from "../../types";
import { env } from "../../utils/env";
import { QdrantIndexService } from "./qdrantIndexService";

type QdrantPoint = {
  id: string | number;
  payload?: Record<string, unknown>;
  score?: number;
  distance?: number;
};

export class QdrantVectorDbService implements VectorDbPort {
  private collectionReady = false;
  private indexService: QdrantIndexService;

  constructor() {
    this.indexService = new QdrantIndexService();
  }

  private get collectionName(): string {
    return env.qdrantCollection;
  }

  private get baseUrl(): string {
    return env.qdrantUrl;
  }

  private async ensureCollection(): Promise<void> {
    if (this.collectionReady) return;

    try {
      await axios.get(`${this.baseUrl}/collections/${this.collectionName}`);
      this.collectionReady = true;
      // Assegurar índices mesmo se collection já existe
      await this.indexService.ensureIndices(this.collectionName);
      return;
    } catch (error: any) {
      if (error?.response?.status !== 404) throw error;
    }

    await axios.put(`${this.baseUrl}/collections/${this.collectionName}`, {
      vectors: {
        size: env.qdrantVectorSize,
        distance: env.qdrantDistance,
      },
    });

    this.collectionReady = true;
    // Criar índices após criar collection
    await this.indexService.ensureIndices(this.collectionName);
  }

  async upsert(documents: DocumentChunk[], embeddings: number[][]): Promise<void> {
    if (!documents.length) return;
    await this.ensureCollection();

    const points = documents.map((doc, index) => ({
      id: doc.id,
      vector: embeddings[index],
      payload: {
        text: doc.text,
        ...(doc.metadata ?? {}),
      },
    }));

    await axios.put(`${this.baseUrl}/collections/${this.collectionName}/points`, { points });
  }

  async search(queryEmbedding: number[], topK: number): Promise<SearchResult[]> {
    await this.ensureCollection();

    const payload = { vector: queryEmbedding, limit: topK, with_payload: true };
    const response = await this.searchWithFallback(payload);
    const points = this.normalizePoints(response?.data?.result);

    return points.map((point) => {
      const payloadData = (point.payload ?? {}) as Record<string, unknown>;
      const { text, ...metadataRest } = payloadData;
      return {
        id: String(point.id),
        text: String(text ?? ""),
        metadata: metadataRest as Record<string, string | number | boolean>,
        distance: Number(point.score ?? point.distance ?? 0),
      };
    });
  }

  private async searchWithFallback(payload: {
    vector: number[];
    limit: number;
    with_payload: boolean;
  }) {
    try {
      return await axios.post(
        `${this.baseUrl}/collections/${this.collectionName}/points/query`,
        { query: payload.vector, limit: payload.limit, with_payload: payload.with_payload },
      );
    } catch (error: any) {
      if (error?.response?.status !== 404) throw error;
      return axios.post(`${this.baseUrl}/collections/${this.collectionName}/points/search`, payload);
    }
  }

  private normalizePoints(result: unknown): QdrantPoint[] {
    if (Array.isArray(result)) return result as QdrantPoint[];
    if (result && typeof result === "object" && Array.isArray((result as { points?: QdrantPoint[] }).points)) {
      return (result as { points: QdrantPoint[] }).points;
    }
    return [];
  }
}
