import { describe, expect, it, vi } from "vitest";
import { ScoringService } from "../../src/services/rag/scoringService";
import { SearchResult, QueryAnalysis } from "../../src/types";
import { ScoringRule } from "../../src/services/rag/scoringRule";

// Mock the rules so we can test the service in isolation
vi.mock("../../src/services/rag/scoring-rules/lexicalOverlapRule", () => {
  const LexicalOverlapRule = vi.fn();
  LexicalOverlapRule.prototype.weight = 10;
  LexicalOverlapRule.prototype.evaluate = () => 0.5; // Always return a score of 0.5
  return { LexicalOverlapRule };
});

vi.mock("../../src/services/rag/scoring-rules/tableHintRule", () => {
  const TableHintRule = vi.fn();
  TableHintRule.prototype.weight = 20;
  TableHintRule.prototype.evaluate = () => 0.2; // Always return a score of 0.2
  return { TableHintRule };
});

vi.mock("../../src/services/rag/scoring-rules/categoryRule", () => {
  const CategoryRule = vi.fn();
  CategoryRule.prototype.weight = 1;
  CategoryRule.prototype.evaluate = () => 0; // Return 0 to not interfere
  return { CategoryRule };
});

describe("ScoringService", () => {
  const service = new ScoringService();
  const dummyHit: SearchResult = { id: "1", text: "text", distance: 1.0 };
  const dummyAnalysis: QueryAnalysis = {
    mode: "general",
    tableHints: [],
    terms: [],
    normalizedQuestion: "",
  };

  it("combina as pontuacoes das regras corretamente", () => {
    // Base score from distance (1.0 * 40 = 40)
    // LexicalOverlapRule: 0.5 * 10 = 5
    // TableHintRule: 0.2 * 20 = 4
    // Total = 40 + 5 + 4 = 49
    const score = service.computeScore(dummyHit, dummyAnalysis);
    expect(score).toBe(49);
  });
});
