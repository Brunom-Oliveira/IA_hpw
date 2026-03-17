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

export interface QueryAnalysis {
  mode: "schema" | "troubleshooting" | "procedure" | "general";
  tableHints: string[];
  terms: string[];
  originalQuestion: string;
  expandedQuestion?: string;
  normalizedQuestion: string;
}

export interface VectorDbPort {
  upsert(documents: DocumentChunk[], embeddings: number[][]): Promise<void>;
  search(queryEmbedding: number[], topK: number, collection?: string): Promise<SearchResult[]>;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  executionTimeMs: number;
}

export interface RagResponse {
  answer: string;
  context: string;
  matches: number;
  usage: LlmUsage;
  sources?: Array<{ title: string; category: string }>;
}

export interface LlmStreamChunk {
  content: string;
  done: boolean;
  usage?: LlmUsage;
}

export interface LlmPort {
  generate(prompt: string, options?: { temperature?: number }): Promise<{ response: string; usage: LlmUsage }>;
  generateStream(
    prompt: string,
    onToken: (chunk: LlmStreamChunk) => void,
    options?: { temperature?: number; signal?: AbortSignal }
  ): Promise<void>;
}
