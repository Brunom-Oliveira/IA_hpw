import { Request, Response } from "express";
import { RagService } from "../services/ragService";

export class ChatController {
  constructor(private readonly ragService: RagService) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    const { message, topK, stream } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message obrigatoria" });
      return;
    }

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      try {
        await this.ragService.askStream(message, (chunk) => {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }, topK);
        res.end();
      } catch (error: any) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
      return;
    }

    try {
      const result = await this.ragService.ask(message, topK);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Erro no processamento do chat" });
    }
  };
}

