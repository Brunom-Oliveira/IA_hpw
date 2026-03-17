import { Request, Response } from "express";
import { singleton, inject } from "tsyringe";
import { KnowledgeService } from "../services/knowledgeService";

@singleton()
export class KnowledgeController {
  constructor(@inject(KnowledgeService) private readonly knowledgeService: KnowledgeService) {}

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

      const sqlText = this.decodeSqlBuffer(req.file.buffer);
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

  /**
   * Decodifica buffer de arquivo SQL tratando BOM/UTF-16 (comum em dumps do SQL Server).
   * Fallback para UTF-8 se nada especial for detectado.
   */
  private decodeSqlBuffer(buffer: Buffer): string {
    if (!buffer || buffer.length === 0) return "";

    // BOM UTF-8
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.slice(3).toString("utf8");
    }

    // BOM UTF-16 LE / BE
    if (buffer.length >= 2) {
      const bom = buffer.slice(0, 2);
      if (bom[0] === 0xff && bom[1] === 0xfe) return buffer.slice(2).toString("utf16le");
      if (bom[0] === 0xfe && bom[1] === 0xff) {
        // UTF-16 BE -> converter para LE antes de decodificar
        const be = buffer.slice(2);
        const le = Buffer.alloc(be.length);
        for (let i = 0; i < be.length; i += 2) {
          le[i] = be[i + 1];
          le[i + 1] = be[i];
        }
        return le.toString("utf16le");
      }
    }

    // Heurística: muitos bytes zero => provavelmente UTF-16 LE
    const sample = buffer.slice(0, Math.min(buffer.length, 200));
    const zeroBytes = sample.filter((b) => b === 0x00).length;
    if (zeroBytes > sample.length * 0.2) {
      return buffer.toString("utf16le");
    }

    return buffer.toString("utf8");
  }

  items = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : "";
      const items = await this.knowledgeService.listItems(category);
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Falha ao listar itens" });
    }
  };

  schemaItems = async (req: Request, res: Response): Promise<void> => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : "";
      const items = await this.knowledgeService.listSchemaItems(category);
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Falha ao listar schemas" });
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

  schemaStats = async (_req: Request, res: Response): Promise<void> => {
    try {
      const stats = await this.knowledgeService.getSchemaStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Falha ao gerar estatisticas de schema" });
    }
  };
}
