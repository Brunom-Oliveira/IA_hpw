import { promises as fs } from "fs";
import path from "path";
import { singleton } from "tsyringe";

export interface FeedbackEntry {
  id: string;
  query: string;
  answer?: string;
  sources?: string[];
  relevant: boolean;
  createdAt: string;
}

@singleton()
export class FeedbackService {
  private readonly entries: FeedbackEntry[] = [];
  private readonly storagePath = path.resolve(process.cwd(), "data", "feedback.json");

  async add(entry: Omit<FeedbackEntry, "id" | "createdAt">): Promise<FeedbackEntry> {
    const withMeta: FeedbackEntry = {
      ...entry,
      id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      createdAt: new Date().toISOString(),
    };

    this.entries.push(withMeta);

    // Persist only fora de ambiente de teste
    if (process.env.NODE_ENV !== "test") {
      await this.persist();
    }

    return withMeta;
  }

  list(limit = 50): FeedbackEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.storagePath), { recursive: true });
      await fs.writeFile(this.storagePath, JSON.stringify(this.entries, null, 2), "utf-8");
    } catch (err: any) {
      console.warn("[feedback] Não foi possível persistir feedback:", err?.message);
    }
  }
}

