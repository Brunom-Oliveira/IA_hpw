import "reflect-metadata";
import express from "express";
import cors from "cors";
import { container } from "tsyringe";
import { createRoutes } from "./routes";
import { createCompatibilityRoutes } from "./routes/compatibility";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestIdMiddleware } from "./middleware/requestIdMiddleware";
import { streamingTimeoutMiddleware } from "./middleware/streamingTimeout";
import {
  apiLimiter,
  uploadLimiter,
  transcribeLimiter,
  adminLimiter,
} from "./middleware/rateLimiter";
import { QdrantVectorDbService } from "./services/vector-db/qdrantVectorDbService";
import { LlmService } from "./services/llm/llmService";
import { WhisperService } from "./services/whisper/whisperService";
import { DocumentController } from "./controllers/documentController";
import { ClassificationController } from "./controllers/classificationController";
import { ChatController } from "./controllers/chatController";
import { TranscribeController } from "./controllers/transcribeController";
import { KnowledgeController } from "./controllers/knowledgeController";
import { SchemaController } from "./controllers/schemaController";
import { PublicRagController } from "./controllers/publicRagController";
import { FeedbackController } from "./controllers/feedbackController";
import { MetricsController } from "./controllers/metricsController";
import { RagMetadataReindexService } from "./services/ragMetadataReindexService";
import { RagReindexQueueService } from "./services/ragReindexQueueService";
import { cacheWarmingService } from "./services/cacheWarmingService";
import { RagService } from "./services/ragService";

export const buildApp = () => {
  // Configure tsyringe container
  container.register("VectorDbPort", { useClass: QdrantVectorDbService });
  container.register("LlmPort", { useClass: LlmService });
  container.register(WhisperService, { useClass: WhisperService });
  container.register(RagMetadataReindexService, { useClass: RagMetadataReindexService });
  container.register(RagReindexQueueService, { useClass: RagReindexQueueService });

  const app = express();

  // Permitir identificar IP real atrás de proxy/load balancer (necessário para rate limiting)
  app.set("trust proxy", true);

  // Ordem importa: primeiro requestId para logs/erros
  app.use(requestIdMiddleware);
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(streamingTimeoutMiddleware()); // Proteção de timeout para streams [PERF-002]

  // Rate Limiting [PERF-001]
  app.use("/api", apiLimiter); // Limiter geral (100 req/15 min)
  app.use("/api/documents/upload-manual", uploadLimiter); // Uploads (50/hora)
  app.use("/api/documents/upload-sql", uploadLimiter); // Uploads (50/hora)
  app.use("/api/documents/upload-audio", uploadLimiter); // Uploads (50/hora)
  app.use("/api/transcribe", transcribeLimiter); // Transcrição (20/hora)

  // Resolve controllers from container
  const documentController = container.resolve(DocumentController);
  const classificationController = container.resolve(ClassificationController);
  const chatController = container.resolve(ChatController);
  const transcribeController = container.resolve(TranscribeController);
  const knowledgeController = container.resolve(KnowledgeController);
  const schemaController = container.resolve(SchemaController);
  const publicRagController = container.resolve(PublicRagController);
  const feedbackController = container.resolve(FeedbackController);
  const metricsController = container.resolve(MetricsController);

  app.use(
    "/api",
    createRoutes({
      documentController,
      classificationController,
      chatController,
      transcribeController,
      feedbackController,
      metricsController,
    }),
  );
  app.use(
    "/",
    createCompatibilityRoutes({
      knowledgeController,
      schemaController,
      publicRagController,
    }),
  );

  // Middleware para capturar 404
  app.use(notFoundHandler);

  // Global error handler (DEVE SER O ÚLTIMO MIDDLEWARE)
  app.use(errorHandler);

  // Cache Warming [CACHE-001]: Pré-aquecimento assíncrono
  const ragService = container.resolve(RagService);
  cacheWarmingService.warmupAsync(ragService).catch((err) => {
    console.warn("[app] Erro na inicialização de cache warming:", err?.message);
  });

  return app;
};
