import { describe, expect, it } from "vitest";
import { QueryAnalysisService } from "../../src/services/rag/queryAnalysisService";

describe("QueryAnalysisService", () => {
  const service = new QueryAnalysisService();

  it("identifica modo schema por palavra-chave", () => {
    const analysis = service.analyze("qual a estrutura da tabela x");
    expect(analysis.mode).toBe("schema");
  });

  it("identifica modo schema por hint de tabela", () => {
    const analysis = service.analyze("fale sobre a MERCADORIA_461");
    expect(analysis.mode).toBe("schema");
    expect(analysis.tableHints).toEqual(["MERCADORIA_461"]);
  });

  it("identifica modo procedure", () => {
    const analysis = service.analyze("como faco para configurar o recebimento");
    expect(analysis.mode).toBe("procedure");
  });

  it("identifica modo troubleshooting", () => {
    const analysis = service.analyze("estou com um problema de erro no wms");
    expect(analysis.mode).toBe("troubleshooting");
  });

  it("identifica modo general como fallback", () => {
    const analysis = service.analyze("qual o sentido da vida");
    expect(analysis.mode).toBe("general");
  });

  it("extrai termos relevantes e normalizados", () => {
    const analysis = service.analyze("Qual é a ESTRUTURA da tabela PRODUTO_123?");
    expect(analysis.terms).toEqual(["estrutura", "tabela", "produto_123"]);
    expect(analysis.normalizedQuestion).toBe("qual e a estrutura da tabela produto_123");
  });

  it("expande uma query curta para melhorar a busca", () => {
    const analysis = service.analyze("ajuda");
    expect(analysis.originalQuestion).toBe("ajuda");
    expect(analysis.expandedQuestion).toBeDefined();
    expect(analysis.expandedQuestion).toContain("detalhes tecnicos");
    expect(analysis.normalizedQuestion).toContain("ajuda");
  });

  it("aplica expansao leve em queries curtas mas sem sinais claros", () => {
    const query = "recepcao";
    const analysis = service.analyze(query);
    expect(analysis.expandedQuestion).toBeDefined();
    expect(analysis.expandedQuestion).toContain("passo a passo detalhado");
  });

  it("mantem query longa sem expansao desnecessaria", () => {
    const query = "como configuro meu computador novo";
    const analysis = service.analyze(query);
    expect(analysis.expandedQuestion).toBeUndefined();
    expect(analysis.normalizedQuestion).toBe("como configuro meu computador novo");
  });
});
