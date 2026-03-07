import { NextFunction, Request, Response } from "express";
import { env } from "../utils/env";

/**
 * Admin Guard Middleware
 *
 * Protege endpoints administrativos com autenticação por token Bearer
 * Apenas aceita Authorization: Bearer <token> (x-rag-admin-token foi descontinuado)
 */

export function adminGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Se não há token admin configurado, permitir acesso (compatibilidade com dev)
  if (!env.ragAdminToken) {
    console.warn(
      "[ADMIN-GUARD] ⚠️  RAG_ADMIN_TOKEN não configurado. Acesso administrativo ABERTO.",
    );
    next();
    return;
  }

  // Extrair token APENAS de Authorization header (Bearer)
  const authHeader = req.header("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const providedToken = match ? match[1].trim() : "";

  // Token vazio ou inválido
  if (!providedToken) {
    logUnauthorizedAttempt(req, "Token ausente");
    res.status(401).json({
      error: "Token administrativo ausente",
      status: 401,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId,
      path: req.path,
      details: "Use Authorization: Bearer <token>",
    });
    return;
  }

  // Token não corresponde
  if (providedToken !== env.ragAdminToken) {
    logUnauthorizedAttempt(req, "Token inválido");
    res.status(403).json({
      error: "Token administrativo inválido",
      status: 403,
      timestamp: new Date().toISOString(),
      requestId: (req as any).requestId,
      path: req.path,
    });
    return;
  }

  // Token válido - permitir acesso
  logAuthorizedAccess(req);
  next();
}

/**
 * Log de tentativa de acesso não autorizado (potencial ataque)
 */
function logUnauthorizedAttempt(req: Request, reason: string): void {
  const logEntry = {
    level: "warn",
    timestamp: new Date().toISOString(),
    type: "admin_access_denied",
    reason,
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    requestId: (req as any).requestId,
    userAgent: req.get("user-agent"),
  };

  console.warn(JSON.stringify(logEntry));
}

/**
 * Log de acesso administrativo bem-sucedido
 */
function logAuthorizedAccess(req: Request): void {
  const logEntry = {
    level: "info",
    timestamp: new Date().toISOString(),
    type: "admin_access_granted",
    method: req.method,
    path: req.path,
    ip: req.ip || req.socket.remoteAddress,
    requestId: (req as any).requestId,
  };

  console.log(JSON.stringify(logEntry));
}
