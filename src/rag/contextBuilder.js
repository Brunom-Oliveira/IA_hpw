const { AVAILABLE_CONTEXT } = require("./rag.constants");
const { estimateTokens } = require("./tokenManager");

const MAX_DOC_TOKENS = Number(process.env.RAG_MAX_DOC_TOKENS || 550);

function deduplicateDocs(retrievedDocs) {
  const docs = Array.isArray(retrievedDocs) ? retrievedDocs : [];
  const sortedDocs = [...docs].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  const unique = [];
  const seenHashes = new Set();

  for (const doc of sortedDocs) {
    const text = extractText(doc);
    if (!text) continue;

    const normalized = normalizeText(text);
    const hash = simpleHash(normalized.slice(0, 300));
    if (seenHashes.has(hash)) continue;

    // Deduplicacao leve para evitar contexto redundante e desperdicio de tokens.
    const duplicateByInclusion = unique.some((item) => {
      const existing = normalizeText(extractText(item));
      return existing.includes(normalized) || normalized.includes(existing);
    });
    if (duplicateByInclusion) continue;

    seenHashes.add(hash);
    unique.push(doc);
  }

  return unique;
}

function buildContext(question, retrievedDocs) {
  const deduped = deduplicateDocs(retrievedDocs);
  const ranked = rankByLexicalRelevance(question, deduped);
  const questionTokens = estimateTokens(question);
  const tokenBudget = Math.max(256, AVAILABLE_CONTEXT - questionTokens);
  let totalTokens = 0;
  const chunks = [];

  // Inclui documentos por ordem de relevancia ate estourar o budget disponivel.
  for (const doc of ranked) {
    const text = trimTextToTokenBudget(extractText(doc), MAX_DOC_TOKENS);
    if (!text) continue;

    const docTokens = estimateTokens(text);
    if (totalTokens + docTokens > tokenBudget) {
      break;
    }

    chunks.push(text);
    totalTokens += docTokens;
  }

  return {
    context: chunks.join("\n\n"),
    usedTokens: totalTokens,
    tokenBudget,
    selectedDocs: chunks.length,
    dedupedDocs: ranked.length,
  };
}

function rankByLexicalRelevance(question, docs) {
  const qTokens = new Set(normalizeText(question).split(" ").filter((token) => token.length >= 3));
  if (!qTokens.size) return docs;

  return [...docs].sort((a, b) => {
    const textA = normalizeText(extractText(a));
    const textB = normalizeText(extractText(b));
    const overlapA = countOverlap(textA, qTokens);
    const overlapB = countOverlap(textB, qTokens);

    if (overlapA !== overlapB) return overlapB - overlapA;
    return Number(b.score || 0) - Number(a.score || 0);
  });
}

function countOverlap(text, tokens) {
  let hits = 0;
  for (const token of tokens) {
    if (text.includes(token)) hits += 1;
  }
  return hits;
}

function trimTextToTokenBudget(text, maxTokens) {
  const normalized = String(text || "").trim();
  if (!normalized) return "";
  if (!Number.isFinite(maxTokens) || maxTokens <= 0) return normalized;

  const maxChars = maxTokens * 4;
  if (normalized.length <= maxChars) return normalized;

  return `${normalized.slice(0, maxChars)}\n\n[trecho truncado para otimizar latencia]`;
}

function extractText(doc) {
  if (!doc) return "";
  if (doc.payload && typeof doc.payload.text === "string") return doc.payload.text.trim();
  if (typeof doc.text === "string") return doc.text.trim();
  return "";
}

function normalizeText(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function simpleHash(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

module.exports = {
  buildContext,
  deduplicateDocs,
  rankByLexicalRelevance,
};
