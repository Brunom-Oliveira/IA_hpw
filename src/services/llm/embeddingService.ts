import axios from "axios";
import { env } from "../../utils/env";

export class EmbeddingService {
  async embed(text: string): Promise<number[]> {
    const response = await axios.post(`${env.ollamaBaseUrl}/api/embeddings`, {
      model: env.embeddingModel,
      prompt: text,
    });
    return response.data.embedding;
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

