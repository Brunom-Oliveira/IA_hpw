import { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";

/**
 * Request ID Middleware
 *
 * Gera ou recupera um UUID único para cada request
 * Usado para auditoria, logging e correlação de erros
 */

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  // Verificar se já existe request ID (pode vir do cliente ou load balancer)
  const incomingRequestId =
    req.headers["x-request-id"] ||
    req.headers["x-correlation-id"] ||
    req.headers["traceparent"];

  // Gerar novo ou usar existente
  const requestId = incomingRequestId
    ? String(incomingRequestId).split("-")[0].slice(0, 8) // Pegar parte relevante
    : randomUUID();

  // Injetar no request
  req.requestId = requestId;

  // Retornar no response header
  res.setHeader("x-request-id", requestId);

  // Adicionar ao response locals para uso em templates (se houver)
  res.locals.requestId = requestId;

  next();
};
