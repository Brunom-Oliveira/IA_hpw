import pdfParse from "pdf-parse";
import { RagService } from "./ragService";
import { env } from "../utils/env";
import { buildRagMetadata } from "../utils/ragMetadata";

export class PdfIngestService {
  constructor(private readonly ragService: RagService) {}

  async ingestPdf(file: Express.Multer.File): Promise<{ source: string; chunks: number; inserted: number; ids: string[] }> {
    if (!file?.buffer) {
      throw new Error("Arquivo PDF nao enviado");
    }

    const parsed = await pdfParse(file.buffer);
    const rawText = String(parsed.text || "").replace(/\s+/g, " ").trim();
    if (!rawText) {
      return { source: file.originalname, chunks: 0, inserted: 0, ids: [] };
    }

    const chunks = splitText(rawText, env.chunkSize, env.chunkOverlap);
    const documents = chunks.map((chunk, index) => ({
      text: chunk,
      metadata: buildRagMetadata({
        source: file.originalname,
        title: file.originalname,
        category: "manual_pdf",
        system: "HARPIA WMS",
        module: "PDF",
        fileName: file.originalname,
        chunk: index + 1,
        totalChunks: chunks.length,
        text: chunk,
      }),
    }));

    const ids = await this.ragService.insertDocuments(documents);
    return {
      source: file.originalname,
      chunks: chunks.length,
      inserted: ids.length,
      ids,
    };
  }
}

function splitText(text: string, chunkSize: number, overlap: number): string[] {
  const normalized = String(text || "").trim();
  if (!normalized) return [];

  const maxSize = Math.max(400, chunkSize);
  const safeOverlap = Math.max(0, Math.min(Math.floor(maxSize / 2), overlap));
  const step = Math.max(100, maxSize - safeOverlap);

  const parts: string[] = [];
  for (let start = 0; start < normalized.length; start += step) {
    const end = Math.min(normalized.length, start + maxSize);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) parts.push(chunk);
    if (end >= normalized.length) break;
  }

  return parts;
}
