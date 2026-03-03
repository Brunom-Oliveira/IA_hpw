import axios from "axios";
import { env } from "../../utils/env";

export class EmbeddingService {
  async embed(text: string): Promise<number[]> {
    try {
      const response = await axios.post(`${env.ollamaBaseUrl}/api/embeddings`, {
        model: env.embeddingModel,
        prompt: text,
      });
      if (Array.isArray(response.data?.embedding)) return response.data.embedding as number[];
    } catch (error: any) {
      if (!(error?.response?.status === 404)) {
        throw error;
      }
    }

    const response = await axios.post(`${env.ollamaBaseUrl}/api/embed`, {
      model: env.embeddingModel,
      input: text,
    });

    if (Array.isArray(response.data?.embedding)) return response.data.embedding as number[];
    if (Array.isArray(response.data?.embeddings) && response.data.embeddings.length) {
      return response.data.embeddings[0] as number[];
    }

    throw new Error("Embedding invalido retornado pelo Ollama");
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      const embedded = await this.embed(text);
      embeddings.push(embedded);
    }
    return embeddings;
  }
}
