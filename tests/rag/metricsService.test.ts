import { describe, expect, it } from "vitest";
import { MetricsService } from "../../src/services/metricsService";

describe("MetricsService", () => {
  it("increments counters and computes average latency", () => {
    const svc = new MetricsService();
    svc.recordRequest(100, { cacheHit: true, semanticHit: true, noContext: false });
    svc.recordRequest(200, { cacheHit: false, semanticHit: false, noContext: true });
    svc.recordError();

    const output = svc.toPrometheus();
    expect(output).toContain("rag_requests_total 2");
    expect(output).toContain("rag_cache_hit_total 1");
    expect(output).toContain("rag_semantic_cache_hit_total 1");
    expect(output).toContain("rag_no_context_total 1");
    expect(output).toContain("rag_error_total 1");
    expect(output).toMatch(/rag_latency_average_ms 150(\.00)?/);
  });
});

