import express from "express";
import cors from "cors";
import { createRoutes } from "./routes";
import { ChromaVectorDbService } from "./services/vector-db/chromaVectorDbService";
import { EmbeddingService } from "./services/llm/embeddingService";
import { RagService } from "./services/ragService";
import { LlmService } from "./services/llm/llmService";
import { ChatService } from "./services/chatService";
import { WhisperService } from "./services/whisper/whisperService";
import { ClassificationService } from "./services/classificationService";
import { DocumentController } from "./controllers/documentController";
import { ClassificationController } from "./controllers/classificationController";
import { ChatController } from "./controllers/chatController";
import { TranscribeController } from "./controllers/transcribeController";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ragRoutes = require("./routes/rag.routes");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const schemaRoutes = require("./routes/schema.routes");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const knowledgeRoutes = require("./routes/knowledge.routes");

export const buildApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  const vectorDb = new ChromaVectorDbService();
  const embeddingService = new EmbeddingService();
  const ragService = new RagService(vectorDb, embeddingService);
  const llmService = new LlmService();

  const documentController = new DocumentController(ragService);
  const classificationController = new ClassificationController(new ClassificationService(llmService));
  const chatController = new ChatController(new ChatService(ragService, llmService));
  const transcribeController = new TranscribeController(new WhisperService());

  app.use(
    "/api",
    createRoutes({
      documentController,
      classificationController,
      chatController,
      transcribeController,
    })
  );
  app.use("/rag", ragRoutes);
  app.use("/schema", schemaRoutes);
  app.use("/knowledge", knowledgeRoutes);

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: error.message ?? "Erro interno" });
  });

  return app;
};
