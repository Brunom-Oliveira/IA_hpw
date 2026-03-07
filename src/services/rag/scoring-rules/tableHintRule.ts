import { ScoringRule } from "../scoringRule";
import { SearchResult, QueryAnalysis } from "../../../types";

export class TableHintRule implements ScoringRule {
  public weight = 1.0; // This rule will have its own internal weighting

  evaluate(hit: SearchResult, analysis: QueryAnalysis): number {
    if (analysis.tableHints.length === 0) {
      return 0;
    }

    const meta = hit.metadata ?? {};
    const title = this.normalizeText(String(meta.title || ""));
    const source = this.normalizeText(String(meta.source || meta.file_name || ""));
    const system = this.normalizeText(String(meta.system || ""));
    const tableName = this.normalizeText(String(meta.table_name || ""));
    const tableSuffix = String(meta.table_suffix || "").replace(/^0+/, "");
    const textHead = this.normalizeText(String(hit.text || "").slice(0, 2200));

    let score = 0;

    for (const hint of analysis.tableHints) {
      if (hint.startsWith("_")) {
        const suffixHint = hint.slice(1).replace(/^0+/, "");
        const suffixPattern = new RegExp(`_[0]*${suffixHint}\b`, "i");
        if (suffixPattern.test(`${title}
${source}
${system}`)) score += 120;
        if (tableSuffix === suffixHint) score += 180;
        if (suffixPattern.test(textHead)) score += 35;
      } else {
        const normalizedHint = this.normalizeText(hint);
        if (title.includes(normalizedHint)) score += 40;
        if (tableName.includes(normalizedHint)) score += 160;
      }
    }
    // Normalize the score. The max possible score is high, so let's use a simple logistic-like function.
    return score > 0 ? 1.0 - 1.0 / (1.0 + score / 100.0) : 0;
  }

  private normalizeText(text: string): string {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
}
