import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";

describe("Feedback API", () => {
  const app = buildApp();

  it("aceita feedback válido", async () => {
    const res = await request(app)
      .post("/api/rag/feedback")
      .send({
        query: "como receber mercadoria?",
        answer: "Siga o manual de recepcao",
        sources: ["manual-recepcao.md"],
        relevant: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.feedback_id).toBeDefined();
  });

  it("rejeita payload inválido", async () => {
    const res = await request(app)
      .post("/api/rag/feedback")
      .send({
        answer: "faltou query",
        relevant: true,
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

