import { inject, singleton } from "tsyringe";
import { SearchResult, QueryAnalysis, VectorDbPort } from "../../types";
import { InjectionTokens } from "../../types/injectionTokens";
import { EmbeddingService } from "../llm/embeddingService";
import { ScoringService } from "./scoringService";
import { env } from "../../utils/env";

type RankedHit = {
  hit: SearchResult;
  score: number;
};

@singleton()
export class RetrievalService {
  constructor(
    @inject(InjectionTokens.VectorDbPort) private readonly vectorDb: VectorDbPort,
    @inject(EmbeddingService) private readonly embeddingService: EmbeddingService,
    private readonly scoringService: ScoringService
  ) {}

  public async retrieve(question: string, analysis: QueryAnalysis, requestedTopK?: number): Promise<SearchResult[]> {
    const candidateLimit = this.resolveCandidateLimit(question, requestedTopK, analysis);
    const finalLimit = this.resolveFinalContextLimit(requestedTopK, analysis);
    const queryEmbedding = await this.embeddingService.embed(question);
    const collection = this.resolveCollectionForAnalysis(analysis);
    const hits = await this.vectorDb.search(queryEmbedding, candidateLimit, collection);
    return this.curateHitsByQuestion(hits, analysis, finalLimit);
  }

  private curateHitsByQuestion(
    hits: SearchResult[],
    analysis: QueryAnalysis,
    finalLimit: number
  ): SearchResult[] {
    if (!Array.isArray(hits) || hits.length === 0) return [];

    const scopedHits =
      analysis.tableHints.length > 0 ? this.filterStrictTableHits(hits, analysis.tableHints) : hits;

    if (analysis.tableHints.length > 0 && scopedHits.length === 0) {
      return [];
    }

    const ranked = scopedHits
      .map((hit) => ({
        hit,
        score: this.scoringService.computeScore(hit, analysis),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return this.selectDiverseHits(ranked, finalLimit);
  }

  private selectDiverseHits(rankedHits: RankedHit[], finalLimit: number): SearchResult[] {
    const selected: SearchResult[] = [];
    const sourceUsage = new Map<string, number>();

    for (const item of rankedHits) {
      if (selected.length >= finalLimit) break;

      const sourceKey = this.buildSourceKey(item.hit);
      const sourceCount = sourceUsage.get(sourceKey) || 0;

      if (sourceCount < env.ragMaxChunksPerSource) {
        selected.push(item.hit);
        sourceUsage.set(sourceKey, sourceCount + 1);
      }
    }

    return selected;
  }

  private resolveCandidateLimit(question: string, requested?: number, analysis?: QueryAnalysis): number {
    const base = requested && requested > 0 ? Math.min(12, requested * 3) : 8;
    const tokens = Math.ceil(String(question || "").length / 4); // simple estimate
    const expanded = tokens > 60 ? Math.max(base, 12) : Math.max(base, 8);
    if (analysis?.mode === "schema") return Math.max(expanded, 10);
    return expanded;
  }

  private resolveFinalContextLimit(requested?: number, analysis?: QueryAnalysis): number {
    const desired = requested && requested > 0 ? Math.min(env.ragTopK, requested) : env.ragTopK;
    if (analysis?.mode === "schema") return Math.min(2, desired);
    return desired;
  }

  private resolveCollectionForAnalysis(analysis: QueryAnalysis): string | undefined {
    if (analysis?.mode === "schema") {
      return env.qdrantSchemaCollection || env.qdrantCollection;
    }
    return env.qdrantCollection;
  }

  private filterStrictTableHits(hits: SearchResult[], tableHints: string[]): SearchResult[] {
    const strictSuffixes = tableHints
      .filter((hint) => hint.startsWith("_"))
      .map((hint) => hint.slice(1))
      .filter(Boolean);

    const strictNames = tableHints.filter((hint) => !hint.startsWith("_")).map((hint) => hint.toUpperCase());

    return hits.filter((hit) => {
      const title = String(hit.metadata?.title || "").toUpperCase();
      const source = String(hit.metadata?.source || "").toUpperCase();
      const system = String(hit.metadata?.system || "").toUpperCase();
      const fileName = String(hit.metadata?.file_name || "").toUpperCase();
      const tableName = String(hit.metadata?.table_name || "").toUpperCase();
      const tableSuffix = String(hit.metadata?.table_suffix || "").toUpperCase();
      const haystack = `${title}
${source}
${system}
${fileName}
${tableName}
${tableSuffix}`;

      for (const name of strictNames) {
        if (haystack.includes(name)) return true;
      }

      for (const suffix of strictSuffixes) {
        const suffixPattern = new RegExp(`_[0]*${suffix}\b`);
        if (suffixPattern.test(haystack)) return true;
        if (tableSuffix.replace(/^0+/, "") === suffix.replace(/^0+/, "")) return true;
      }

      return false;
    });
  }

  private buildSourceKey(hit: SearchResult): string {
    return [
      String(hit.metadata?.source || ""),
      String(hit.metadata?.file_name || ""),
      String(hit.metadata?.title || ""),
      String(hit.metadata?.table || ""),
    ].join("|").toUpperCase();
  }
}
