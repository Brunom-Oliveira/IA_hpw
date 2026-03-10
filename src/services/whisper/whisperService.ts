import { promises as fs } from "fs";
import { spawn } from "child_process";
import { env } from "../../utils/env";
import { buildWhisperOutputPrefix, removeFileIfExists } from "../../utils/audio";

export class WhisperService {
  async transcribe(audioPath: string): Promise<string> {
    const outputPrefix = buildWhisperOutputPrefix(audioPath);

    await this.runWhisper(audioPath, outputPrefix);

    const txtPath = `${outputPrefix}.txt`;
    const content = await fs.readFile(txtPath, "utf-8");

    await removeFileIfExists(txtPath);
    return content.trim();
  }

  private runWhisper(audioPath: string, outputPrefix: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let stderr = "";

      const args = [
        "-m",
        env.whisperModelPath,
        "-f",
        audioPath,
        "-l",
        env.whisperLanguage,
        "-otxt",
        "-of",
        outputPrefix,
      ];

      // Usa spawn com argumentos separados para reduzir risco de injecao via shell.
      const child = spawn(env.whisperBinPath, args, { stdio: "pipe" });

      child.stderr?.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          const message =
            code === 3
              ? "Whisper finalizou com erro (código 3). Verifique se o modelo foi baixado e se o binário tem permissão de execução."
              : `Whisper finalizou com codigo ${code}`;

          reject(new Error(stderr?.trim() ? `${message}: ${stderr.trim()}` : message));
        }
      });
    });
  }
}
