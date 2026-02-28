const axios = require("axios");
const crypto = require("crypto");

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "nomic-embed-text";
const QDRANT_URL = process.env.QDRANT_URL || "http://qdrant:6333";
const COLLECTION_NAME = "schema_knowledge";
const VECTOR_SIZE = Number(process.env.QDRANT_VECTOR_SIZE || 768);
const DISTANCE = process.env.QDRANT_DISTANCE || "Cosine";

function estimateTokens(text) {
  return Math.ceil(String(text || "").length / 4);
}

function chunkLargeDocument(text, maxTokens = 800, overlapTokens = 120) {
  const normalized = String(text || "").trim();
  if (!normalized) return [];

  const words = normalized.split(/\s+/);
  const chunks = [];
  let start = 0;

  while (start < words.length) {
    let end = start;
    let tokenCount = 0;

    while (end < words.length) {
      const projected = tokenCount + estimateTokens(words[end]);
      if (projected > maxTokens) break;
      tokenCount = projected;
      end += 1;
    }

    if (end === start) end = start + 1;
    chunks.push(words.slice(start, end).join(" "));

    const overlapWords = estimateOverlapWords(words, end, overlapTokens);
    start = Math.max(end - overlapWords, start + 1);
  }

  return chunks;
}

function estimateOverlapWords(words, end, overlapTokens) {
  let tokenCount = 0;
  let count = 0;
  for (let i = end - 1; i >= 0; i -= 1) {
    tokenCount += estimateTokens(words[i]);
    if (tokenCount >= overlapTokens) break;
    count += 1;
  }
  return Math.max(5, count);
}

async function indexSchemaDocuments(documents) {
  const docs = Array.isArray(documents) ? documents : [];
  if (!docs.length) {
    return { indexed_points: 0, documents_indexed: 0 };
  }

  await ensureCollection();
  const createdAt = new Date().toISOString();
  const points = [];

  for (const doc of docs) {
    const tokenCount = estimateTokens(doc.text);
    const chunks = tokenCount > 1500 ? chunkLargeDocument(doc.text, 800, 120) : [doc.text];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const textChunk = chunks[chunkIndex];
      const vector = await createEmbedding(textChunk);
      points.push({
        id: crypto.randomUUID(),
        vector,
        payload: {
          table_name: doc.table_name,
          schema: doc.schema,
          document_type: doc.document_type,
          related_tables: doc.related_tables || [],
          created_at: createdAt,
          chunk_index: chunkIndex,
          chunks_total: chunks.length,
          text: textChunk,
        },
      });
    }
  }

  await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, { points });
  console.info(`[schema][indexer] ${points.length} pontos indexados em ${COLLECTION_NAME}`);

  return {
    indexed_points: points.length,
    documents_indexed: docs.length,
  };
}

async function createEmbedding(text) {
  const response = await axios.post(`${OLLAMA_BASE_URL}/api/embeddings`, {
    model: EMBEDDING_MODEL,
    prompt: text,
  });

  const embedding = response.data && response.data.embedding;
  if (!Array.isArray(embedding) || !embedding.length) {
    throw new Error("Embedding invalido retornado pelo Ollama");
  }

  if (embedding.length === VECTOR_SIZE) return embedding;
  if (embedding.length > VECTOR_SIZE) return embedding.slice(0, VECTOR_SIZE);
  return embedding.concat(new Array(VECTOR_SIZE - embedding.length).fill(0));
}

async function ensureCollection() {
  try {
    await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    return;
  } catch (error) {
    if (!error.response || error.response.status !== 404) {
      console.error("[schema][indexer] Falha ao validar colecao:", error.message);
      throw error;
    }
  }

  await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    vectors: {
      size: VECTOR_SIZE,
      distance: DISTANCE,
    },
  });
  console.info(`[schema][indexer] Colecao criada: ${COLLECTION_NAME}`);
}

module.exports = {
  indexSchemaDocuments,
  estimateTokens,
  chunkLargeDocument,
};

