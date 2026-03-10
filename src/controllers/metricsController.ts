import { Request, Response } from "express";
import { singleton, inject } from "tsyringe";
import { MetricsService } from "../services/metricsService";

@singleton()
export class MetricsController {
  constructor(@inject(MetricsService) private readonly metrics: MetricsService) {}

  prometheus = (_req: Request, res: Response): void => {
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(this.metrics.toPrometheus());
  };
}

