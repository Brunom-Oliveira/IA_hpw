const axios = require("axios");

const QDRANT_URL = process.env.QDRANT_URL || "http://qdrant:6333";
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "documents";
const FALLBACK_COLLECTIONS = String(
  process.env.RAG_FALLBACK_COLLECTIONS || "knowledge_base,schema_knowledge,schema_documents",
)
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean)
  .filter((name) => name !== COLLECTION_NAME);
const VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE || 768);
const DISTANCE = process.env.QDRANT_DISTANCE || "Cosine";

class SearchService {
  constructor() {
    this.collectionReady = false;
  }

  async ensureCollection() {
    if (this.collectionReady) return;

    try {
      await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
      this.collectionReady = true;
      return;
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.error("[rag][qdrant] Erro ao verificar colecao:", error.message);
        throw error;
      }
    }

    try {
      await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        vectors: {
          size: VECTOR_SIZE,
          distance: DISTANCE,
        },
      });
      this.collectionReady = true;
      console.info("[rag][qdrant] Colecao criada:", COLLECTION_NAME);
    } catch (error) {
      console.error("[rag][qdrant] Erro ao criar colecao:", error.message);
      throw error;
    }
  }

  async upsertPoints(points) {
    if (!Array.isArray(points) || points.length === 0) return;
    await this.ensureCollection();

    try {
      await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
        points,
      });
      console.info(`[rag][qdrant] ${points.length} chunks indexados`);
    } catch (error) {
      console.error("[rag][qdrant] Erro ao inserir pontos:", error.message);
      throw error;
    }
  }

  async searchByVector(vector, limit = 5) {
    await this.ensureCollection();
    const collectionsToSearch = [COLLECTION_NAME, ...FALLBACK_COLLECTIONS];

    for (const collectionName of collectionsToSearch) {
      const result = await this.searchInCollection(collectionName, vector, limit);
      if (Array.isArray(result) && result.length > 0) {
        return result;
      }
    }

    return [];
  }

  async searchInCollection(collectionName, vector, limit) {
    let queryError = null;
    try {
      // Qdrant mais novo: /points/query
      const queryResponse = await axios.post(`${QDRANT_URL}/collections/${collectionName}/points/query`, {
        query: vector,
        limit,
        with_payload: true,
      });

      const result = queryResponse.data && queryResponse.data.result ? queryResponse.data.result : [];
      if (Array.isArray(result)) return result;
      if (result && Array.isArray(result.points)) return result.points;
      return [];
    } catch (error) {
      queryError = error;
      if (!(error.response && error.response.status === 404)) {
        console.warn(`[rag][qdrant] ${collectionName}: falha em /points/query, tentando /points/search:`, error.message);
      }
    }

    try {
      // Qdrant legado: /points/search
      const searchResponse = await axios.post(`${QDRANT_URL}/collections/${collectionName}/points/search`, {
        vector,
        limit,
        with_payload: true,
      });

      return searchResponse.data && searchResponse.data.result ? searchResponse.data.result : [];
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return [];
      }

      console.error(`[rag][qdrant] ${collectionName}: erro na busca vetorial (search):`, error.message);
      if (queryError) {
        console.error(`[rag][qdrant] ${collectionName}: erro anterior em /points/query:`, queryError.message);
      }
      throw error;
    }
  }
}

module.exports = { SearchService };
