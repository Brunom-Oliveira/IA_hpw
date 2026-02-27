import axios from "axios";
import { LlmPort } from "../../types";
import { env } from "../../utils/env";

export class LlmService implements LlmPort {
  async generate(prompt: string, options?: { temperature?: number }): Promise<string> {
    if (env.llmProvider === "llama-cpp") {
      return this.generateLlamaCpp(prompt, options);
    }
    return this.generateOllama(prompt, options);
  }

  private async generateOllama(prompt: string, options?: { temperature?: number }): Promise<string> {
    const response = await axios.post(`${env.ollamaBaseUrl}/api/generate`, {
      model: env.llmModel,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.2,
      },
    });
    return response.data.response ?? "";
  }

  private async generateLlamaCpp(prompt: string, options?: { temperature?: number }): Promise<string> {
    const response = await axios.post(`${env.ollamaBaseUrl}/completion`, {
      prompt,
      temperature: options?.temperature ?? 0.2,
      n_predict: 384,
    });
    return response.data.content ?? "";
  }
}

