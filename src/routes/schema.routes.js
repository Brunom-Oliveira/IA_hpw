const express = require("express");
const { SchemaIngestService } = require("../schema/schema.ingest.service");

const router = express.Router();
const schemaIngestService = new SchemaIngestService();

router.post("/ingest", async (_req, res) => {
  try {
    const result = await schemaIngestService.ingestFromSqlFile();
    return res.json({
      message: "Schema SQL processado e indexado com sucesso",
      ...result,
    });
  } catch (error) {
    console.error("[schema][route] Falha no ingest:", error.message);
    return res.status(500).json({
      error: "Falha ao processar schema SQL",
      details: error.message,
    });
  }
});

module.exports = router;
