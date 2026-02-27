export interface DocumentChunk {
  id: string;
  text: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface SearchResult {
  id: string;
  text: string;
  metadata?: Record<string, string | number | boolean>;
  distance: number;
}

export interface VectorDbPort {
  upsert(documents: DocumentChunk[], embeddings: number[][]): Promise<void>;
  search(queryEmbedding: number[], topK: number): Promise<SearchResult[]>;
}

export interface LlmPort {
  generate(prompt: string, options?: { temperature?: number }): Promise<string>;
}

