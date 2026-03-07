import { RagMetadataReindexService } from "../services/ragMetadataReindexService";

async function run(): Promise<void> {
  const service = new RagMetadataReindexService();
  const result = await service.reindexAllCollections();

  console.log("[rag-reindex] concluido");
  for (const item of result.collections) {
    console.log(
      `[rag-reindex] ${item.collection}: ${item.updated_points}/${item.scanned_points} payloads atualizados`
    );
  }
  console.log(
    `[rag-reindex] total: ${result.total_updated}/${result.total_scanned} payloads atualizados`
  );
}

run().catch((error) => {
  console.error("[rag-reindex] erro:", error);
  process.exit(1);
});
