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
  llmProvider: process.env.LLM_PROVIDER ?? "ollama",
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  llmModel: process.env.LLM_MODEL ?? "llama3.1:8b",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
  chromaUrl: process.env.CHROMA_URL ?? "http://localhost:8000",
  chromaCollection: process.env.CHROMA_COLLECTION ?? "harpia_docs",
  whisperBinPath: process.env.WHISPER_BIN_PATH ?? "whisper-cli",
  whisperModelPath: process.env.WHISPER_MODEL_PATH ?? "./models/ggml-base.bin",
  whisperLanguage: process.env.WHISPER_LANGUAGE ?? "pt",
  chunkSize: toNumber(process.env.CHUNK_SIZE, 800),
  chunkOverlap: toNumber(process.env.CHUNK_OVERLAP, 120),
};

