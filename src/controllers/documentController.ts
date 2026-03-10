import { Request, Response } from "express";
import { promises as fs } from "node:fs";
import { singleton, inject } from "tsyringe";
import { RagService } from "../services/ragService";
import { buildRagMetadata } from "../utils/ragMetadata";
import { validateFiles } from "../utils/fileValidator";

const MANUAL_CHUNK_SIZE = Number(process.env.MANUAL_UPLOAD_CHUNK_SIZE || 2500);
const MANUAL_CHUNK_OVERLAP = Number(
  process.env.MANUAL_UPLOAD_CHUNK_OVERLAP || 250,
);

@singleton()
export class DocumentController {
  constructor(@inject(RagService) private readonly ragService: RagService) {}

  insertDocuments = async (req: Request, res: Response): Promise<void> => {
    const documents = req.body?.documents as Array<{
      text: string;
      metadata?: Record<string, string | number | boolean>;
    }>;

    if (!Array.isArray(documents) || documents.length === 0) {
      res.status(400).json({ error: "documents deve ser um array nao vazio" });
      return;
    }

    const valid = documents.every(
      (doc) => typeof doc.text === "string" && doc.text.trim().length > 0,
    );
    if (!valid) {
      res.status(400).json({ error: "Cada documento deve possuir campo text" });
      return;
    }

    const ids = await this.ragService.insertDocuments(documents);
    res.status(201).json({ inserted: ids.length, ids });
  };

  uploadManual = async (req: Request, res: Response): Promise<void> => {
    const files = this.extractUploadedFiles(req);
    if (!files.length) {
      res
        .status(400)
        .json({ error: "Arquivo(s) obrigatório(s) no campo files" });
      return;
    }

    // Validar arquivos
    const { valid, invalid } = validateFiles(files);

    if (invalid.length > 0 && valid.length === 0) {
      res.status(400).json({
        error: "Nenhum arquivo válido",
        details: invalid.map((item) => ({
          filename: item.file.originalname,
          error: item.error,
        })),
      });
      // Limpar arquivos inválidos
      for (const file of files) {
        await fs.unlink(file.path).catch(() => undefined);
      }
      return;
    }

    const system = String(req.body?.system || "HARPIA WMS").trim();
    const module = String(req.body?.module || "Manual").trim();
    const sourceOverride = String(req.body?.source || "").trim();
    const titleOverride = String(req.body?.title || "").trim();

    const items: Array<Record<string, unknown>> = [];
    let totalInserted = 0;
    let totalChunks = 0;
    let failures = 0;

    // Processar apenas arquivos válidos
    for (const file of valid) {
      try {
        const item = await this.processManualFile(file, {
          system,
          module,
          sourceOverride,
          titleOverride,
        });
        items.push(item);
        totalInserted += Number(item.inserted || 0);
        totalChunks += Number(item.chunks || 0);
      } catch (error) {
        failures += 1;
        items.push({
          file_name: file.originalname,
          status: "error",
          error: (error as Error)?.message || "Falha ao processar arquivo",
        });
      } finally {
        await fs.unlink(file.path).catch(() => undefined);
      }
    }

    // Adicionar inválidos no resultado
    for (const { file, error } of invalid) {
      items.push({
        file_name: file.originalname,
        status: "error",
        error,
      });
      failures += 1;
    }

    const statusCode = totalInserted > 0 ? 201 : 400;
    res.status(statusCode).json({
      message:
        totalInserted > 0
          ? "Manual(is) indexado(s) com sucesso"
          : "Nenhum arquivo válido foi indexado",
      total_files: files.length,
      processed_files: valid.length,
      failed_files: failures,
      total_chunks: totalChunks,
      inserted: totalInserted,
      items,
    });
  };

  search = async (req: Request, res: Response): Promise<void> => {
    const query = req.body?.query as string;
    const topK = Number(req.body?.topK ?? 4);

    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query obrigatoria" });
      return;
    }

    const results = await this.ragService.search(query, topK);
    res.json({ query, results });
  };

  private extractUploadedFiles(req: Request): Express.Multer.File[] {
    const filesFromArray = req.files as Express.Multer.File[] | undefined;
    if (Array.isArray(filesFromArray) && filesFromArray.length)
      return filesFromArray;

    const singleFile = req.file as Express.Multer.File | undefined;
    return singleFile ? [singleFile] : [];
  }

  private async processManualFile(
    file: Express.Multer.File,
    options: {
      system: string;
      module: string;
      sourceOverride: string;
      titleOverride: string;
    },
  ): Promise<Record<string, unknown>> {
    const originalName = String(file.originalname || "");
    const lowerName = originalName.toLowerCase();

    if (!(lowerName.endsWith(".md") || lowerName.endsWith(".txt"))) {
      throw new Error("Arquivo deve ser .md ou .txt");
    }

    const raw = await fs.readFile(file.path, "utf-8");
    const text = String(raw || "")
      .replace(/\r/g, "")
      .trim();
    if (!text) throw new Error("Arquivo vazio");

    const chunks = splitIntoChunks(
      text,
      Number.isFinite(MANUAL_CHUNK_SIZE) ? MANUAL_CHUNK_SIZE : 2500,
      Number.isFinite(MANUAL_CHUNK_OVERLAP) ? MANUAL_CHUNK_OVERLAP : 250,
    );
    if (!chunks.length) throw new Error("Nao foi possivel gerar chunks");

    const source = options.sourceOverride || originalName || "manual.md";
    const title = options.titleOverride || originalName || "Manual";

    const documents = chunks.map((chunk, index) => ({
      text: chunk,
      metadata: buildRagMetadata({
        source,
        title,
        category: "manual",
        system: options.system,
        module: options.module,
        fileName: originalName,
        chunk: index + 1,
        totalChunks: chunks.length,
        text: chunk,
      }),
    }));

    const ids = await this.ragService.insertDocuments(documents);
    return {
      file_name: originalName,
      status: "ok",
      chunks: chunks.length,
      inserted: ids.length,
      ids,
    };
  }
}

function splitIntoChunks(
  text: string,
  chunkSize: number,
  overlap: number,
): string[] {
  const normalized = String(text || "").trim();
  if (!normalized) return [];

  const maxSize = Math.max(600, chunkSize);
  const safeOverlap = Math.max(0, Math.min(Math.floor(maxSize / 3), overlap));
  const step = Math.max(200, maxSize - safeOverlap);

  const chunks: string[] = [];
  for (let start = 0; start < normalized.length; start += step) {
    const end = Math.min(normalized.length, start + maxSize);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= normalized.length) break;
  }

  return chunks;
}
