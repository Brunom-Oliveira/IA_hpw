import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";

describe("Metrics endpoint", () => {
  const app = buildApp();

  it("exposes Prometheus metrics", async () => {
    const res = await request(app).get("/api/rag/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("rag_requests_total");
    expect(res.headers["content-type"]).toContain("text/plain");
  });
});

