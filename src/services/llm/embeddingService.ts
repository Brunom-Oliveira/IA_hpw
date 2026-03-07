import axios from "axios";
import { env } from "../../utils/env";

export class EmbeddingService {
  async embed(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${env.ollamaBaseUrl}/api/embeddings`, {
        model: env.embeddingModel,
        prompt: text,
      }, {
        timeout: env.ollamaEmbedTimeoutMs,
      });
      if (Array.isArray(response.data?.embedding)) return response.data.embedding as number[];
    } catch (error: any) {
      if (!(error?.response?.status === 404)) {
        throw error;
      }
    }

    const response = await this.postEmbedFallback(text);

    if (Array.isArray(response.data?.embedding)) return response.data.embedding as number[];
    if (Array.isArray(response.data?.embeddings) && response.data.embeddings.length) {
      return response.data.embeddings[0] as number[];
    }

    throw new Error("Embedding invalido retornado pelo Ollama");
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const concurrency = Math.max(1, Math.min(env.embeddingBatchConcurrency, texts.length || 1));
    let currentIndex = 0;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = currentIndex++;
        if (index >= texts.length) return;
        results[index] = await this.embed(texts[index]);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    return results;
  }

  private async postEmbedFallback(text: string): Promise<any> {
    let lastError: unknown;
    const attempts = Math.max(1, env.ollamaEmbedRetries + 1);

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await axios.post(`${env.ollamaBaseUrl}/api/embed`, {
          model: env.embeddingModel,
          input: text,
        }, {
          timeout: env.ollamaEmbedTimeoutMs,
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Falha ao gerar embedding no Ollama");
  }
}
