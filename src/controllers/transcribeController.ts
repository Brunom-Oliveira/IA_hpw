import { Request, Response } from "express";
import { singleton, inject } from "tsyringe";
import { WhisperService } from "../services/whisper/whisperService";
import { removeFileIfExists } from "../utils/audio";
import { logger } from "../utils/logger";

@singleton()
export class TranscribeController {
  constructor(@inject(WhisperService) private readonly whisperService: WhisperService) {}

  transcribe = async (req: Request, res: Response): Promise<void> => {
    // Suporta tanto upload.single("audio") quanto upload.fields(["audio","file"])
    const anyFiles = (req as any).files as Record<string, any[]> | undefined;
    const fallbackFile = Array.isArray(anyFiles?.audio) && anyFiles.audio[0]?.path
      ? anyFiles.audio[0].path
      : Array.isArray(anyFiles?.file) && anyFiles.file[0]?.path
        ? anyFiles.file[0].path
        : undefined;

    const filePath = req.file?.path || fallbackFile;

    if (!filePath) {
      res.status(400).json({ error: "Arquivo de audio nao enviado" });
      return;
    }

    try {
      const text = await this.whisperService.transcribe(filePath);
      res.json({ text });
    } catch (error: any) {
      logger.error({
        message: "Falha na transcricao (Whisper)",
        error: error?.message,
        stack: error?.stack,
      });

      res.status(502).json({
        error: "Erro ao transcrever audio",
        detail: error?.message,
      });
    } finally {
      await removeFileIfExists(filePath);
    }
  };
}

