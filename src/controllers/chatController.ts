import { Request, Response } from "express";
import { RagService } from "../services/ragService";

export class ChatController {
  constructor(private readonly ragService: RagService) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    const message = req.body?.message as string;
    const topK = req.body?.topK ? Number(req.body.topK) : undefined;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message obrigatoria" });
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

