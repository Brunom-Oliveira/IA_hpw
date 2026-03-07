import { Request, Response, NextFunction } from "express";

/**
 * Global Error Handler Middleware
 *
 * Captura todos os erros não tratados e retorna respostas estruturadas
 * sem vazar stack traces ou informações sensíveis
 */

interface ErrorResponse {
  error: string;
  status: number;
  timestamp: string;
  requestId?: string;
  path?: string;
}

interface CustomError extends Error {
  status?: number;
  statusCode?: number;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction,
): Response => {
  const status = err.status || err.statusCode || 500;
  const timestamp = new Date().toISOString();

  // Construir resposta de erro
  const errorResponse: ErrorResponse = {
    error: getErrorMessage(err, status),
    status,
    timestamp,
    path: req.path,
  };

  // Adicionar request ID se disponível
  if ((req as any).requestId) {
    errorResponse.requestId = (req as any).requestId;
  }

  // Logging baseado em severity
  logError(err, status, errorResponse);

  return res.status(status).json(errorResponse);
};

/**
 * Gera mensagem de erro amigável sem vazar informações sensíveis
 */
function getErrorMessage(err: CustomError, status: number): string {
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
function logError(
  err: CustomError,
  status: number,
  errorResponse: ErrorResponse,
): void {
  const logLevel = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  const logEntry = {
    level: logLevel,
    timestamp: errorResponse.timestamp,
    status,
    message: err.message,
    requestId: errorResponse.requestId,
    path: errorResponse.path,
    ...(status >= 500 && {
      // Apenas logar stack trace para erros 5xx (internos)
      stack: err.stack,
    }),
  };

  // Log estruturado (pode ser substituído por winston/pino depois)
  switch (logLevel) {
    case "error":
      console.error(JSON.stringify(logEntry));
      break;
    case "warn":
      console.warn(JSON.stringify(logEntry));
      break;
    case "info":
    default:
      console.log(JSON.stringify(logEntry));
  }
}

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
  const error: CustomError = new Error(
    `Não foi possível encontrar ${req.originalUrl} neste servidor.`,
  );
  error.status = 404;
  next(error);
};
