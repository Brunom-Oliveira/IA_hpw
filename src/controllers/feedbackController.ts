import { Request, Response } from "express";
import { singleton, inject } from "tsyringe";
import { FeedbackService } from "../services/feedbackService";

@singleton()
export class FeedbackController {
  constructor(@inject(FeedbackService) private readonly feedbackService: FeedbackService) {}

  submit = async (req: Request, res: Response): Promise<void> => {
    const { query, answer, sources, relevant } = req.body;
    const saved = await this.feedbackService.add({
      query,
      answer,
      sources,
      relevant,
    });
    res.status(201).json({ feedback_id: saved.id, created_at: saved.createdAt });
  };
}
