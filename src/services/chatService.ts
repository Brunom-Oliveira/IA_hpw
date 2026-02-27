import { LlmPort } from "../types";
import { RagService } from "./ragService";
import { ensurePromptLimit } from "../utils/text";

export class ChatService {
  constructor(
    private readonly ragService: RagService,
    private readonly llmService: LlmPort
  ) {}

  async ask(message: string, topK = 4): Promise<{ answer: string; context: string[] }> {
    const contextResults = await this.ragService.searchContext(message, topK);
    const context = contextResults.map((item, index) => `Contexto ${index + 1}: ${item.text}`);

    const prompt = ensurePromptLimit(
      [
        "Voce e um assistente para operacoes de WMS.",
        "Use o contexto recuperado para responder com objetividade. Se faltar dado, diga explicitamente.",
        "",
        ...context,
        "",
        `Pergunta do usuario: ${message}`,
        "Resposta:",
      ].join("\n")
    );

    const answer = await this.llmService.generate(prompt, { temperature: 0.2 });
    return { answer, context };
  }
}

