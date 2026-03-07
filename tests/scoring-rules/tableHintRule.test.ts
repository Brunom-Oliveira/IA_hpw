import { describe, expect, it } from "vitest";
import { TableHintRule } from "../../src/services/rag/scoring-rules/tableHintRule";
import { QueryAnalysis, SearchResult } from "../../../src/types";

describe("TableHintRule", () => {
  const rule = new TableHintRule();

  it("retorna 0 se nao ha table hints", () => {
    const hit: SearchResult = { id: "1", text: "qualquer", distance: 0 };
    const analysis: QueryAnalysis = {
      mode: "schema",
      tableHints: [],
      terms: [],
      normalizedQuestion: "",
    };
    expect(rule.evaluate(hit, analysis)).toBe(0);
  });

  it("pontua mais alto para match exato de sufixo no metadata", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { table_suffix: "461" },
    };
    const analysis: QueryAnalysis = {
      mode: "schema",
      tableHints: ["_461"],
      terms: [],
      normalizedQuestion: "",
    };
    // Exact suffix match gives a high score (180)
    const score = rule.evaluate(hit, analysis);
    expect(score).toBeGreaterThan(0.6);
  });

  it("pontua para match de nome de tabela no metadata", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { table_name: "MERCADORIA_461" },
    };
    const analysis: QueryAnalysis = {
      mode: "schema",
      tableHints: ["MERCADORIA_461"],
      terms: [],
      normalizedQuestion: "",
    };
    // Exact table name match gives a high score (160)
    const score = rule.evaluate(hit, analysis);
    expect(score).toBeGreaterThan(0.6);
  });

  it("combina pontuacoes de varios matches", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { title: "Estrutura da Tabela MERCADORIA_461", table_name: "MERCADORIA_461" },
    };
    const analysis: QueryAnalysis = {
      mode: "schema",
      tableHints: ["MERCADORIA_461"],
      terms: [],
      normalizedQuestion: "",
    };
    // title match (40) + table_name match (160) = 200
    const score = rule.evaluate(hit, analysis);
    expect(score).toBeGreaterThan(0.66); // 1 - 1/(1+2) = 0.66
  });

  it("retorna 0 se o hint nao bate com o conteudo", () => {
    const hit: SearchResult = {
      id: "1",
      text: "texto",
      distance: 0,
      metadata: { table_name: "PRODUTO_123" },
    };
    const analysis: QueryAnalysis = {
      mode: "schema",
      tableHints: ["MERCADORIA_461"],
      terms: [],
      normalizedQuestion: "",
    };
    expect(rule.evaluate(hit, analysis)).toBe(0);
  });
});
