const express = require("express");
const multer = require("multer");
const { KnowledgeService } = require("../knowledge/knowledge.service");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });
const knowledgeService = new KnowledgeService();

router.post("/manual", async (req, res) => {
  try {
    const result = await knowledgeService.ingestManual(req.body || {});
    return res.status(201).json({
      message: "Conhecimento indexado com sucesso",
      ...result,
    });
  } catch (error) {
    console.error("[knowledge][manual] Falha:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao inserir conhecimento",
    });
  }
});

router.post("/upload-audio", async (req, res) => {
  try {
    const { transcription, system, module } = req.body || {};
    const result = await knowledgeService.ingestAudioTranscription(transcription, { system, module });
    return res.status(201).json({
      message: "Transcricao estruturada e indexada",
      ...result,
    });
  } catch (error) {
    console.error("[knowledge][upload-audio] Falha:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao processar transcricao",
    });
  }
});

router.post("/upload-sql", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo SQL obrigatorio no campo file" });
    }
    if (!String(req.file.originalname || "").toLowerCase().endsWith(".sql")) {
      return res.status(400).json({ error: "Arquivo deve ter extensao .sql" });
    }

    const sqlText = req.file.buffer.toString("utf-8");
    const result = await knowledgeService.ingestSqlContent(sqlText, req.file.originalname);
    return res.status(201).json({
      message: "Schema SQL processado e indexado",
      ...result,
    });
  } catch (error) {
    console.error("[knowledge][upload-sql] Falha:", error.message);
    return res.status(error.statusCode || 500).json({
      error: error.message || "Falha ao processar SQL",
    });
  }
});

router.get("/items", async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const items = await knowledgeService.listItems(category);
    return res.json({ items });
  } catch (error) {
    console.error("[knowledge][items] Falha:", error.message);
    return res.status(500).json({ error: "Falha ao listar itens" });
  }
});

router.get("/stats", async (_req, res) => {
  try {
    const stats = await knowledgeService.getStats();
    return res.json(stats);
  } catch (error) {
    console.error("[knowledge][stats] Falha:", error.message);
    return res.status(500).json({ error: "Falha ao gerar estatisticas" });
  }
});

module.exports = router;
