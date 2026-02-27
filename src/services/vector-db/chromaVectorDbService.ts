import { ChromaClient, Collection } from "chromadb";
import { DocumentChunk, SearchResult, VectorDbPort } from "../../types";
import { env } from "../../utils/env";

export class ChromaVectorDbService implements VectorDbPort {
  private readonly client: ChromaClient;
  private collection?: Collection;

  constructor() {
    this.client = new ChromaClient({ path: env.chromaUrl });
  }

  private async getCollection(): Promise<Collection> {
    if (this.collection) return this.collection;

    try {
      // Reutiliza colecao existente para evitar reindexacao desnecessaria.
      this.collection = await this.client.getCollection({ name: env.chromaCollection });
    } catch {
      // Cria automaticamente na primeira execucao.
      this.collection = await this.client.createCollection({
        name: env.chromaCollection,
        metadata: { description: "Colecao para RAG de tickets e documentos" },
      });
    }

    return this.collection;
  }

  async upsert(documents: DocumentChunk[], embeddings: number[][]): Promise<void> {
    const collection = await this.getCollection();

    await collection.upsert({
      ids: documents.map((doc) => doc.id),
      documents: documents.map((doc) => doc.text),
      embeddings,
      metadatas: documents.map((doc) => doc.metadata ?? {}),
    });
  }

  async search(queryEmbedding: number[], topK: number): Promise<SearchResult[]> {
    const collection = await this.getCollection();
    const result = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      include: ["documents", "metadatas", "distances"],
    });

    const ids = result.ids[0] ?? [];
    const docs = result.documents[0] ?? [];
    const metadatas = result.metadatas[0] ?? [];
    const distances = result.distances?.[0] ?? [];

    return ids.map((id, index) => ({
      id,
      text: docs[index] ?? "",
      metadata: (metadatas[index] as Record<string, string | number | boolean>) ?? {},
      distance: distances[index] ?? 0,
    }));
  }
}
