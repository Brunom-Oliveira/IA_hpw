import { Request, Response } from "express";
import { singleton } from "tsyringe";
import { RagService } from "../services/ragService";
import { RagReindexQueueService } from "../services/ragReindexQueueService";
import { STREAMING_TIMEOUT_CONFIG } from "../middleware/streamingTimeout";
import { env } from "../utils/env";

@singleton()
export class ChatController {
  constructor(
    private readonly ragService: RagService,
    private readonly ragReindexQueueService: RagReindexQueueService,
  ) {}

  ask = async (req: Request, res: Response): Promise<void> => {
    const { message, topK, stream, timeoutMs } = req.body;

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
      
      // Configurar timeout customizável (padrão 5 minutos)
      const customTimeout = typeof timeoutMs === "number" && timeoutMs > 0 
        ? timeoutMs 
        : env.chatStreamTimeoutMs || STREAMING_TIMEOUT_CONFIG["/api/chat/ask"];
      
      let streamCompleted = false;
      let streamStartedAt = Date.now();

      // Heartbeat para manter conexão viva
      const heartbeat = setInterval(() => {
        if (!res.writableEnded && !streamCompleted) {
          const elapsedMs = Date.now() - streamStartedAt;
          res.write(
            `data: ${JSON.stringify({ 
              type: "heartbeat", 
              ts: Date.now(),
              elapsedMs 
            })}\n\n`
          );
        }
      }, 15000);

      // Timeout de stream
      const timeoutHandle = setTimeout(() => {
        if (!streamCompleted && !res.writableEnded) {
          streamCompleted = true;
          res.write(
            `data: ${JSON.stringify({ 
              type: "timeout", 
              message: `Stream timeout após ${customTimeout}ms`,
              elapsedMs: Date.now() - streamStartedAt 
            })}\n\n`
          );
          if (!res.writableEnded) {
            res.end();
          }
        }
        abortController.abort();
      }, customTimeout);

      const closeStream = () => {
        clearInterval(heartbeat);
        clearTimeout(timeoutHandle);
        abortController.abort();
        streamCompleted = true;
      };

      req.on("close", closeStream);
      req.on("aborted", closeStream);

      try {
        res.write(`data: ${JSON.stringify({ 
          type: "status", 
          phase: "Conexao estabelecida",
          timeoutMs: customTimeout 
        })}\n\n`);
        
        await this.ragService.askStream(message, (chunk) => {
          if (!res.writableEnded && !streamCompleted) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            
            // Resetar timeout se receive é progressivo
            if (chunk.content) {
              clearTimeout(timeoutHandle);
            }
          }
        }, topK, { signal: abortController.signal });
        
        streamCompleted = true;
        if (!res.writableEnded) {
          res.end();
        }
      } catch (error: any) {
        streamCompleted = true;
        
        // Não reescrever se já foi abortado por timeout
        if (!abortController.signal.aborted && !res.writableEnded) {
          const errorType = error.message?.includes("timeout") 
            ? "timeout" 
            : "error";
          
          res.write(
            `data: ${JSON.stringify({ 
              type: errorType,
              error: error.message,
              elapsedMs: Date.now() - streamStartedAt 
            })}\n\n`
          );
          res.end();
        }
      } finally {
        clearInterval(heartbeat);
        clearTimeout(timeoutHandle);
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
