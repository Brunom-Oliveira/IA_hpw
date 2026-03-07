import { ScoringRule } from "../scoringRule";
import { SearchResult, QueryAnalysis } from "../../../types";

export class LexicalOverlapRule implements ScoringRule {
  public weight = 18;

  evaluate(hit: SearchResult, analysis: QueryAnalysis): number {
    const haystack = this.buildHaystack(hit);
    const overlap = analysis.terms.reduce((sum, term) => (haystack.includes(term) ? sum + 1 : sum), 0);
    return Math.min(1.0, overlap / 10);
  }

  private buildHaystack(hit: SearchResult): string {
    const meta = hit.metadata ?? {};
    const title = String(meta.title || "");
    const source = String(meta.source || meta.file_name || "");
    const category = String(meta.category || "");
    const system = String(meta.system || "");
    const module = String(meta.module || "");
    const tableName = String(meta.table_name || "");
    const tableSuffix = String(meta.table_suffix || "");
    const documentType = String(meta.document_type || "");
    const section = String(meta.section || "");
    const tags = String(meta.tags_csv || "");
    const textHead = String(hit.text || "").slice(0, 2200);

    const fullText = [
      title,
      source,
      category,
      system,
      module,
      tableName,
      tableSuffix,
      documentType,
      section,
      tags,
      textHead,
          ].join("\n");    return this.normalizeText(fullText);
  }

  private normalizeText(text: string): string {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
}
