const express = require("express");
const { SchemaIngestService } = require("../schema/schema.ingest.service");
const { parseDDL } = require("../sql/sqlParser");
const { transformDDLToDocuments } = require("../sql/ddlTransformer");
const { indexSchemaDocuments } = require("../sql/schemaIndexer");

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

router.post("/upload", async (req, res) => {
  try {
    const { sql } = req.body || {};
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ error: "Campo sql obrigatorio" });
    }

    const parsed = parseDDL(sql);
    if (!parsed.tables.length) {
      return res.status(400).json({ error: "Nenhuma tabela CREATE TABLE encontrada no script" });
    }

    const documents = transformDDLToDocuments(parsed);
    const indexing = await indexSchemaDocuments(documents);

    return res.status(201).json({
      message: "DDL processado e indexado com sucesso",
      summary: {
        tables_found: parsed.tables.length,
        documents_generated: documents.length,
        indexed_points: indexing.indexed_points,
      },
      tables: parsed.tables.map((table) => ({
        schema: table.schema,
        table_name: table.table_name,
        columns: table.columns.length,
        primary_key: table.primary_key,
        foreign_keys: table.foreign_keys.length,
        indexes: table.indexes.length,
        triggers: table.triggers.length,
        checks: table.check_constraints.length,
      })),
    });
  } catch (error) {
    console.error("[schema][upload] Falha:", error.message);
    return res.status(500).json({ error: "Falha ao processar DDL", details: error.message });
  }
});

module.exports = router;
