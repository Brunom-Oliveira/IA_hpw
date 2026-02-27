import { describe, expect, it } from "vitest";
import { RagService } from "../src/services/ragService";
import { VectorDbPort } from "../src/types";

const fakeEmbedding = {
  embed: async (_text: string) => [0.1, 0.2, 0.3],
  embedBatch: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
};

describe("RagService", () => {
  it("inserta e consulta contexto vetorial", async () => {
    const memory: { ids: string[]; docs: string[] } = { ids: [], docs: [] };
    const db: VectorDbPort = {
      upsert: async (documents) => {
        memory.ids = documents.map((doc) => doc.id);
        memory.docs = documents.map((doc) => doc.text);
      },
      search: async () =>
        memory.docs.map((text, index) => ({
          id: memory.ids[index],
          text,
          distance: 0.01,
          metadata: {},
        })),
    };

    const service = new RagService(db, fakeEmbedding as any);
    await service.insertDocuments([{ text: "Documento de teste" }]);
    const result = await service.searchContext("teste", 2);
    expect(result.length).toBe(1);
    expect(result[0].text).toContain("teste");
  });
});

