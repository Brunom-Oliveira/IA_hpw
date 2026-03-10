import { Request, Response } from "express";
import { singleton } from "tsyringe";
import { KnowledgeService } from "../services/knowledgeService";

@singleton()
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  manual = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.knowledgeService.ingestManual(req.body || {});
      res.status(201).json({
        message: "Conhecimento indexado com sucesso",
        ...(result as Record<string, unknown>),
      });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error?.message || "Falha ao inserir conhecimento",
      });
    }
  };

  uploadAudio = async (req: Request, res: Response): Promise<void> => {
    try {
      const { transcription, system, module } = req.body || {};
      const result = await this.knowledgeService.ingestAudioTranscription(String(transcription || ""), { system, module });
      res.status(201).json({
        message: "Transcricao estruturada e indexada",
        ...(result as Record<string, unknown>),
      });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error?.message || "Falha ao processar transcricao",
      });
    }
  };

  autoAudio = async (req: Request, res: Response): Promise<void> => {
    try {
      const { transcription, system, module, save_to_knowledge } = req.body || {};
      const result = await this.knowledgeService.autoProcessAudioTranscription(
        String(transcription || ""),
        { system, module },
        { save_to_knowledge },
      );

      const payload = result as Record<string, unknown>;
      res.status(200).json({
        message: payload.saved
          ? "Transcricao processada e salva automaticamente"
          : "Transcricao processada automaticamente",
        ...payload,
      });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error?.message || "Falha ao processar transcricao automatica",
      });
    }
  };

  uploadSql = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "Arquivo SQL obrigatorio no campo file" });
        return;
      }

      if (!String(req.file.originalname || "").toLowerCase().endsWith(".sql")) {
        res.status(400).json({ error: "Arquivo deve ter extensao .sql" });
        return;
      }

      const sqlText = req.file.buffer.toString("utf-8");
      const result = await this.knowledgeService.ingestSqlContent(sqlText, req.file.originalname);
      res.status(201).json({
        message: "Schema SQL processado e indexado",
        ...(result as Record<string, unknown>),
      });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error?.message || "Falha ao processar SQL",
      });
    }
  };

  items = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : "";
      const items = await this.knowledgeService.listItems(category);
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Falha ao listar itens" });
    }
  };

  stats = async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.knowledgeService.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Falha ao gerar estatisticas" });
    }
  };
}
