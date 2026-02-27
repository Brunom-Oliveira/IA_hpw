import { Router } from "express";
import multer from "multer";
import { DocumentController } from "../controllers/documentController";
import { ClassificationController } from "../controllers/classificationController";
import { ChatController } from "../controllers/chatController";
import { TranscribeController } from "../controllers/transcribeController";

export const createRoutes = (deps: {
  documentController: DocumentController;
  classificationController: ClassificationController;
  chatController: ChatController;
  transcribeController: TranscribeController;
}): Router => {
  const router = Router();
  const upload = multer({ dest: "uploads/" });

  router.post("/documents", deps.documentController.insertDocuments);
  router.post("/search", deps.documentController.search);
  router.post("/classify", deps.classificationController.classify);
  router.post("/chat", deps.chatController.ask);
  router.post("/transcribe", upload.single("audio"), deps.transcribeController.transcribe);
  router.get("/health", (_req, res) => res.json({ ok: true }));

  return router;
};

