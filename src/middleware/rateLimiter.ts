import rateLimit from "express-rate-limit";

/**
 * Rate Limiter Global para API
 *
 * Configuração:
 * - Janela: 15 minutos
 * - Limite: 100 requisições por IP
 * - Health check é excluído do limite
 *
 * Response Headers:
 * - RateLimit-Limit: 100
 * - RateLimit-Remaining: XX
 * - RateLimit-Reset: timestamp
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máx 100 requisições
  message: {
    error: "Muitas requisições. Tente novamente em 15 minutos.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true, // retorna `RateLimit-*` headers
  legacyHeaders: false, // desabilita `X-RateLimit-*` headers
  skip: (req) => {
    // Não rate-limit health checks
    return req.path === "/api/health";
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "Limite de requisições excedido. Tente novamente em 15 minutos.",
      retryAfter: "15 minutos",
    });
  },
});

/**
 * Rate Limiter Restrito para Uploads
 *
 * Configuração:
 * - Janela: 1 hora
 * - Limite: 50 uploads por IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // máx 50 uploads
  message: {
    error: "Limite de uploads atingido. Tente novamente em 1 hora.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Limite de uploads excedido. Tente novamente em 1 hora.",
      retryAfter: "1 hora",
    });
  },
});

/**
 * Rate Limiter Muito Restrito para Transcrição
 *
 * Configuração:
 * - Janela: 1 hora
 * - Limite: 20 transcrições por IP
 */
export const transcribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // máx 20 transcrições
  message: {
    error: "Limite de transcrições atingido. Tente novamente em 1 hora.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Limite de transcrições excedido. Tente novamente em 1 hora.",
      retryAfter: "1 hora",
    });
  },
});

/**
 * Rate Limiter Específico para Admin
 *
 * Configuração:
 * - Janela: 1 hora
 * - Limite: 10 operações admin por IP
 */
export const adminLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máx 10 operações
  message: {
    error:
      "Limite de operações administrativas atingido. Tente novamente em 1 hora.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});
