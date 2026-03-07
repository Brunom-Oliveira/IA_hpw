import { describe, expect, it } from "vitest";
import { LexicalOverlapRule } from "../../src/services/rag/scoring-rules/lexicalOverlapRule";
import { QueryAnalysis, SearchResult } from "../../../src/types";

describe("LexicalOverlapRule", () => {
  const rule = new LexicalOverlapRule();

  it("retorna 0 quando nao ha sobreposicao de termos", () => {
    const hit: SearchResult = {
      id: "1",
      text: "conteudo do documento",
      distance: 0,
      metadata: { title: "titulo" },
    };
    const analysis: QueryAnalysis = {
      mode: "general",
      tableHints: [],
      terms: ["palavra", "chave"],
      normalizedQuestion: "qual a palavra chave",
    };

    const score = rule.evaluate(hit, analysis);
    expect(score).toBe(0);
  });

  it("retorna uma pontuacao proporcional a sobreposicao de termos", () => {
    const hit: SearchResult = {
      id: "1",
      text: "documento contem a palavra e tambem a chave",
      distance: 0,
      metadata: { title: "titulo" },
    };
    const analysis: QueryAnalysis = {
      mode: "general",
      tableHints: [],
      terms: ["palavra", "chave", "inexistente"],
      normalizedQuestion: "qual a palavra chave",
    };

    // 2 overlaps out of 10 max = 0.2
    const score = rule.evaluate(hit, analysis);
    expect(score).toBe(0.2);
  });

  it("limita a pontuacao em 1.0 para uma grande sobreposicao", () => {
    const hit: SearchResult = {
      id: "1",
      text: "um dois tres quatro cinco seis sete oito nove dez onze",
      distance: 0,
      metadata: { title: "titulo" },
    };
    const analysis: QueryAnalysis = {
      mode: "general",
      tableHints: [],
      terms: ["um", "dois", "tres", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze"],
      normalizedQuestion: "todos os termos",
    };

    // 11 overlaps, but score is capped at 1.0
    const score = rule.evaluate(hit, analysis);
    expect(score).toBe(1.0);
  });
});
