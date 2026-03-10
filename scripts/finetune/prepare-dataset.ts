/**
 * Preparação de dataset para fine-tune.
 * - Lê arquivos JSONL em data/finetune/raw/*.jsonl
 * - Faz validação mínima dos campos esperados
 * - Gera data/finetune/dataset.jsonl consolidado
 *
 * Campos esperados em cada linha:
 * { instruction, context, response, sources?, mode? }
 */
import fs from "fs";
import path from "path";

type Example = {
  instruction: string;
  context?: string;
  response: string;
  sources?: string[];
  mode?: "schema" | "procedure" | "troubleshooting" | "general";
};

const RAW_DIR = path.resolve(process.cwd(), "data", "finetune", "raw");
const OUTPUT = path.resolve(process.cwd(), "data", "finetune", "dataset.jsonl");

function isExample(obj: any): obj is Example {
  return typeof obj?.instruction === "string" && typeof obj?.response === "string";
}

function readJsonl(file: string): Example[] {
  const content = fs.readFileSync(file, "utf-8");
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parsed: Example[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (isExample(obj)) {
        parsed.push(obj);
      } else {
        console.warn(`[prepare-dataset] Linha ignorada (campos faltando) em ${path.basename(file)}: ${line.slice(0, 80)}`);
      }
    } catch (err) {
      console.warn(`[prepare-dataset] Linha inválida em ${path.basename(file)}: ${line.slice(0, 80)}`);
    }
  }
  return parsed;
}

function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`[prepare-dataset] Pasta ${RAW_DIR} não encontrada. Crie data/finetune/raw e adicione JSONL de exemplos.`);
    process.exit(1);
  }

  const files = fs.readdirSync(RAW_DIR).filter((f) => f.toLowerCase().endsWith(".jsonl"));
  if (!files.length) {
    console.error("[prepare-dataset] Nenhum arquivo .jsonl encontrado em data/finetune/raw.");
    process.exit(1);
  }

  const all: Example[] = [];
  for (const file of files) {
    const full = path.join(RAW_DIR, file);
    const examples = readJsonl(full);
    all.push(...examples);
  }

  if (!all.length) {
    console.error("[prepare-dataset] Nenhum exemplo válido encontrado.");
    process.exit(1);
  }

  const seen = new Set<string>();
  const deduped: Example[] = [];
  for (const ex of all) {
    const key = `${ex.instruction.trim()}||${ex.response.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(ex);
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const out = deduped.map((ex) => JSON.stringify(ex)).join("\n");
  fs.writeFileSync(OUTPUT, out, "utf-8");

  console.info(`[prepare-dataset] Salvo ${deduped.length} exemplos em ${OUTPUT}`);
}

main();

