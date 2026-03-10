import { singleton } from "tsyringe";

type RequestMode = "schema" | "procedure" | "troubleshooting" | "general";

@singleton()
export class MetricsService {
  private counters = {
    requests_total: 0,
    cache_hit_total: 0,
    semantic_cache_hit_total: 0,
    no_context_total: 0,
    error_total: 0,
  };

  private latency = {
    count: 0,
    sumMs: 0,
  };

  recordRequest(durationMs: number, opts?: { cacheHit?: boolean; semanticHit?: boolean; noContext?: boolean; mode?: RequestMode }): void {
    this.counters.requests_total += 1;
    this.latency.count += 1;
    this.latency.sumMs += durationMs;

    if (opts?.cacheHit) this.counters.cache_hit_total += 1;
    if (opts?.semanticHit) this.counters.semantic_cache_hit_total += 1;
    if (opts?.noContext) this.counters.no_context_total += 1;
  }

  recordError(): void {
    this.counters.error_total += 1;
  }

  toPrometheus(): string {
    const lines = [
      "# HELP rag_requests_total Total RAG requests",
      "# TYPE rag_requests_total counter",
      `rag_requests_total ${this.counters.requests_total}`,
      "# HELP rag_cache_hit_total Cache hits (exact)",
      "# TYPE rag_cache_hit_total counter",
      `rag_cache_hit_total ${this.counters.cache_hit_total}`,
      "# HELP rag_semantic_cache_hit_total Semantic cache hits",
      "# TYPE rag_semantic_cache_hit_total counter",
      `rag_semantic_cache_hit_total ${this.counters.semantic_cache_hit_total}`,
      "# HELP rag_no_context_total Responses without context (fallback)",
      "# TYPE rag_no_context_total counter",
      `rag_no_context_total ${this.counters.no_context_total}`,
      "# HELP rag_error_total RAG errors",
      "# TYPE rag_error_total counter",
      `rag_error_total ${this.counters.error_total}`,
      "# HELP rag_latency_average_ms Average latency of handled requests",
      "# TYPE rag_latency_average_ms gauge",
      `rag_latency_average_ms ${this.latency.count ? (this.latency.sumMs / this.latency.count).toFixed(2) : 0}`,
    ];
    return lines.join("\n");
  }
}

