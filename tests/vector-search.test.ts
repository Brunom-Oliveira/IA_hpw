import { afterEach, describe, expect, it, vi } from "vitest";
import { RagService } from "../src/services/ragService";
import { ragQueryCache } from "../src/services/ragQueryCache";
import { LlmPort, VectorDbPort } from "../src/types";
import { QueryAnalysisService } from "../src/services/rag/queryAnalysisService";

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

const fakeQueryAnalysisService = new QueryAnalysisService();

const fakeSemanticCacheService = {
  find: vi.fn(async () => null),
  add: vi.fn(async () => undefined),
};

const fakeMetrics = {
  recordRequest: vi.fn(),
};

describe("RagService", () => {
  afterEach(() => {
    vi.clearAllMocks();
    ragQueryCache.clear();
  });

  it("insere documentos com embeddings gerados em lote", async () => {
    const upsert = vi.fn(async () => undefined);
    const vectorDb: VectorDbPort = {
      upsert,
      search: vi.fn(async () => []),
    };

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm, fakeQueryAnalysisService, fakeSemanticCacheService as any, fakeMetrics as any);
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

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm, fakeQueryAnalysisService, fakeSemanticCacheService as any, fakeMetrics as any);
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

  it("usa metadata explicita da tabela quando titulo e source nao trazem o sufixo", async () => {
    const vectorDb: VectorDbPort = {
      upsert: vi.fn(async () => undefined),
      search: vi.fn(async () => [
        {
          id: "generic-1",
          text: "Campos e relacoes da tabela alvo",
          distance: 0.8,
          metadata: {
            title: "Documento tecnico",
            source: "schema.md",
            category: "schema",
            table_name: "MERCADORIA_461",
            table_suffix: "461",
            document_type: "schema_table",
          },
        },
        {
          id: "generic-2",
          text: "Campos e relacoes de outra tabela",
          distance: 0.9,
          metadata: {
            title: "Documento tecnico",
            source: "schema.md",
            category: "schema",
            table_name: "MERC_INVOL_479",
            table_suffix: "479",
            document_type: "schema_table",
          },
        },
      ]),
    };

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm, fakeQueryAnalysisService, fakeSemanticCacheService as any, fakeMetrics as any);
    const result = await service.ask("quais campos existem na tabela 461", 2);

    expect(result.context).toContain("Campos e relacoes da tabela alvo");
    expect(result.context).not.toContain("outra tabela");
    expect(result.matches).toBe(1);
  });

  it("nao chama o LLM quando nao ha contexto suficiente para a tabela pedida", async () => {
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
            category: "schema",
          },
        },
      ]),
    };

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm, fakeQueryAnalysisService, fakeSemanticCacheService as any, fakeMetrics as any);
    const result = await service.ask("qual e o campo de mercadoria da tabela 461", 2);

    expect(fakeLlm.generate).not.toHaveBeenCalled();
    expect(result.answer).toContain("Nao encontrei contexto suficiente da tabela 461");
    expect(result.matches).toBe(0);
    expect(result.sources).toEqual([]);
  });

  it("diversifica fontes quando varios chunks do mesmo documento competem com outra fonte relevante", async () => {
    const vectorDb: VectorDbPort = {
      upsert: vi.fn(async () => undefined),
      search: vi.fn(async () => [
        {
          id: "manual-1",
          text: "Procedimento de recepcao de mercadoria passo 1",
          distance: 0.98,
          metadata: {
            title: "Manual de Recepcao",
            source: "manual-recepcao.md",
            category: "manual",
            module: "Recepcao",
          },
        },
        {
          id: "manual-2",
          text: "Procedimento de recepcao de mercadoria passo 2",
          distance: 0.99,
          metadata: {
            title: "Manual de Recepcao",
            source: "manual-recepcao.md",
            category: "manual",
            module: "Recepcao",
          },
        },
        {
          id: "ticket-1",
          text: "Checklist operacional de recebimento e validacao de volumes",
          distance: 0.85,
          metadata: {
            title: "Checklist de Recebimento",
            source: "checklist-ticket.md",
            category: "ticket",
            module: "Recepcao",
          },
        },
      ]),
    };

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm, fakeQueryAnalysisService, fakeSemanticCacheService as any, fakeMetrics as any);
    const result = await service.ask("como fazer recebimento de mercadoria", 3);

    expect(result.sources).toEqual([
      { title: "Manual de Recepcao", category: "manual" },
      { title: "Checklist de Recebimento", category: "ticket" },
    ]);
    expect(result.context).toContain("Manual de Recepcao");
    expect(result.context).toContain("Checklist de Recebimento");
    expect(result.matches).toBe(2);
  });

  it("reutiliza resposta em cache para perguntas repetidas", async () => {
    const vectorDb: VectorDbPort = {
      upsert: vi.fn(async () => undefined),
      search: vi.fn(async () => [
        {
          id: "schema-461",
          text: "Tabela: MERCADORIA_461\nCampo principal: MERC_PK_461",
          distance: 0.9,
          metadata: {
            title: "Estrutura da tabela MERCADORIA_461",
            source: "MERCADORIA_461.SQL",
            category: "schema",
            table_name: "MERCADORIA_461",
            table_suffix: "461",
          },
        },
      ]),
    };

    const service = new RagService(vectorDb, fakeEmbeddingService as any, fakeLlm, fakeQueryAnalysisService, fakeSemanticCacheService as any, fakeMetrics as any);
    const first = await service.ask("qual e a chave da tabela 461", 1);
    const second = await service.ask("qual e a chave da tabela 461", 1);

    expect(first.answer).toEqual(second.answer);
    expect(vectorDb.search).toHaveBeenCalledOnce();
    expect(fakeLlm.generate).toHaveBeenCalledOnce();
  });
});
