import Redis from "ioredis";
import { singleton } from "tsyringe";
import { env } from "../utils/env";
import { LlmUsage, RagResponse } from "../types";

const CACHE_INDEX_NAME = "idx:semantic_cache";
const CACHE_PREFIX = "cache:query:";

interface CachedData {
  response: RagResponse;
  embedding: number[];
}

@singleton()
export class SemanticCacheService {
  private redis: Redis;
  private isConnected = false;

  constructor() {
    this.redis = new Redis(env.redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 5000,
    });

    this.redis.on("connect", () => {
      this.isConnected = true;
      console.log("[redis] Conectado ao cache semântico.");
      this.createIndex();
    });

    this.redis.on("error", (err) => {
      this.isConnected = false;
      console.error("[redis] Erro de conexão com o cache semântico:", err.message);
    });
  }

  private async createIndex(): Promise<void> {
    if (!this.isConnected) return;

    try {
      const existingIndices = await this.redis.call("FT._LIST") as string[];
      if (existingIndices.includes(CACHE_INDEX_NAME)) {
        return;
      }

      await this.redis.call(
        "FT.CREATE",
        CACHE_INDEX_NAME,
        "ON",
        "JSON",
        "PREFIX",
        "1",
        CACHE_PREFIX,
        "SCHEMA",
        "$.embedding",
        "AS",
        "embedding",
        "VECTOR",
        "HNSW",
        "6",
        "TYPE",
        "FLOAT32",
        "DIM",
        env.qdrantVectorSize,
        "DISTANCE_METRIC",
        "COSINE"
      );
      console.log(`[redis] Índice '${CACHE_INDEX_NAME}' criado com sucesso.`);
    } catch (error: any) {
      if (error.message.includes("Index already exists")) {
        // Ignore
      } else {
        console.error("[redis] Falha ao criar índice:", error.message);
      }
    }
  }

  public async find(embedding: number[]): Promise<RagResponse | null> {
    if (!this.isConnected) return null;

    try {
      const query = `*=>[KNN 1 @embedding $vector AS score]`;
      const vectorBuffer = Buffer.from(new Float32Array(embedding).buffer);

      const result = (await this.redis.call(
        "FT.SEARCH",
        CACHE_INDEX_NAME,
        query,
        "PARAMS",
        "2",
        "vector",
        vectorBuffer,
        "DIALECT",
        "2"
      )) as any[];

      if (Array.isArray(result) && result.length > 3 && Array.isArray(result[2])) {
        const doc = result[2] as any[];
        const score = parseFloat(doc[1]);

        if (Number.isFinite(score) && score >= env.semanticCacheThreshold && typeof doc[3] === "string") {
          const payload = JSON.parse(doc[3]) as CachedData;
          return payload.response;
        }
      }
    } catch (error: any) {
      console.error("[redis] Erro ao buscar no cache semântico:", error.message);
    }

    return null;
  }

  public async add(embedding: number[], response: RagResponse): Promise<void> {
    if (!this.isConnected) return;
    const key = `${CACHE_PREFIX}${this.generateId(response.answer)}`;
    const data: CachedData = { response, embedding };

    try {
      await this.redis
        .multi()
        .call("JSON.SET", key, "$", JSON.stringify(data))
        .expire(key, env.semanticCacheTtl)
        .exec();
    } catch (error: any) {
      console.error("[redis] Erro ao adicionar ao cache semântico:", error.message);
    }
  }
  
  private generateId(text: string): string {
    return text.substring(0, 20).replace(/\s/g, "_");
  }
}
