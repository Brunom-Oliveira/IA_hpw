import express from "express";
import cors from "cors";
import { createRoutes } from "./routes";
import { createCompatibilityRoutes } from "./routes/compatibility";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { QdrantVectorDbService } from "./services/vector-db/qdrantVectorDbService";
import { EmbeddingService } from "./services/llm/embeddingService";
import { RagService } from "./services/ragService";
import { LlmService } from "./services/llm/llmService";
import { WhisperService } from "./services/whisper/whisperService";
import { ClassificationService } from "./services/classificationService";
import { DocumentController } from "./controllers/documentController";
import { ClassificationController } from "./controllers/classificationController";
import { ChatController } from "./controllers/chatController";
import { TranscribeController } from "./controllers/transcribeController";
import { PdfIngestService } from "./services/pdfIngestService";
import { KnowledgeController } from "./controllers/knowledgeController";
import { SchemaController } from "./controllers/schemaController";
import { PublicRagController } from "./controllers/publicRagController";
import { KnowledgeService } from "./services/knowledgeService";
import { SchemaService } from "./services/schemaService";
import { RagMetadataReindexService } from "./services/ragMetadataReindexService";
import { RagReindexQueueService } from "./services/ragReindexQueueService";

export const buildApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  const vectorDb = new QdrantVectorDbService();
  const embeddingService = new EmbeddingService();
  const llmService = new LlmService();
  const ragService = new RagService(vectorDb, embeddingService, llmService);
  const ragMetadataReindexService = new RagMetadataReindexService();
  const ragReindexQueueService = new RagReindexQueueService(
    ragMetadataReindexService,
  );

  const documentController = new DocumentController(ragService);
  const classificationController = new ClassificationController(
    new ClassificationService(llmService),
  );
  const chatController = new ChatController(ragService, ragReindexQueueService);
  const transcribeController = new TranscribeController(new WhisperService());
  const knowledgeController = new KnowledgeController(
    new KnowledgeService(embeddingService, llmService),
  );
  const schemaController = new SchemaController(
    new SchemaService(embeddingService),
  );
  const publicRagController = new PublicRagController(
    ragService,
    new PdfIngestService(ragService),
  );

  app.use(
    "/api",
    createRoutes({
      documentController,
      classificationController,
      chatController,
      transcribeController,
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

  return app;
};
