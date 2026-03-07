import { Router } from "express";
import multer from "multer";
import { KnowledgeController } from "../controllers/knowledgeController";
import { PublicRagController } from "../controllers/publicRagController";
import { SchemaController } from "../controllers/schemaController";

export const createCompatibilityRoutes = (deps: {
  knowledgeController: KnowledgeController;
  schemaController: SchemaController;
  publicRagController: PublicRagController;
}): Router => {
  const router = Router();
  const memoryUpload = multer({ storage: multer.memoryStorage() });

  router.post("/knowledge/manual", deps.knowledgeController.manual);
  router.post("/knowledge/upload-audio", deps.knowledgeController.uploadAudio);
  router.post("/knowledge/auto-audio", deps.knowledgeController.autoAudio);
  router.post("/knowledge/upload-sql", memoryUpload.single("file"), deps.knowledgeController.uploadSql);
  router.get("/knowledge/items", deps.knowledgeController.items);
  router.get("/knowledge/stats", deps.knowledgeController.stats);

  router.post("/schema/ingest", deps.schemaController.ingest);
  router.post("/schema/upload", deps.schemaController.upload);

  router.post("/rag/ask", deps.publicRagController.ask);
  router.post("/rag/upload", memoryUpload.single("file"), deps.publicRagController.uploadPdf);

  return router;
};
