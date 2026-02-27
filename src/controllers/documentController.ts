import { Request, Response } from "express";
import { RagService } from "../services/ragService";

export class DocumentController {
  constructor(private readonly ragService: RagService) {}

  insertDocuments = async (req: Request, res: Response): Promise<void> => {
    const documents = req.body?.documents as Array<{ text: string; metadata?: Record<string, string | number | boolean> }>;

    if (!Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: "documents deve ser um array nao vazio" });
      return;
    }

    const valid = documents.every((doc) => typeof doc.text === "string" && doc.text.trim().length > 0);
    if (!valid) {
      res.status(400).json({ error: "Cada documento deve possuir campo text" });
      return;
    }

    const ids = await this.ragService.insertDocuments(documents);
    res.status(201).json({ inserted: ids.length, ids });
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const query = req.body?.query as string;
    const topK = Number(req.body?.topK ?? 4);

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query obrigatoria" });
      return;
    }

    const results = await this.ragService.searchContext(query, topK);
    res.json({ query, results });
  };
}

