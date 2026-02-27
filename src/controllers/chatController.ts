import { Request, Response } from "express";
import { ChatService } from "../services/chatService";

export class ChatController {
  constructor(private readonly service: ChatService) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    const message = req.body?.message as string;
    const topK = Number(req.body?.topK ?? 4);

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message obrigatoria" });
      return;
    }

    const result = await this.service.ask(message, topK);
    res.json(result);
  };
}

