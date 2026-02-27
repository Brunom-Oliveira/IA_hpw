import { describe, expect, it } from "vitest";
import { ClassificationService } from "../src/services/classificationService";

const fakeLlm = {
  generate: async () => JSON.stringify({ label: "general", confidence: 0.7, rationale: "ok" }),
};

describe("ClassificationService", () => {
  it("classifica ticket tecnico por palavras-chave", async () => {
    const service = new ClassificationService(fakeLlm);
    const result = await service.classify("A API retornou timeout e erro 500", "rules");
    expect(result.label).toBe("technical");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("usa fallback para general quando nao encontra sinais", async () => {
    const service = new ClassificationService(fakeLlm);
    const result = await service.classify("Bom dia, preciso de ajuda", "rules");
    expect(result.label).toBe("general");
  });
});

