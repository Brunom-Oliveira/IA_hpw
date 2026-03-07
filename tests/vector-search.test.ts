import { describe, expect, it, vi } from "vitest";
import { RagService } from "../src/services/ragService";
import { LlmPort, VectorDbPort } from "../src/types";

const fakeUsage = {
  promptTokens: 10,
  completionTokens: 5,
  totalTokens: 15,
  executionTimeMs: 20,
};

const fakeEmbeddingService = {
  embed: vi.fn(async (_text: string) => [0.1, 0.2, 0.3]),
  embedBatch: vi.fn(async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3])),
};

const fakeLlm: LlmPort = {
  generate: vi.fn(async (prompt: string) => ({
    response: `Resposta sintetizada para prompt com ${prompt.length} caracteres`,
    usage: fakeUsage,
  })),
  generateStream: vi.fn(async () => undefined),
};

describe("RagService", () => {
  it("insere documentos com embeddings gerados em lote", async () => {
    const upsert = vi.fn(async () => undefined);
    const vectorDb: VectorDbPort = {
      upsert,
      search: vi.fn(async () => []),
    };

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm);
    const ids = await service.insertDocuments([
      { text: "Documento A", metadata: { category: "manual" } },
      { text: "Documento B", metadata: { category: "schema" } },
    ]);

    expect(ids).toHaveLength(2);
    expect(fakeEmbeddingService.embedBatch).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("filtra contexto estritamente pela tabela solicitada", async () => {
    const vectorDb: VectorDbPort = {
      upsert: vi.fn(async () => undefined),
      search: vi.fn(async () => [
        {
          id: "schema-479",
          text: "Tabela: MERC_INVOL_479\nCampo: MERC_PF_479",
          distance: 0.01,
          metadata: {
            title: "Estrutura da tabela MERC_INVOL_479",
            source: "MERC_INVOL_479.SQL",
          },
        },
        {
          id: "schema-461",
          text: "Tabela: MERCADORIA_461\nCampo principal: MERC_PK_461",
          distance: 0.02,
          metadata: {
            title: "Estrutura da tabela MERCADORIA_461",
            source: "MERCADORIA_461.SQL",
          },
        },
      ]),
    };

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm);
    const result = await service.ask("qual e o campo de mercadoria da tabela 461", 2);

    expect(result.context).toContain("MERCADORIA_461");
    expect(result.context).not.toContain("MERC_INVOL_479");
    expect(result.sources).toEqual([
      {
        title: "Estrutura da tabela MERCADORIA_461",
        category: "Geral",
      },
    ]);
    expect(result.matches).toBe(1);
  });
});
