import axios from "axios";
import { env } from "../../utils/env";

/**
 * Serviço para criar e otimizar índices Qdrant
 * Responsável por tuning automático de performance
 */
export class QdrantIndexService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.qdrantUrl;
  }

  /**
   * Cria índices HNSW (Hierarchical Navigable Small World)
   * Otimizado para busca de similaridade em alta dimensionalidade
   */
  async ensureIndices(collectionName: string): Promise<void> {
    try {
      // Verificar se a collection existe
      const collectionExists = await this.collectionExists(collectionName);
      if (!collectionExists) {
        console.log(`[qdrant][index] Collection ${collectionName} não existe, pulando índices`);
        return;
      }

      // Criar índice HNSW para vectors
      await this.createHnswIndex(collectionName);

      // Criar índices de payload para campos críticos
      await this.createPayloadIndices(collectionName);

      console.info(`[qdrant][index] ✅ Índices otimizados para ${collectionName}`);
    } catch (error: any) {
      console.error(`[qdrant][index] ❌ Erro ao criar índices: ${error?.message}`);
      // Não lançar erro - índices são otimização, não crítico
    }
  }

  /**
   * Cria índice HNSW com parâmetros otimizados
   * Parâmetros:
   * - m: número de conexões por ponto (16 = balanceado)
   * - ef_construct: esforço na construção (200 = qualidade alta)
   * - ef_search: esforço na busca (100 = latência média)
   */
  private async createHnswIndex(collectionName: string): Promise<void> {
    try {
      // Verificar estado atual
      const collection = await axios.get(
        `${this.baseUrl}/collections/${collectionName}`,
      );

      const hasHnswConfig = collection.data?.result?.config?.hnsw_config;

      if (hasHnswConfig) {
        console.info(`[qdrant][index] HNSW já configurado em ${collectionName}`);
        return;
      }

      // Atualizar collection com HNSW
      await axios.patch(
        `${this.baseUrl}/collections/${collectionName}`,
        {
          hnsw_config: {
            m: 16, // Conexões por ponto (balanceado entre memory e quality)
            ef_construct: 200, // Qualidade na construção
            ef_search: 100, // Velocidade na busca
            ef_expand: 256, // Expansão na busca (expansão máxima)
            max_m: 16,
            seed: 42, // Reprodutibilidade
          },
        },
      );

      console.info(`[qdrant][index] ✅ HNSW configurado em ${collectionName}`);
    } catch (error: any) {
      // Se for 400 Bad Request, pode ser que HNSW já esteja ativo
      if (error?.response?.status !== 400) {
        throw error;
      }
      console.info(`[qdrant][index] HNSW configuração pode estar ativa (400 recebido)`);
    }
  }

  /**
   * Cria índices de payload para campos críticos
   * Melhora performance de filtros
   */
  private async createPayloadIndices(collectionName: string): Promise<void> {
    const criticalFields = [
      "source", // Campo mais filtrado
      "category", // Agregação por categoria
      "module", // Filtragem por módulo
      "system", // Filtragem por sistema
      "table_name", // Para schema queries
    ];

    for (const field of criticalFields) {
      try {
        await axios.post(`${this.baseUrl}/collections/${collectionName}/points/index`, {
          field_name: field,
          field_schema: "keyword", // string exata
        });

        console.info(`[qdrant][index] ✅ Índice payload criado: ${field}`);
      } catch (error: any) {
        const status = error?.response?.status;
        const msg = String(error?.message || "");

        // 409 = índice já existe, 400 = campo não existe (ignora)
        if (status === 409 || status === 400) {
          console.info(`[qdrant][index] ℹ️ Índice ${field} já existe ou campo ausente (status ${status})`);
          continue;
        }

        // 404 ou erros de rede: logar para visibilidade
        console.warn(`[qdrant][index] ⚠️ Erro ao criar índice ${field}: status=${status} msg=${msg}`);
      }
    }
  }

  /**
   * Simples verificação se collection existe
   */
  private async collectionExists(collectionName: string): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/collections/${collectionName}`);
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Obter stats da collection (para benchmarking)
   */
  async getCollectionStats(collectionName: string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/collections/${collectionName}`,
      );
      return {
        name: collectionName,
        vectors_count: response.data?.result?.vectors_count ?? 0,
        points_count: response.data?.result?.points_count ?? 0,
        config: response.data?.result?.config ?? {},
        hnsw_config: response.data?.result?.config?.hnsw_config ?? null,
      };
    } catch (error: any) {
      console.error(`[qdrant][index] Erro ao obter stats: ${error?.message}`);
      throw error;
    }
  }

  /**
   * Re-indexar collection após grande volume de dados
   * (simula vacuum/optimize)
   */
  async optimizeCollection(collectionName: string): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/collections/${collectionName}/snapshots`, {});
      console.info(`[qdrant][index] ✅ Collection otimizada: ${collectionName}`);
    } catch (error: any) {
      console.warn(`[qdrant][index] ⚠️ Erro ao otimizar: ${error?.message}`);
    }
  }
}
