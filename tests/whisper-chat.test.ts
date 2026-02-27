import { describe, expect, it } from "vitest";
import { ChatService } from "../src/services/chatService";
import { WhisperService } from "../src/services/whisper/whisperService";

describe("ChatService", () => {
  it("gera resposta usando contexto recuperado", async () => {
    const rag = {
      searchContext: async () => [{ id: "1", text: "Pedido 123 atrasado por chuva", distance: 0.02, metadata: {} }],
    };
    const llm = { generate: async (prompt: string) => `Resposta baseada em: ${prompt.slice(0, 24)}` };

    const service = new ChatService(rag as any, llm);
    const result = await service.ask("Qual o status do pedido 123?");
    expect(result.context.length).toBe(1);
    expect(result.answer).toContain("Resposta baseada");
  });
});

describe("WhisperService", () => {
  it("existe e oferece metodo de transcricao", () => {
    const whisper = new WhisperService();
    expect(typeof whisper.transcribe).toBe("function");
  });
});

