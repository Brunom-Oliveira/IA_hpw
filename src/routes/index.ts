import { Router } from "express";
import multer from "multer";
import { DocumentController } from "../controllers/documentController";
import { ClassificationController } from "../controllers/classificationController";
import { ChatController } from "../controllers/chatController";
import { TranscribeController } from "../controllers/transcribeController";
import { adminGuard } from "../middleware/adminGuard";

export const createRoutes = (deps: {
  documentController: DocumentController;
  classificationController: ClassificationController;
  chatController: ChatController;
  transcribeController: TranscribeController;
}): Router => {
  const router = Router();
  const upload = multer({ dest: "uploads/" });

  router.post("/documents", deps.documentController.insertDocuments);
  router.post("/documents/upload-manual", upload.array("files"), deps.documentController.uploadManual);
  router.post("/search", deps.documentController.search);
  router.post("/classify", deps.classificationController.classify);
  router.post("/chat", deps.chatController.ask);
  router.get("/rag/stats", adminGuard, deps.chatController.diagnostics);
  router.post("/rag/reindex", adminGuard, deps.chatController.reindex);
  router.get("/rag/reindex/jobs/:jobId", adminGuard, deps.chatController.reindexJob);
  router.post("/transcribe", upload.single("audio"), deps.transcribeController.transcribe);
  router.get("/health", (_req, res) => res.json({ ok: true }));

  return router;
};
