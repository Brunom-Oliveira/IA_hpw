import { Request, Response } from "express";
import { ClassificationService } from "../services/classificationService";

export class ClassificationController {
  constructor(private readonly service: ClassificationService) {}

  classify = async (req: Request, res: Response): Promise<void> => {
    const text = req.body?.text as string;
    const mode = (req.body?.mode as "rules" | "llm") ?? "rules";

    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "text obrigatorio" });
      return;
    }

    const result = await this.service.classify(text, mode);
    res.json(result);
  };
}

