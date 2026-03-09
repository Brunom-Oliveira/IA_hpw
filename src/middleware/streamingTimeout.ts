import { Request, Response, NextFunction } from "express";

/**
 * Configuração de timeout para diferentes endpoints
 */
export const STREAMING_TIMEOUT_CONFIG = {
  "/api/chat/ask": 5 * 60 * 1000, // 5 minutos para stream de chat
  "/api/documents/reindex": 10 * 60 * 1000, // 10 minutos para reindexação
  default: 5 * 60 * 1000, // 5 minutos padrão
};

/**
 * Obter timeout baseado na rota
 */
function getTimeoutForRoute(path: string): number {
  for (const [route, timeout] of Object.entries(STREAMING_TIMEOUT_CONFIG)) {
    if (route !== "default" && path.includes(route)) {
      return timeout;
    }
  }
  return STREAMING_TIMEOUT_CONFIG.default;
}

/**
 * Middleware de timeout para streams
 * Interrompe respostas longas e envia resposta parcial
 */
export function streamingTimeoutMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Detectar se é stream pela query string ou header
    const isStream = req.query.stream === "true" || req.body?.stream === true;

    if (!isStream) {
      next();
      return;
    }

    const timeout = getTimeoutForRoute(req.path);
    let hasEnded = false;
    let bufferedData: string[] = [];

    // Armazenar métodos originais
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalJson = res.json.bind(res);

    /**
     * Verificar se é resposta SSE (Server-Sent Events)
     */
    const isSSE = () => {
      const contentType = res.getHeader("Content-Type");
      return typeof contentType === "string" && contentType.includes("text/event-stream");
    };

    /**
     * Enviar resposta de timeout de forma segura
     */
    const sendTimeoutResponse = () => {
      if (hasEnded) return;

      hasEnded = true;

      try {
        if (isSSE() && !res.writableEnded) {
          // Para streams SSE, enviar evento de timeout
          const timeoutEvent = {
            type: "timeout",
            message: "Tempo limite de requisição atingido",
            bufferedCount: bufferedData.length,
          };
          res.write(
            `data: ${JSON.stringify(timeoutEvent)}\n\n`
          );
        }

        if (!res.writableEnded) {
          res.end();
        }
      } catch (error) {
        console.error("Erro ao enviar resposta de timeout", error);
      }
    };

    /**
     * Substituir método write para capturar dados
     */
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (hasEnded) return false;

      if (typeof chunk === "string") {
        bufferedData.push(chunk);
      }

      return originalWrite(chunk, ...args);
    } as any;

    /**
     * Substituir método end
     */
    res.end = function (...args: any[]): any {
      if (!hasEnded) {
        hasEnded = true;
        clearTimeout(timeoutHandle);
      }
      return originalEnd(...args);
    } as any;

    /**
     * Substituir método json
     */
    res.json = function (body: any): any {
      if (!hasEnded) {
        hasEnded = true;
        clearTimeout(timeoutHandle);
      }
      return originalJson(body);
    } as any;

    /**
     * Configurar timeout
     */
    const timeoutHandle = setTimeout(() => {
      if (!hasEnded) {
        sendTimeoutResponse();
      }
    }, timeout);

    /**
     * Limpar timeout se requisição fechar
     */
    req.on("close", () => {
      clearTimeout(timeoutHandle);
      hasEnded = true;
    });

    req.on("abort", () => {
      clearTimeout(timeoutHandle);
      hasEnded = true;
    });

    next();
  };
}

/**
 * Middleware alternativo: AbortSignal com timeout
 * Para uso com controllers que suportam AbortSignal
 */
export function createAbortSignalWithTimeout(
  timeoutMs: number = STREAMING_TIMEOUT_CONFIG.default
): AbortSignal {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // Limpar timeout se signal abortar antes
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutHandle);
  });

  return controller.signal;
}

/**
 * Wrapper para proteger promises com timeout
 */
export async function withStreamingTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = STREAMING_TIMEOUT_CONFIG.default,
  onTimeout?: () => void
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`Stream timeout após ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export default streamingTimeoutMiddleware;
