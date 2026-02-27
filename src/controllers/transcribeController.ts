import { Request, Response } from "express";
import { WhisperService } from "../services/whisper/whisperService";
import { removeFileIfExists } from "../utils/audio";

export class TranscribeController {
  constructor(private readonly whisperService: WhisperService) {}

  transcribe = async (req: Request, res: Response): Promise<void> => {
    const filePath = req.file?.path;

    if (!filePath) {
      res.status(400).json({ error: "Arquivo de audio nao enviado" });
      return;
    }

    try {
      const text = await this.whisperService.transcribe(filePath);
      res.json({ text });
    } finally {
      await removeFileIfExists(filePath);
    }
  };
}

