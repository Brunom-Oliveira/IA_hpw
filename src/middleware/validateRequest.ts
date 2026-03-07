import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { z } from "zod";

/**
 * Middleware de validação genérico usando Zod
 *
 * Uso em rotas:
 */
// Example:
// router.post(
//   "/documents",
//   validateRequest(InsertDocumentsSchema, "body"),
//   documentController.insertDocuments,
// );
//

export interface ValidationOptions {
  abortEarly?: boolean; // Para em primeiro erro vs. coleta todos
  returnAllErrors?: boolean; // Retorna todos os erros
}

/**
 * Factory function para criar middleware de validação
 */
export const validateRequest = (
  schema: ZodSchema,
  source: "body" | "query" | "params" = "body",
  options?: ValidationOptions,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dataToValidate = getDataBySource(req, source);

      // Validar usando Zod
      const validatedData = schema.parse(dataToValidate);

      // Injetar dados validados no request
      injectValidatedData(req, validatedData, source);

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodErrors(error);
        const statusCode =
          source === "query" || source === "params" ? 400 : 422;

        res.status(statusCode).json({
          error: "Validação falhou",
          status: statusCode,
          timestamp: new Date().toISOString(),
          requestId: (req as any).requestId,
          path: req.path,
          details: validationErrors,
        });
        return;
      }

      // Se não for erro Zod, passar para o error handler
      next(error);
    }
  };
};

/**
 * Extrai dados do request baseado na fonte
 */
function getDataBySource(
  req: Request,
  source: "body" | "query" | "params",
): any {
  switch (source) {
    case "body":
      return req.body;
    case "query":
      return req.query;
    case "params":
      return req.params;
    default:
      return {};
  }
}

/**
 * Injeta dados validados no request para uso posterior
 */
function injectValidatedData(req: Request, data: any, source: string): void {
  if (source === "body") {
    req.body = data;
  } else if (source === "query") {
    (req as any).validatedQuery = data;
  } else if (source === "params") {
    (req as any).validatedParams = data;
  }
}

/**
 * Formata erros do Zod em estrutura legível
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const formatted: Record<string, string[]> = {};

  error.issues.forEach((err) => {
    const path = err.path.join(".");
    const message = err.message;

    if (!formatted[path]) {
      formatted[path] = [];
    }

    formatted[path].push(message);
  });

  return formatted;
}

/**
 * Função auxiliar para criar schemas reutilizáveis com validação comum
 */
export const createPaginationSchema = () => ({
  limit: z.number().int().positive().default(10).optional(),
  offset: z.number().int().nonnegative().default(0).optional(),
  sort: z.enum(["asc", "desc"]).default("asc").optional(),
  sortBy: z.string().default("createdAt").optional(),
});
