import path from "path";
import { promises as fs } from "fs";
import pdfParse from "pdf-parse";
import { ChromaVectorDbService } from "../services/vector-db/chromaVectorDbService";
import { EmbeddingService } from "../services/llm/embeddingService";
import { RagService } from "../services/ragService";
import { chunkText } from "../utils/text";
import { env } from "../utils/env";

const supportedFiles = [".txt", ".md", ".pdf"];

const readFileContent = async (filePath: string): Promise<string> => {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".pdf") {
    const buffer = await fs.readFile(filePath);
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  return fs.readFile(filePath, "utf-8");
};

const run = async () => {
  const targetDir = path.resolve(process.cwd(), "data/documents");
  const files = await fs.readdir(targetDir);

  const ragService = new RagService(new ChromaVectorDbService(), new EmbeddingService());
  const docs: Array<{ text: string; metadata: Record<string, string> }> = [];

  for (const fileName of files) {
    const fullPath = path.join(targetDir, fileName);
    const ext = path.extname(fileName).toLowerCase();
    if (!supportedFiles.includes(ext)) continue;

    const content = await readFileContent(fullPath);
    // Chunking curto para reduzir custo de embedding e melhorar recall no RAG.
    const chunks = chunkText(content, env.chunkSize, env.chunkOverlap);

    for (let index = 0; index < chunks.length; index += 1) {
      docs.push({
        text: chunks[index],
        metadata: {
          source: fileName,
          chunk: String(index),
        },
      });
    }
  }

  if (docs.length === 0) {
    console.log("[indexer] Nenhum documento valido encontrado em data/documents");
    return;
  }

  const ids = await ragService.insertDocuments(docs);
  console.log(`[indexer] ${ids.length} chunks indexados com sucesso`);
};

run().catch((error) => {
  console.error("[indexer] Erro:", error);
  process.exit(1);
});
