import { Request, Response } from "express";
import { PdfIngestService } from "../services/pdfIngestService";
import { RagService } from "../services/ragService";

export class PublicRagController {
  constructor(
    private readonly ragService: RagService,
    private readonly pdfIngestService: PdfIngestService,
  ) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { question, topK } = req.body || {};
      if (!question || typeof question !== "string") {
        res.status(400).json({ error: "Campo question e obrigatorio" });
        return;
      }

      const result = await this.ragService.ask(question, Number(topK));
      res.json(result);
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error?.message || "Falha ao responder pergunta",
      });
    }
  };

  uploadPdf = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Envie um PDF no campo file" });
        return;
      }

      const isPdf = req.file.mimetype === "application/pdf"
        || String(req.file.originalname || "").toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        res.status(400).json({ error: "Arquivo deve ser PDF" });
        return;
      }

      const result = await this.pdfIngestService.ingestPdf(req.file);
      res.status(201).json({
        message: "PDF processado com sucesso",
        ...result,
      });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error?.message || "Falha ao processar PDF",
      });
    }
  };
}
