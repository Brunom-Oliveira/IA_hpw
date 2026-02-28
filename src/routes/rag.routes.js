const express = require("express");
const multer = require("multer");
const { IngestService } = require("../rag/ingest.service");
const { RagService } = require("../rag/rag.service");
const { createQuestionTokenGuardMiddleware } = require("../rag/tokenManager");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const ingestService = new IngestService();
const ragService = new RagService();

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Envie um PDF no campo file" });
    }

    const isPdf = req.file.mimetype === "application/pdf";
    if (!isPdf) {
      return res.status(400).json({ error: "Arquivo deve ser PDF" });
    }

    const result = await ingestService.ingestPdf(req.file);
    return res.status(201).json({
      message: "PDF processado com sucesso",
      ...result,
    });
  } catch (error) {
    console.error("[rag][upload] Falha:", error.message);
    return res.status(500).json({ error: "Falha ao processar PDF" });
  }
});

const enableTokenGuard = String(process.env.RAG_ENABLE_TOKEN_GUARD || "false").toLowerCase() === "true";
const askMiddlewares = [];

if (enableTokenGuard) {
  askMiddlewares.push(createQuestionTokenGuardMiddleware());
}

router.post("/ask", ...askMiddlewares, async (req, res) => {
  try {
    const { question, topK } = req.body || {};
    if (!question) {
      return res.status(400).json({ error: "Campo question e obrigatorio" });
    }

    const result = await ragService.ask(question, topK);
    return res.json(result);
  } catch (error) {
    console.error("[rag][ask] Falha:", error.message);
    return res.status(error.statusCode || 500).json({ error: error.message || "Falha ao responder pergunta" });
  }
});

module.exports = router;
