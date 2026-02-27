const { AVAILABLE_CONTEXT } = require("./rag.constants");
const { estimateTokens } = require("./tokenManager");

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
  const questionTokens = estimateTokens(question);
  const tokenBudget = Math.max(256, AVAILABLE_CONTEXT - questionTokens);
  let totalTokens = 0;
  const chunks = [];

  // Inclui documentos por ordem de relevancia ate estourar o budget disponivel.
  for (const doc of deduped) {
    const text = extractText(doc);
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
    dedupedDocs: deduped.length,
  };
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
};
