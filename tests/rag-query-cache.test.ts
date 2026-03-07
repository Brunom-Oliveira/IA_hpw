import { describe, expect, it } from "vitest";
import { RagQueryCache } from "../src/services/ragQueryCache";

const sampleResponse = {
  answer: "ok",
  context: "ctx",
  matches: 1,
  usage: {
    promptTokens: 1,
    completionTokens: 1,
    totalTokens: 2,
    executionTimeMs: 1,
  },
  sources: [{ title: "Documento", category: "schema" }],
};

describe("RagQueryCache", () => {
  it("invalida seletivamente por source key", () => {
    const cache = new RagQueryCache();
    cache.set("a", sampleResponse, { sourceKeys: ["DOC_A"], collections: ["knowledge_base"] });
    cache.set("b", sampleResponse, { sourceKeys: ["DOC_B"], collections: ["knowledge_base"] });

    const removed = cache.invalidateBySourceKeys(["doc_a"]);

    expect(removed).toBe(1);
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).not.toBeNull();
  });

  it("invalida seletivamente por collection", () => {
    const cache = new RagQueryCache();
    cache.set("a", sampleResponse, { sourceKeys: ["DOC_A"], collections: ["knowledge_base"] });
    cache.set("b", sampleResponse, { sourceKeys: ["DOC_B"], collections: ["schema_documents"] });

    const removed = cache.invalidateByCollections(["schema_documents"]);

    expect(removed).toBe(1);
    expect(cache.get("a")).not.toBeNull();
    expect(cache.get("b")).toBeNull();
  });
});
