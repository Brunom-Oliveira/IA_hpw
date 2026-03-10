import { z } from "zod";

/**
 * Schemas de validação para documentos
 */

// Schema para um documento individual
export const DocumentSchema = z.object({
  text: z
    .string()
    .min(1, "Texto não pode estar vazio")
    .max(50000, "Texto muito grande (máx 50KB)"),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Schema para inserir múltiplos documentos
export const InsertDocumentsSchema = z.object({
  documents: z
    .array(DocumentSchema)
    .min(1, "Pelo menos um documento é necessário"),
});

// Schema para buscar documentos
export const SearchDocumentsSchema = z.object({
  query: z.string().min(1, "Query não pode estar vazio").max(1000),
  limit: z.number().int().positive().default(10).optional(),
  offset: z.number().int().nonnegative().default(0).optional(),
  filters: z.record(z.string(), z.any()).optional(),
});

// Schema específico para busca RAG (topK)
export const RagSearchSchema = z.object({
  query: z.string().min(1, "Query não pode ser vazia").max(1000),
  topK: z.number().int().min(1).max(10).optional(),
});

// Schema para atualizar documento
export const UpdateDocumentSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
  text: z.string().min(1).max(50000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// Schema para deletar documento
export const DeleteDocumentSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Pelo menos um ID é necessário"),
});

export type Document = z.infer<typeof DocumentSchema>;
export type InsertDocuments = z.infer<typeof InsertDocumentsSchema>;
export type SearchDocuments = z.infer<typeof SearchDocumentsSchema>;
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>;
export type DeleteDocument = z.infer<typeof DeleteDocumentSchema>;
