import { describe, it, expect } from "vitest";
import {
  apiLimiter,
  uploadLimiter,
  transcribeLimiter,
  adminLimiter,
} from "../../src/middleware/rateLimiter";

/**
 * Testes para Rate Limiter [PERF-001]
 *
 * Validações:
 * - Middleware está corretamente exportado
 * - Função está disponível para uso
 * - Tipagem está correta
 */
describe("Rate Limiter Middleware [PERF-001]", () => {
  describe("Middleware Exists", () => {
    it("should export apiLimiter", () => {
      expect(apiLimiter).toBeDefined();
    });

    it("should export uploadLimiter", () => {
      expect(uploadLimiter).toBeDefined();
    });

    it("should export transcribeLimiter", () => {
      expect(transcribeLimiter).toBeDefined();
    });

    it("should export adminLimiter", () => {
      expect(adminLimiter).toBeDefined();
    });
  });

  describe("Middleware Type", () => {
    it("apiLimiter should be a function", () => {
      expect(typeof apiLimiter).toBe("function");
    });

    it("uploadLimiter should be a function", () => {
      expect(typeof uploadLimiter).toBe("function");
    });

    it("transcribeLimiter should be a function", () => {
      expect(typeof transcribeLimiter).toBe("function");
    });

    it("adminLimiter should be a function", () => {
      expect(typeof adminLimiter).toBe("function");
    });
  });

  describe("Middleware Integration", () => {
    it("should have all required limiters", () => {
      const limiters = {
        apiLimiter,
        uploadLimiter,
        transcribeLimiter,
        adminLimiter,
      };

      expect(Object.keys(limiters).length).toBe(4);
      Object.values(limiters).forEach((limiter) => {
        expect(typeof limiter).toBe("function");
      });
    });
  });
});
