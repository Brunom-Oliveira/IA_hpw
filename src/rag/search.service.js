const axios = require("axios");

const QDRANT_URL = process.env.QDRANT_URL || "http://qdrant:6333";
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "documents";
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

    try {
      const response = await axios.post(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
        vector,
        limit,
        with_payload: true,
      });

      return response.data && response.data.result ? response.data.result : [];
    } catch (error) {
      console.error("[rag][qdrant] Erro na busca vetorial:", error.message);
      throw error;
    }
  }
}

module.exports = { SearchService };

