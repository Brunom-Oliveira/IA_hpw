import { randomUUID } from "crypto";
import { inject, singleton } from "tsyringe";
import { RagMetadataReindexService } from "./ragMetadataReindexService";
import { RagReindexJob, ragOpsStatusService } from "./ragOpsStatusService";

@singleton()
export class RagReindexQueueService {
  private processing = false;
  private readonly queue: string[] = [];

  constructor(@inject(RagMetadataReindexService) private readonly reindexService: RagMetadataReindexService) {}

  enqueue(): RagReindexJob {
    const job: RagReindexJob = {
      id: randomUUID(),
      status: "queued",
      created_at: new Date().toISOString(),
      started_at: null,
      finished_at: null,
      total_scanned: 0,
      total_updated: 0,
      collections: [],
      error: null,
    };

    ragOpsStatusService.addJob(job);
    this.queue.push(job.id);
    void this.processNext();
    return job;
  }

  getJob(jobId: string): RagReindexJob | null {
    return ragOpsStatusService.getJob(jobId);
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    const nextJobId = this.queue.shift();
    if (!nextJobId) return;

    this.processing = true;
    ragOpsStatusService.updateJob(nextJobId, {
      status: "running",
      started_at: new Date().toISOString(),
      error: null,
    });

    try {
      const result = await this.reindexService.reindexAllCollections();
      ragOpsStatusService.updateJob(nextJobId, {
        status: "success",
        finished_at: new Date().toISOString(),
        total_scanned: result.total_scanned,
        total_updated: result.total_updated,
        collections: result.collections,
      });
    } catch (error: any) {
      ragOpsStatusService.updateJob(nextJobId, {
        status: "error",
        finished_at: new Date().toISOString(),
        error: error?.message || "Falha ao reindexar metadata do RAG",
      });
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        void this.processNext();
      }
    }
  }
}
