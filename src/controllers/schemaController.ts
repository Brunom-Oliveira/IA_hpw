import { Request, Response } from "express";
import { singleton } from "tsyringe";
import { SchemaService } from "../services/schemaService";

@singleton()
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}

  ingest = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.schemaService.ingestFromSqlFile();
      res.json({
        message: "Schema SQL processado e indexado com sucesso",
        ...(result as Record<string, unknown>),
      });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: "Falha ao processar schema SQL",
        details: error?.message,
      });
    }
  };

  upload = async (req: Request, res: Response): Promise<void> => {
    try {
      const { sql } = req.body || {};
      if (!sql || typeof sql !== "string") {
        res.status(400).json({ error: "Campo sql obrigatorio" });
        return;
      }

      const result = await this.schemaService.uploadSql(sql);
      res.status(201).json({
        message: "DDL processado e indexado com sucesso",
        ...result,
      });
    } catch (error: any) {
      res.status(error?.statusCode || 500).json({
        error: error?.message || "Falha ao processar DDL",
      });
    }
  };
}
