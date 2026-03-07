import fs from "fs";
import path from "path";

type ReindexCollectionSummary = {
  collection: string;
  scanned_points: number;
  updated_points: number;
};

export type RagOpsStatus = {
  reindex: {
    status: "idle" | "running" | "success" | "error";
    started_at: string | null;
    finished_at: string | null;
    total_scanned: number;
    total_updated: number;
    collections: ReindexCollectionSummary[];
    error: string | null;
  };
};

const DEFAULT_STATUS: RagOpsStatus = {
  reindex: {
    status: "idle",
    started_at: null,
    finished_at: null,
    total_scanned: 0,
    total_updated: 0,
    collections: [],
    error: null,
  },
};

export class RagOpsStatusService {
  private readonly statusFilePath = path.resolve(process.cwd(), "runtime", "rag-ops-status.json");

  getStatus(): RagOpsStatus {
    try {
      if (!fs.existsSync(this.statusFilePath)) return DEFAULT_STATUS;
      const raw = fs.readFileSync(this.statusFilePath, "utf-8");
      const parsed = JSON.parse(raw) as RagOpsStatus;
      return {
        ...DEFAULT_STATUS,
        ...parsed,
        reindex: {
          ...DEFAULT_STATUS.reindex,
          ...(parsed?.reindex || {}),
        },
      };
    } catch {
      return DEFAULT_STATUS;
    }
  }

  markReindexStarted(): void {
    const current = this.getStatus();
    this.writeStatus({
      ...current,
      reindex: {
        ...current.reindex,
        status: "running",
        started_at: new Date().toISOString(),
        finished_at: null,
        error: null,
      },
    });
  }

  markReindexFinished(payload: {
    status: "success" | "error";
    total_scanned: number;
    total_updated: number;
    collections: ReindexCollectionSummary[];
    error?: string | null;
  }): void {
    const current = this.getStatus();
    this.writeStatus({
      ...current,
      reindex: {
        ...current.reindex,
        status: payload.status,
        finished_at: new Date().toISOString(),
        total_scanned: payload.total_scanned,
        total_updated: payload.total_updated,
        collections: payload.collections,
        error: payload.error || null,
      },
    });
  }

  private writeStatus(status: RagOpsStatus): void {
    fs.mkdirSync(path.dirname(this.statusFilePath), { recursive: true });
    fs.writeFileSync(this.statusFilePath, JSON.stringify(status, null, 2), "utf-8");
  }
}

export const ragOpsStatusService = new RagOpsStatusService();
