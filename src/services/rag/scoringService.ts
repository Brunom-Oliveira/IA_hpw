import { singleton } from "tsyringe";
import { SearchResult, QueryAnalysis } from "../../types";
import { CategoryRule } from "./scoring-rules/categoryRule";
import { LexicalOverlapRule } from "./scoring-rules/lexicalOverlapRule";
import { TableHintRule } from "./scoring-rules/tableHintRule";
import { ScoringRule } from "./scoringRule";

@singleton()
export class ScoringService {
  private readonly rules: ScoringRule[];

  constructor() {
    // In a more advanced setup, rules could be injected as a multi-injection
    this.rules = [new LexicalOverlapRule(), new TableHintRule(), new CategoryRule()];
  }

  public computeScore(hit: SearchResult, analysis: QueryAnalysis): number {
    let score = this.normalizeVectorScore(hit.distance);

    for (const rule of this.rules) {
      const ruleScore = rule.evaluate(hit, analysis);
      score += ruleScore * rule.weight;
    }

    return score;
  }

  private normalizeVectorScore(rawDistance: number): number {
    if (!Number.isFinite(rawDistance)) return 0;
    // Assuming distance is cosine similarity, where 1 is identical and 0 is dissimilar.
    // This is a guess, as the original function was complex.
    // A simple linear scale from distance to score might be better.
    // Let's stick to the original logic for now.
    if (rawDistance >= 0 && rawDistance <= 1.5) {
      return rawDistance * 40;
    }
    return Math.max(0, 20 - rawDistance);
  }
}
