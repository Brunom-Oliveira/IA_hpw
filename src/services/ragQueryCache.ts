import { RagResponse } from "../types";
import { env } from "../utils/env";

type CacheEntry = {
  value: RagResponse;
  createdAt: number;
  sourceKeys: string[];
  collections: string[];
};

const DEFAULT_TTL_MS = Number(process.env.RAG_CACHE_TTL_MS || 10 * 60 * 1000);
const DEFAULT_MAX_ITEMS = env.ragCacheMaxItems;

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

  set(
    key: string,
    value: RagResponse,
    metadata?: { sourceKeys?: string[]; collections?: string[] }
  ): void {
    if (!this.store.has(key) && this.store.size >= DEFAULT_MAX_ITEMS) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value,
      createdAt: Date.now(),
      sourceKeys: normalizeValues(metadata?.sourceKeys),
      collections: normalizeValues(metadata?.collections),
    });
  }

  clear(): void {
    this.store.clear();
  }

  invalidateBySourceKeys(sourceKeys: string[]): number {
    const normalized = new Set(normalizeValues(sourceKeys));
    if (!normalized.size) return 0;

    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.sourceKeys.some((sourceKey) => normalized.has(sourceKey))) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  invalidateByCollections(collections: string[]): number {
    const normalized = new Set(normalizeValues(collections));
    if (!normalized.size) return 0;

    let removed = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.collections.some((collection) => normalized.has(collection))) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  stats(): { size: number; ttl_ms: number; max_items: number } {
    return {
      size: this.store.size,
      ttl_ms: DEFAULT_TTL_MS,
      max_items: DEFAULT_MAX_ITEMS,
    };
  }
}

function normalizeValues(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean)));
}

export const ragQueryCache = new RagQueryCache();
