import { RagResponse } from "../types";

type CacheEntry = {
  value: RagResponse;
  createdAt: number;
};

const DEFAULT_TTL_MS = Number(process.env.RAG_CACHE_TTL_MS || 10 * 60 * 1000);

export class RagQueryCache {
  private readonly store = new Map<string, CacheEntry>();

  get(key: string): RagResponse | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > DEFAULT_TTL_MS) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: RagResponse): void {
    this.store.set(key, { value, createdAt: Date.now() });
  }

  clear(): void {
    this.store.clear();
  }

  stats(): { size: number; ttl_ms: number } {
    return {
      size: this.store.size,
      ttl_ms: DEFAULT_TTL_MS,
    };
  }
}

export const ragQueryCache = new RagQueryCache();
