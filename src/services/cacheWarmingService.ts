import { RagService } from "./ragService";
import { env } from "../utils/env";
import { EmbeddingService } from "./llm/embeddingService";
import { LlmService } from "./llm/llmService";
import { ragQueryCache } from "./ragQueryCache";

/**
 * Serviço de Cache Warming (pré-aquecimento de cache)
 * Executa no boot para:
 * 1. Pré-processar queries comuns
 * 2. Warm-up do modelo de embeddings
 * 3. Warm-up do LLM modelo
 * Resultado: Primeira requisição é mais rápida
 */
export class CacheWarmingService {
  private ragService: RagService | null = null;
  private embeddingService: EmbeddingService;
  private llmService: LlmService;
  private isWarmed = false;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.llmService = new LlmService();
  }

  /**
   * Inicia warm-up de cache (deve ser chamado no boot da aplicação)
   * Não bloqueia - roda em background
   */
  async warmupAsync(ragService: RagService): Promise<void> {
    this.ragService = ragService;

    // Executar warm-up em background (não aguardar)
    setImmediate(() => {
      this.warmup().catch((err) => {
        console.warn("[cache-warming] Erro durante warm-up:", err?.message);
      });
    });
  }

  /**
   * Executa warm-up de cache (síncrono com await interno)
   */
  private async warmup(): Promise<void> {
    if (this.isWarmed) return;

    console.info("[cache-warming] 🔥 Iniciando aquecimento de cache...");
    const startTime = Date.now();

    try {
      // 1. Warm-up de embeddings
      await this.warmupEmbeddings();

      // 2. Warm-up de LLM
      await this.warmupLlm();

      // 3. Warm-up de queries comuns
      if (this.ragService) {
        await this.warmupRagQueries();
      }

      const duration = Date.now() - startTime;
      this.isWarmed = true;
      console.info(`[cache-warming] ✅ Cache aquecido em ${duration}ms`);
    } catch (error: any) {
      console.error("[cache-warming] ⚠️ Erro no warm-up:", error?.message);
      // Não lançar erro - warm-up é otimização, não crítico
    }
  }

  /**
   * Warm-up do modelo de embeddings
   * Processa alguns embeddings para carregar o modelo na memória
   */
  private async warmupEmbeddings(): Promise<void> {
    try {
      console.info("[cache-warming] Warm-up de embeddings...");

      const sampleTexts = [
        "estrutura da tabela usuários",
        "como resolver erro de conexão",
        "query otimizada para performance",
        "triggers na tabela pedidos",
        "índices recomendados para busca",
      ];

      for (const text of sampleTexts) {
        await this.embeddingService.embed(text);
      }

      console.info("[cache-warming] ✓ Embeddings model carregado");
    } catch (error: any) {
      console.warn("[cache-warming] ⚠️ Erro em embeddings warm-up:", error?.message);
    }
  }

  /**
   * Warm-up do modelo LLM
   * Faz uma chamada simples ao LLM para carregar o modelo
   */
  private async warmupLlm(): Promise<void> {
    try {
      console.info("[cache-warming] Warm-up de LLM...");

      // Simples prompt para warm-up
      await this.llmService.generate(
        "Respondendo rápidamente ao usuário. Responda em uma frase curta.",
      );

      console.info("[cache-warming] ✓ LLM model carregado");
    } catch (error: any) {
      console.warn("[cache-warming] ⚠️ Erro em LLM warm-up:", error?.message);
    }
  }

  /**
   * Warm-up de queries comuns
   * Pré-processa estrutura de schema e padrões comuns
   */
  private async warmupRagQueries(): Promise<void> {
    if (!this.ragService) return;

    try {
      console.info("[cache-warming] Warm-up de RAG queries...");

      const commonQueries = [
        // Schema queries
        "quais as tabelas no banco?",
        "estrutura da tabela usuários",
        "relações entre tabelas",

        // Troubleshooting queries
        "como resolver erro de conexão?",
        "o que fazer com timeout?",
        "problema no servidor",

        // Procedure queries
        "como inserir um novo usuário?",
        "como atualizar dados?",
        "como deletar um registro?",

        // General queries
        "qual é a documentação?",
        "como começar?",
      ];

      // Executar queries em paralelo (máximo 3 simultâneas)
      const batchSize = 3;
      for (let i = 0; i < commonQueries.length; i += batchSize) {
        const batch = commonQueries.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map((query) =>
            this.executeWarmupQuery(query).catch((err) => {
              console.warn(`[cache-warming] Query falhou: ${query}`, err?.message);
            }),
          ),
        );
      }

      console.info("[cache-warming] ✓ RAG queries aquecidas");
    } catch (error: any) {
      console.warn("[cache-warming] ⚠️ Erro em RAG warm-up:", error?.message);
    }
  }

  /**
   * Executa uma query de warm-up (sem retornar resultado ao usuário)
   */
  private async executeWarmupQuery(query: string): Promise<void> {
    if (!this.ragService) return;

    try {
      await this.ragService.ask(query);
      // Cache hit no próximo call
    } catch (error: any) {
      // Ignorar erros de warm-up - não é crítico
      if (error?.message) {
        console.warn(`[cache-warming] Query warm-up falhou: ${error?.message?.substring(0, 50)}`);
      }
    }
  }

  /**
   * Obter status de warm-up
   */
  getStatus(): { isWarmed: boolean; timestamp?: Date } {
    return {
      isWarmed: this.isWarmed,
      timestamp: this.isWarmed ? new Date() : undefined,
    };
  }

  /**
   * Cache statistics após warm-up
   */
  getCacheStats(): Record<string, unknown> {
    return {
      isWarmed: this.isWarmed,
      timestamp: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const cacheWarmingService = new CacheWarmingService();
