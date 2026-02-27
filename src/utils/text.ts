export const chunkText = (text: string, chunkSize: number, overlap: number): string[] => {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
};

export const ensurePromptLimit = (value: string, max = 7000): string => {
  if (value.length <= max) return value;
  return value.slice(0, max);
};

