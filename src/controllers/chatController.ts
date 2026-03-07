import { Request, Response } from "express";
import { RagService } from "../services/ragService";
import { RagReindexQueueService } from "../services/ragReindexQueueService";

export class ChatController {
  constructor(
    private readonly ragService: RagService,
    private readonly ragReindexQueueService: RagReindexQueueService,
  ) {}

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
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      const abortController = new AbortController();
      const heartbeat = setInterval(() => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`);
        }
      }, 15000);

      const closeStream = () => {
        clearInterval(heartbeat);
        abortController.abort();
      };

      req.on("close", closeStream);
      req.on("aborted", closeStream);

      try {
        res.write(`data: ${JSON.stringify({ type: "status", phase: "Conexao estabelecida" })}\n\n`);
        await this.ragService.askStream(message, (chunk) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        }, topK, { signal: abortController.signal });
        res.end();
      } catch (error: any) {
        if (!abortController.signal.aborted && !res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
          res.end();
        }
      } finally {
        clearInterval(heartbeat);
        req.off("close", closeStream);
        req.off("aborted", closeStream);
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

  diagnostics = (_req: Request, res: Response): void => {
    res.json(this.ragService.getDiagnostics());
  };

  reindex = async (_req: Request, res: Response): Promise<void> => {
    const job = this.ragReindexQueueService.enqueue();
    res.status(202).json({
      message: "Reindexacao enfileirada",
      job,
    });
  };

  reindexJob = async (req: Request, res: Response): Promise<void> => {
    const jobId = String(req.params.jobId || "").trim();
    const job = this.ragReindexQueueService.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "Job de reindexacao nao encontrado" });
      return;
    }

    res.json({ job });
  };
}
