import { z } from "zod";

export const FeedbackSchema = z.object({
  query: z.string().min(3, "query obrigatoria"),
  answer: z.string().optional(),
  sources: z.array(z.string()).optional(),
  relevant: z.boolean(),
});

export type FeedbackRequest = z.infer<typeof FeedbackSchema>;

