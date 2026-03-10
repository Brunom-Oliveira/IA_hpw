import dotenv from "dotenv";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: toNumber(process.env.PORT, 3000),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  semanticCacheTtl: toNumber(process.env.SEMANTIC_CACHE_TTL_S, 3600),
  semanticCacheThreshold: toNumber(process.env.SEMANTIC_CACHE_THRESHOLD, 0.95),
  llmProvider: process.env.LLM_PROVIDER ?? "ollama",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaTimeoutMs: toNumber(process.env.OLLAMA_TIMEOUT_MS, 180000),
  ollamaEmbedTimeoutMs: toNumber(process.env.OLLAMA_EMBED_TIMEOUT_MS, 120000),
  ollamaEmbedRetries: toNumber(process.env.OLLAMA_EMBED_RETRIES, 2),
  llmModel: process.env.LLM_MODEL ?? "llama3.1:8b",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
  embeddingBatchConcurrency: toNumber(process.env.EMBEDDING_BATCH_CONCURRENCY, 2),
  ragKeepAlive: process.env.RAG_KEEP_ALIVE ?? "5m",
  ragNumCtx: toNumber(process.env.RAG_NUM_CTX, 1024),
  ragMaxOutputTokens: toNumber(process.env.RAG_MAX_OUTPUT_TOKENS, 160),
  ragCacheMaxItems: toNumber(process.env.RAG_CACHE_MAX_ITEMS, 300),
  ragAdminToken: process.env.RAG_ADMIN_TOKEN ?? "",
  qdrantUrl: process.env.QDRANT_URL ?? "http://qdrant:6333",
  qdrantCollection: process.env.QDRANT_COLLECTION ?? "knowledge_base",
  qdrantVectorSize: toNumber(process.env.QDRANT_VECTOR_SIZE, 768),
  qdrantDistance: process.env.QDRANT_DISTANCE ?? "Cosine",
  chromaUrl: process.env.CHROMA_URL ?? "http://localhost:8000",
  chromaCollection: process.env.CHROMA_COLLECTION ?? "harpia_docs",
  whisperBinPath: process.env.WHISPER_BIN_PATH ?? "whisper-cli",
  whisperModelPath: process.env.WHISPER_MODEL_PATH ?? "./models/ggml-base.bin",
  whisperLanguage: process.env.WHISPER_LANGUAGE ?? "pt",
  chunkSize: toNumber(process.env.CHUNK_SIZE, 800),
  chunkOverlap: toNumber(process.env.CHUNK_OVERLAP, 120),
  ragMaxChunksPerSource: toNumber(process.env.RAG_MAX_CHUNKS_PER_SOURCE, 5),
  ragTopK: toNumber(process.env.RAG_TOP_K, 10),
};
