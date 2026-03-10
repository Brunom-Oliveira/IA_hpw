import { z } from "zod";

/**
 * Schemas de validação para chat e RAG
 */

// Schema para uma mensagem de chat
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z
    .string()
    .min(1, "Mensagem não pode estar vazia")
    .max(10000, "Mensagem muito grande"),
});

// Schema para request de chat
export const ChatRequestSchema = z.object({
  messages: z
    .array(ChatMessageSchema)
    .min(1, "Pelo menos uma mensagem é necessária"),
  stream: z.boolean().default(false).optional(),
  temperature: z.number().min(0).max(2).default(0.7).optional(),
  maxTokens: z.number().int().positive().default(1024).optional(),
  model: z.string().default("default").optional(),
});

// Schema usado pelo endpoint /api/chat (mensagem única)
export const ChatAskSchema = z.object({
  message: z.string().min(1, "message obrigatoria").max(10000),
  topK: z.number().int().min(1).max(10).optional(),
  stream: z.boolean().optional().default(false),
  timeoutMs: z.number().int().positive().optional(),
});

// Schema para query RAG
export const RagQuerySchema = z.object({
  query: z.string().min(1, "Query não pode estar vazia").max(2000),
  topK: z.number().int().positive().default(5).optional(),
  threshold: z.number().min(0).max(1).default(0.5).optional(),
  context: z.boolean().default(true).optional(),
});

// Schema para upload de arquivo
export const FileUploadSchema = z.object({
  filename: z.string().min(1, "Nome do arquivo é necessário"),
  contentType: z.enum([
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  size: z
    .number()
    .int()
    .positive()
    .max(52428800, "Arquivo muito grande (máx 50MB)"), // 50MB
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type RagQuery = z.infer<typeof RagQuerySchema>;
export type FileUpload = z.infer<typeof FileUploadSchema>;
