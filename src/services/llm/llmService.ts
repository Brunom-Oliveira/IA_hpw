import axios from "axios";
import { LlmPort, LlmUsage } from "../../types";
import { env } from "../../utils/env";

export class LlmService implements LlmPort {
  async generate(prompt: string, options?: { temperature?: number }): Promise<{ response: string; usage: LlmUsage }> {
    const startedAt = Date.now();
    
    let responseText = "";
    let promptTokens = 0;
    let completionTokens = 0;

    if (env.llmProvider === "llama-cpp") {
      const data = await this.generateLlamaCpp(prompt, options);
      responseText = data.content;
      // llama.cpp doesn't always provide token counts in simple /completion
      promptTokens = Math.ceil(prompt.length / 4);
      completionTokens = Math.ceil(responseText.length / 4);
    } else {
      const data = await this.generateOllama(prompt, options);
      responseText = data.response;
      promptTokens = data.prompt_eval_count ?? Math.ceil(prompt.length / 4);
      completionTokens = data.eval_count ?? Math.ceil(responseText.length / 4);
    }

    const executionTimeMs = Date.now() - startedAt;

    return {
      response: responseText,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        executionTimeMs,
      },
    };
  }

  private async generateOllama(prompt: string, options?: { temperature?: number }): Promise<any> {
    const response = await axios.post(`${env.ollamaBaseUrl}/api/generate`, {
      model: env.llmModel,
      prompt,
      stream: false,
      options: {
        temperature: options?.temperature ?? 0.1,
        num_predict: 500,
      },
    });
    return response.data;
  }

  private async generateLlamaCpp(prompt: string, options?: { temperature?: number }): Promise<any> {
    const response = await axios.post(`${env.ollamaBaseUrl}/completion`, {
      prompt,
      temperature: options?.temperature ?? 0.1,
      n_predict: 500,
    });
    return response.data;
  }
}

