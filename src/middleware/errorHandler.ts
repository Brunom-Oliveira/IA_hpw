import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger";

/**
 * Global Error Handler Middleware
 *
 * Captura todos os erros não tratados e retorna respostas estruturadas
 * sem vazar stack traces ou informações sensíveis
 */

export class HttpError extends Error {
  constructor(public statusCode: number = 500, message = "Erro interno do servidor") {
    super(message);
    this.name = "HttpError";
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
): Response => {
  const status = err.status || err.statusCode || 500;
  const timestamp = new Date().toISOString();

  const requestId = (req as any).requestId;
  const safeMessage = getErrorMessage(err, status);

  logger.error({
    message: err?.message || safeMessage,
    requestId,
    status,
    path: req.path,
    method: req.method,
    stack: status >= 500 ? err?.stack : undefined,
    name: err?.name,
  });

  return res.status(status).json({
    error: safeMessage,
    status,
    timestamp,
    requestId,
    path: req.path,
  });
};

/**
 * Gera mensagem de erro amigável sem vazar informações sensíveis
 */
function getErrorMessage(err: any, status: number): string {
  // Erros do servidor (5xx) - mensagem genérica
  if (status >= 500) {
    return "Erro interno do servidor. Por favor, tente novamente mais tarde.";
  }

  // Erros de cliente (4xx) - mensagem do erro
  if (err.message) {
    return err.message;
  }

  // Fallback
  if (status === 404) {
    return "Recurso não encontrado.";
  }

  if (status === 401) {
    return "Não autorizado.";
  }

  if (status === 403) {
    return "Acesso proibido.";
  }

  return "Algo deu errado.";
}

/**
 * Log estruturado de erros com diferentes níveis
 */
/**
 * Middleware para capturar erros em async routes
 * Uso: router.get("/endpoint", asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>,
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware para capturar 404 (deve ser o último middleware antes do error handler)
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const error: any = new HttpError(404, `Não foi possível encontrar ${req.originalUrl} neste servidor.`);
  next(error);
};
