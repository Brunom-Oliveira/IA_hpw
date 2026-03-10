/**
 * Placeholder de treinamento de fine-tune.
 * Use este arquivo como ponto de partida para chamar a API/CLI do provedor.
 */
import fs from "fs";
import path from "path";

const DATASET = path.resolve(process.cwd(), "data", "finetune", "dataset.jsonl");

function main() {
  if (!fs.existsSync(DATASET)) {
    console.error(`Dataset não encontrado em ${DATASET}. Rode "npm run ft:prepare" primeiro.`);
    process.exit(1);
  }

  const stats = fs.statSync(DATASET);
  console.info("Dataset pronto para fine-tune:");
  console.info(`- Arquivo: ${DATASET}`);
  console.info(`- Tamanho: ${stats.size} bytes`);
  console.info("");
  console.info("Próximos passos sugeridos (exemplos):");
  console.info('1) Ajuste provider no script real (ex: OpenAI, Ollama FT, AWS Bedrock).');
  console.info('2) Execute a CLI do provider apontando para o dataset JSONL.');
  console.info('3) Registre model_version retornado no .env e em docs.');
}

main();

