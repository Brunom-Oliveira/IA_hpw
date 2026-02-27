import { v4 as uuidv4 } from "uuid";
import { DocumentChunk, SearchResult, VectorDbPort } from "../types";
import { EmbeddingService } from "./llm/embeddingService";

export class RagService {
  constructor(
    private readonly vectorDb: VectorDbPort,
    private readonly embeddingService: EmbeddingService
  ) {}

  async insertDocuments(input: Array<{ text: string; metadata?: Record<string, string | number | boolean> }>): Promise<string[]> {
    const documents: DocumentChunk[] = input.map((item) => ({
      id: uuidv4(),
      text: item.text,
      metadata: item.metadata,
    }));

    const embeddings = await this.embeddingService.embedBatch(documents.map((doc) => doc.text));
    await this.vectorDb.upsert(documents, embeddings);
    return documents.map((doc) => doc.id);
  }

  async searchContext(query: string, topK = 4): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    return this.vectorDb.search(queryEmbedding, topK);
  }
}

