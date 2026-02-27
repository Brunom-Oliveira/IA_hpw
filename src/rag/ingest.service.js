const pdfParse = require("pdf-parse");
const { EmbeddingService } = require("./embedding.service");
const { SearchService } = require("./search.service");

class IngestService {
  constructor() {
    this.embeddingService = new EmbeddingService();
    this.searchService = new SearchService();
    this.chunkSize = Number(process.env.RAG_CHUNK_SIZE || 800);
  }

  chunkText(text) {
    const normalized = String(text || "").replace(/\s+/g, " ").trim();
    if (!normalized) return [];

    const chunks = [];
    for (let i = 0; i < normalized.length; i += this.chunkSize) {
      chunks.push(normalized.slice(i, i + this.chunkSize));
    }
    return chunks;
  }

  async extractPdfText(fileBuffer) {
    const parsed = await pdfParse(fileBuffer);
    return parsed.text || "";
  }

  async ingestPdf(file) {
    if (!file || !file.buffer) {
      throw new Error("Arquivo PDF nao enviado");
    }

    await this.searchService.ensureCollection();
    const text = await this.extractPdfText(file.buffer);
    const chunks = this.chunkText(text);
    if (chunks.length === 0) {
      return { source: file.originalname, chunks: 0 };
    }

    const createdAt = new Date().toISOString();
    const points = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunkText = chunks[index];
      const vector = await this.embeddingService.generateEmbedding(chunkText);
      points.push({
        id: `${Date.now()}-${index}-${Math.floor(Math.random() * 1e8)}`,
        vector,
        payload: {
          text: chunkText,
          source: file.originalname,
          chunk_index: index,
          created_at: createdAt,
        },
      });
    }

    await this.searchService.upsertPoints(points);
    return { source: file.originalname, chunks: chunks.length };
  }
}

module.exports = { IngestService };

