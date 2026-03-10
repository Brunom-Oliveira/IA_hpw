import { Router } from "express";
import multer from "multer";
import { DocumentController } from "../controllers/documentController";
import { ClassificationController } from "../controllers/classificationController";
import { ChatController } from "../controllers/chatController";
import { TranscribeController } from "../controllers/transcribeController";
import { FeedbackController } from "../controllers/feedbackController";
import { MetricsController } from "../controllers/metricsController";
import { adminGuard } from "../middleware/adminGuard";
import { validateRequest } from "../middleware/validateRequest";
import { InsertDocumentsSchema, RagSearchSchema } from "../schemas/documents.schema";
import { ChatAskSchema } from "../schemas/chat.schema";
import { FeedbackSchema } from "../schemas/feedback.schema";

export const createRoutes = (deps: {
  documentController: DocumentController;
  classificationController: ClassificationController;
  chatController: ChatController;
  transcribeController: TranscribeController;
  feedbackController: FeedbackController;
  metricsController: MetricsController;
}): Router => {
  const router = Router();
  const upload = multer({ dest: "uploads/" });

  router.post("/documents", validateRequest(InsertDocumentsSchema), deps.documentController.insertDocuments);
  router.post("/documents/upload-manual", upload.array("files"), deps.documentController.uploadManual);
  router.post("/search", validateRequest(RagSearchSchema), deps.documentController.search);
  router.post("/classify", deps.classificationController.classify);
  router.post("/chat", validateRequest(ChatAskSchema), deps.chatController.ask);
  router.get("/rag/stats", adminGuard, deps.chatController.diagnostics);
  router.post("/rag/reindex", adminGuard, deps.chatController.reindex);
  router.get("/rag/reindex/jobs/:jobId", adminGuard, deps.chatController.reindexJob);
  router.post("/rag/feedback", validateRequest(FeedbackSchema), deps.feedbackController.submit);
  router.get("/rag/metrics", adminGuard, deps.metricsController.prometheus);
  router.post("/transcribe", upload.single("audio"), deps.transcribeController.transcribe);
  router.get("/health", (_req, res) => res.json({ ok: true }));

  return router;
};
