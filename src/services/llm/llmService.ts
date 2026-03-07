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

  async generateStream(prompt: string, onToken: (chunk: any) => void, options?: { temperature?: number }): Promise<void> {
    const startedAt = Date.now();
    let promptTokens = Math.ceil(prompt.length / 4);
    let completionTokens = 0;

    if (env.llmProvider === "llama-cpp") {
      await this.streamLlamaCpp(prompt, onToken, options, startedAt);
    } else {
      await this.streamOllama(prompt, onToken, options, startedAt);
    }
  }

  private async streamOllama(prompt: string, onToken: (chunk: any) => void, options?: { temperature?: number }, startedAt?: number): Promise<void> {
    const response = await axios.post(`${env.ollamaBaseUrl}/api/generate`, {
      model: env.llmModel,
      prompt,
      stream: true,
      keep_alive: env.ragKeepAlive,
      options: {
        temperature: options?.temperature ?? 0.1,
        num_predict: env.ragMaxOutputTokens,
        num_ctx: env.ragNumCtx,
      },
    }, {
      responseType: "stream",
      timeout: env.ollamaTimeoutMs,
    });

    let promptTokensCount = Math.ceil(prompt.length / 4);
    let completionTokensCount = 0;

    response.data.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(l => l.trim() !== "");
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          completionTokensCount++;
          
          if (parsed.done) {
            const time = startedAt ? (Date.now() - startedAt) : 0;
            onToken({
              content: "",
              done: true,
              usage: {
                promptTokens: parsed.prompt_eval_count || promptTokensCount,
                completionTokens: parsed.eval_count || completionTokensCount,
                totalTokens: (parsed.prompt_eval_count || promptTokensCount) + (parsed.eval_count || completionTokensCount),
                executionTimeMs: time
              }
            });
          } else {
            onToken({ content: parsed.response, done: false });
          }
        } catch (e) {
          // Skip partial lines
        }
      }
    });

    return new Promise((resolve) => {
      response.data.on("end", resolve);
    });
  }

  private async streamLlamaCpp(prompt: string, onToken: (chunk: any) => void, options?: { temperature?: number }, startedAt?: number): Promise<void> {
    const response = await axios.post(`${env.ollamaBaseUrl}/completion`, {
      prompt,
      stream: true,
      temperature: options?.temperature ?? 0.1,
      n_predict: 500,
    }, { responseType: "stream" });

    let completionTokensCount = 0;

    response.data.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.startsWith("data: ")) {
        try {
          const parsed = JSON.parse(text.replace("data: ", ""));
          completionTokensCount++;
          
          if (parsed.stop) {
            const time = startedAt ? (Date.now() - startedAt) : 0;
            const promptTokens = Math.ceil(prompt.length / 4);
            onToken({
              content: "",
              done: true,
              usage: {
                promptTokens,
                completionTokens: completionTokensCount,
                totalTokens: promptTokens + completionTokensCount,
                executionTimeMs: time
              }
            });
          } else {
            onToken({ content: parsed.content, done: false });
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    });

    return new Promise((resolve) => {
      response.data.on("end", resolve);
    });
  }

  private async generateOllama(prompt: string, options?: { temperature?: number }): Promise<any> {
    const response = await axios.post(`${env.ollamaBaseUrl}/api/generate`, {
      model: env.llmModel,
      prompt,
      stream: false,
      keep_alive: env.ragKeepAlive,
      options: {
        temperature: options?.temperature ?? 0.1,
        num_predict: env.ragMaxOutputTokens,
        num_ctx: env.ragNumCtx,
      },
    }, {
      timeout: env.ollamaTimeoutMs,
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
