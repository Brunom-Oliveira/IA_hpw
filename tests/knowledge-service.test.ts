import { afterEach, describe, expect, it, vi } from "vitest";

const { axiosGetMock, axiosPutMock } = vi.hoisted(() => ({
  axiosGetMock: vi.fn(),
  axiosPutMock: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: axiosGetMock,
    put: axiosPutMock,
  },
}));

import { KnowledgeService } from "../src/services/knowledgeService";

describe("KnowledgeService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("valida payload manual obrigatorio antes de indexar", async () => {
    const service = new KnowledgeService(
      {
        embed: vi.fn(async () => [0.1]),
      } as any,
      {
        generate: vi.fn(async () => ({ response: "{}", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, executionTimeMs: 0 } })),
      },
    );

    await expect(
      service.ingestManual({
        category: "documentation",
        title: "Manual incompleto",
      }),
    ).rejects.toThrow("system obrigatorio");

    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(axiosPutMock).not.toHaveBeenCalled();
  });

  it("indexa item manual valido com metadata enriquecida", async () => {
    axiosGetMock.mockRejectedValueOnce({ response: { status: 404 } });
    axiosPutMock.mockResolvedValue({});

    const embeddingService = {
      embed: vi.fn(async () => [0.1, 0.2, 0.3]),
    };

    const service = new KnowledgeService(
      embeddingService as any,
      {
        generate: vi.fn(async () => ({ response: "{}", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, executionTimeMs: 0 } })),
      },
    );

    const result = await service.ingestManual({
      category: "documentation",
      system: "HARPIA WMS",
      module: "Recepcao",
      title: "Recepcao de mercadoria",
      problem: "Como receber mercadoria",
      tables_related: ["MERCADORIA_461"],
      tags: ["recepcao", "manual"],
    });

    expect(result.id).toBeTruthy();
    expect(embeddingService.embed).toHaveBeenCalledOnce();
    expect(axiosPutMock).toHaveBeenCalledTimes(2);

    const collectionCreationPayload = axiosPutMock.mock.calls[0][1];
    expect(collectionCreationPayload).toEqual({
      vectors: {
        size: 768,
        distance: "Cosine",
      },
    });

    const pointPayload = axiosPutMock.mock.calls[1][1].points[0].payload;
    expect(pointPayload.system).toBe("HARPIA WMS");
    expect(pointPayload.module).toBe("Recepcao");
    expect(pointPayload.table_name).toBe("MERCADORIA_461");
    expect(pointPayload.table_suffix).toBe("461");
    expect(pointPayload.tags).toEqual(["recepcao", "manual"]);
  });

  it("processa transcricao sem salvar quando save_to_knowledge for falso", async () => {
    const llm = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          response: "Transcricao revisada com codigo 461",
          usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20, executionTimeMs: 10 },
        })
        .mockResolvedValueOnce({
          response: JSON.stringify({
            mantis_summary: "Recepcao com codigo 461",
            mantis_description: "Descricao pronta",
            knowledge_item: {
              category: "ticket",
              system: "HARPIA WMS",
              module: "Recepcao",
              title: "Recepcao com erro",
              problem: "Erro na recepcao",
              symptoms: ["Falha ao bipar"],
              cause: "Nao identificado",
              solution: "Validar configuracao",
              tables_related: ["MERCADORIA_461"],
              tags: ["recepcao"],
            },
          }),
          usage: { promptTokens: 20, completionTokens: 20, totalTokens: 40, executionTimeMs: 20 },
        }),
    };

    const service = new KnowledgeService(
      {
        embed: vi.fn(async () => [0.1]),
      } as any,
      llm as any,
    );

    const result = await service.autoProcessAudioTranscription("transcricao original", { system: "HARPIA WMS", module: "Recepcao" }, { save_to_knowledge: false });

    expect(result.saved).toBe(false);
    expect(result.transcription_normalized).toBe("Transcricao revisada com codigo 461");
    expect(result.mantis).toEqual({
      summary: "Recepcao com codigo 461",
      description: "Descricao pronta",
    });
    expect((result.knowledge_item as Record<string, unknown>).title).toBe("Recepcao com erro");
    expect(axiosPutMock).not.toHaveBeenCalled();
  });
});
