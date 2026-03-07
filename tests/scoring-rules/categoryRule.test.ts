import { describe, expect, it } from "vitest";
import { CategoryRule } from "../../src/services/rag/scoring-rules/categoryRule";
import { QueryAnalysis, SearchResult } from "../../../src/types";

describe("CategoryRule", () => {
  const rule = new CategoryRule();

  it("aplica bonus para o modo schema", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { category: "schema", document_type: "schema_table" },
    };
    const analysis: QueryAnalysis = {
      mode: "schema",
      tableHints: [],
      terms: [],
      normalizedQuestion: "",
    };
    // schema category (55) + schema_table type (40) = 95
    const score = rule.evaluate(hit, analysis);
    expect(score).toBeGreaterThan(0.48); // 1 - 1 / (1 + 0.95)
  });

  it("aplica bonus para o modo procedure", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { category: "manual" },
    };
    const analysis: QueryAnalysis = {
      mode: "procedure",
      tableHints: [],
      terms: [],
      normalizedQuestion: "",
    };
    // manual category (45)
    const score = rule.evaluate(hit, analysis);
    expect(score).toBeGreaterThan(0.3); // 1 - 1 / (1 + 0.45)
  });

  it("aplica bonus para o modo troubleshooting", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { category: "ticket" },
    };
    const analysis: QueryAnalysis = {
      mode: "troubleshooting",
      tableHints: [],
      terms: [],
      normalizedQuestion: "",
    };
    // ticket category (45)
    const score = rule.evaluate(hit, analysis);
    expect(score).toBeGreaterThan(0.3); // 1 - 1 / (1 + 0.45)
  });

  it("retorna 0 se o modo for general", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { category: "manual" },
    };
    const analysis: QueryAnalysis = {
      mode: "general",
      tableHints: [],
      terms: [],
      normalizedQuestion: "",
    };
    expect(rule.evaluate(hit, analysis)).toBe(0);
  });
});
