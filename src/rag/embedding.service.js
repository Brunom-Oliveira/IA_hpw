const axios = require("axios");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";
const VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE || 768);

class EmbeddingService {
  async generateEmbedding(text) {
    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await axios.post(
          `${OLLAMA_BASE_URL}/api/embeddings`,
          {
            model: EMBEDDING_MODEL,
            prompt: text,
          },
          {
            timeout: 120000,
          },
        );

        const embedding = response.data && response.data.embedding;
        if (!Array.isArray(embedding) || embedding.length === 0) {
          throw new Error("Embedding invalido retornado pelo Ollama");
        }

        return this.normalizeVector(embedding);
      } catch (error) {
        const isRetryable =
          error.code === "ECONNRESET" ||
          error.code === "ECONNREFUSED" ||
          /socket hang up/i.test(String(error.message || ""));

        if (attempt < maxAttempts && isRetryable) {
          await new Promise((resolve) => setTimeout(resolve, 700));
          continue;
        }

        console.error("[rag][embedding] Erro ao gerar embedding:", error.message);
        throw error;
      }
    }
  }

  normalizeVector(vector) {
    if (vector.length === VECTOR_SIZE) return vector;
    if (vector.length > VECTOR_SIZE) return vector.slice(0, VECTOR_SIZE);

    const missing = VECTOR_SIZE - vector.length;
    return vector.concat(new Array(missing).fill(0));
  }
}

module.exports = { EmbeddingService };
