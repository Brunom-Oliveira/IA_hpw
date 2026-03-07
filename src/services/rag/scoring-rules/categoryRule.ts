import { ScoringRule } from "../scoringRule";
import { SearchResult, QueryAnalysis } from "../../../types";

export class CategoryRule implements ScoringRule {
  public weight = 1.0;

  evaluate(hit: SearchResult, analysis: QueryAnalysis): number {
    const meta = hit.metadata ?? {};
    const category = String(meta.category || "").toLowerCase();
    const documentType = String(meta.document_type || "");

    let score = 0;

    if (analysis.mode === "schema") {
      if (category === "schema") score += 55;
      if (documentType === "schema_table") score += 40;
    } else if (analysis.mode === "procedure") {
      if (category === "manual") score += 45;
      if (category === "ticket") score += 20;
    } else if (analysis.mode === "troubleshooting") {
      if (category === "ticket") score += 45;
      if (category === "audio_case") score += 30;
    }

    return score > 0 ? 1.0 - 1.0 / (1.0 + score / 100.0) : 0;
  }
}
