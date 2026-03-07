import { SearchResult, QueryAnalysis } from "../../types";

/**
 * Represents a single heuristic rule for scoring a search result.
 */
export interface ScoringRule {
  /**
   * The weight of this rule's score in the final calculation.
   */
  weight: number;

  /**
   * Evaluates a search result and returns a raw score (0-1).
   * @param hit The search result to evaluate.
   * @param analysis The analysis of the user's query.
   * @returns A score between 0 and 1.
   */
  evaluate(hit: SearchResult, analysis: QueryAnalysis): number;
}
