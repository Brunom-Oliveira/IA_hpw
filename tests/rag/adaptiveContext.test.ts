import { afterEach, describe, expect, it } from "vitest";
import { RagService } from "../../src/services/ragService";
import { env } from "../../src/utils/env";
import { QueryAnalysisService } from "../../src/services/rag/queryAnalysisService";

const fakeEmbeddingService = {
  embed: async (_text: string) => [0.1, 0.2, 0.3],
  embedBatch: async (texts: string[]) => texts.map(() => [0.1, 0.2, 0.3]),
};

const fakeLlm = {
  generate: async () => ({ response: "ok", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2, executionTimeMs: 1 } }),
  generateStream: async () => undefined,
};

const fakeSemanticCache = {
  find: async () => null,
  add: async () => undefined,
};

const fakeVectorDb = {
  upsert: async () => undefined,
  search: async () => [],
};

describe("RAG adaptive context window", () => {
  const originalCtx = env.ragNumCtx;

  afterEach(() => {
    env.ragNumCtx = originalCtx;
  });

  it("ajusta available_context_tokens de acordo com RAG_NUM_CTX", async () => {
    env.ragNumCtx = 1200;
    const service = new RagService(
      fakeVectorDb as any,
      fakeEmbeddingService as any,
      fakeLlm as any,
      new QueryAnalysisService(),
      fakeSemanticCache as any,
    );

    const diagnostics = service.getDiagnostics();
    expect(diagnostics.config.available_context_tokens).toBeLessThanOrEqual(1200);
    expect(diagnostics.config.available_context_tokens).toBeGreaterThan(500);
  });
});

