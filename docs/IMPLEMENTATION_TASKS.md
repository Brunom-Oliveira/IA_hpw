# TAREFAS DE IMPLEMENTAÇÃO DETALHADAS

**Projeto**: IA HarpiaWMS Improvements  
**Data**: 07 de Março de 2026  
**Status**: Pronto para Implementação

---

## 🚀 COMO USAR ESTE DOCUMENTO

Este documento detalha cada tarefa com:

1. Problema específico
2. Solução passo a passo
3. Código de implementação
4. Testes a executar
5. Verificação de sucesso

Use este guia para executar as melhorias em sequência.

---

## FASE 1: SEGURANÇA E CRÍTICOS (Dias 1-3)

### TAREFA 1.1: Atualizar Multer (30 min)

**ID**: SEC-001  
**Risco**: 🟢 Baixo (apenas update)  
**Benefício**: 🔴 Crítico (segurança)

#### Passo 1: Verificar Vulnerabilidades Atuais

```bash
npm audit
# Deve mostrar 3 vulnerabilidades HIGH em multer
```

#### Passo 2: Atualizar Multer

```bash
npm update multer
# Ou especificamente:
npm install multer@^1.4.5-lts.2
```

#### Passo 3: Verificar Resultado

```bash
npm audit
# Deve mostrar 0 vulnerabilidades
npm run build
npm run test
```

#### Evidência de Sucesso

```bash
✅ npm audit mostra 0 vulnerabilidades
✅ npm run build sem erros
✅ npm run test todos passam
✅ package-lock.json atualizado
```

**Tempo Esperado**: 5 minutos  
**Dificuldade**: ⭐ Trivial

---

### TAREFA 1.2: Remover Chroma DB Morto (45 min)

**ID**: MAINT-001  
**Risco**: 🟢 Baixo (código não usado)  
**Benefício**: 🟠 Alto (limpa build)

#### Passo 1: Verificar que Arquivo Não é Importado

```bash
grep -r "chromaVectorDbService" src/ --include="*.ts"
# Não deve encontrar nada além do próprio arquivo
```

#### Passo 2: Verificar Testes

```bash
grep -r "chromaVectorDbService" tests/ --include="*.ts"
# Não deve encontrar nada
```

#### Passo 3: Remover Arquivo

```bash
rm src/services/vector-db/chromaVectorDbService.ts
```

#### Passo 4: Verificar Build

```bash
npm run build
# Deve compilar sem erros
npm run lint
```

#### Passo 5: Confirmar Qdrant é Único VectorDB

```typescript
// Verificar que em src/app.ts apenas Qdrant é registrado
// Deve haver:
container.register(InjectionTokens.VectorDbPort, {
  useClass: QdrantVectorDbService,
});
```

**Teste de Verificação**:

```bash
npm run test -- tests/security/vectordb.test.ts
# (criar arquivo se não existir)
```

**Tempo Esperado**: 15 minutos  
**Dificuldade**: ⭐ Trivial

---

### TAREFA 1.3: Remover Imports Duplicadas (15 min)

**ID**: CODE-001  
**Risco**: 🟢 Trivial  
**Impacto**: 🟢 Legibilidade

#### Passo 1: Abrir Arquivo

```
src/app.ts (linhas 1-5)
```

#### Passo 2: Encontrar Duplicatas

```typescript
// ❌ ANTES (linhas 1-5)
import express from "express";
import cors from "cors";
import express from "express"; // ← LINHA 3 DUPLICADA
import cors from "cors"; // ← LINHA 4 DUPLICADA
import { container } from "tsyringe";
```

#### Passo 3: Remover Linhas 3-4

```typescript
// ✅ DEPOIS
import express from "express";
import cors from "cors";
import { container } from "tsyringe";
```

#### Verificar

```bash
npm run lint
# Sem warnings
```

**Tempo Esperado**: 2 minutos  
**Dificuldade**: ⭐ Trivial

---

### TAREFA 1.4: Atualizar TypeScript Config (15 min)

**ID**: BUILD-001  
**Risco**: 🟢 Nenhum (config compatível)  
**Benefício**: 🟡 Futuro-proof

#### Passo 1: Abrir tsconfig.json

```json
// ANTES (linha 5)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",    // ← DEPRECATED
    ...
  }
}
```

#### Passo 2: Atualizar moduleResolution

```json
// DEPOIS
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "bundler",  // ← NOVO
    ...
  }
}
```

#### Passo 3: Verificar Compatibilidade

```bash
npm run build
# Sem warnings deprecation
npm run lint
```

**Tempo Esperado**: 3 minutos  
**Dificuldade**: ⭐ Trivial

**Checklist Fase 1**:

- [ ] Multer atualizado (SEC-001)
- [ ] Chroma removido (MAINT-001)
- [ ] Imports duplicadas removidas (CODE-001)
- [ ] TypeScript config atualizado (BUILD-001)
- [ ] `npm run build` limpo
- [ ] `npm run test` todos passam

---

## FASE 2: QUALIDADE DE CÓDIGO (Dias 4-8)

### TAREFA 2.1: Request ID Middleware (1 hora)

**ID**: AUDIT-001  
**Risco**: 🟢 Nenhum (adiciona feature)  
**Benefício**: 🟠 Alto (auditoria)

#### Passo 1: Criar Novo Arquivo

```bash
touch src/middleware/requestIdMiddleware.ts
```

#### Passo 2: Implementar Middleware

```typescript
// src/middleware/requestIdMiddleware.ts
import { v4 as uuidv4 } from "uuid";
import { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Se já tem header, usar; senão gerar nova
  const requestId = req.header("x-request-id") || uuidv4();

  // Armazenar em req para logs
  req.requestId = requestId;

  // Retornar em response
  res.setHeader("x-request-id", requestId);

  next();
}
```

#### Passo 3: Integrar em app.ts

```typescript
// src/app.ts - APÓS imports, ANTES de rotas
import { requestIdMiddleware } from "./middleware/requestIdMiddleware";

export const buildApp = () => {
  // ... código existing ...

  const app = express();

  // ← ADICIONAR AQUI (PRIMEIRO middleware)
  app.use(requestIdMiddleware);

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  // ... resto do código ...
};
```

#### Passo 4: Exportar interface para tipos

```typescript
// src/types/index.ts - adicionar ao final
export interface RequestWithId extends Request {
  requestId?: string;
}
```

#### Passo 5: Criar Teste

```typescript
// tests/unit/requestIdMiddleware.test.ts (NOVO)
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";

describe("Request ID Middleware", () => {
  const app = buildApp();

  it("should generate unique request ID when not provided", async () => {
    const res = await request(app).get("/api/health");

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}/);
  });

  it("should preserve provided x-request-id header", async () => {
    const customId = "550e8400-e29b-41d4-a716-446655440000";
    const res = await request(app)
      .get("/api/health")
      .set("x-request-id", customId);

    expect(res.headers["x-request-id"]).toBe(customId);
  });

  it("should attach requestId to req object", async () => {
    // Este teste acessará req.requestId internamente
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});
```

#### Passo 6: Executar Testes

```bash
npm run test -- tests/unit/requestIdMiddleware.test.ts
# Deve passar com 3 testes
```

**Tempo Esperado**: 35 minutos  
**Dificuldade**: ⭐⭐ Básico

---

### TAREFA 2.2: Global Error Handler (1.5 horas)

**ID**: ARCH-002  
**Risco**: 🟡 Médio (refatoração de erro handling)  
**Benefício**: 🟠 Alto (segurança + auditoria)

#### Passo 1: Criar Logger Simples

```bash
touch src/utils/logger.ts
```

```typescript
// src/utils/logger.ts
export interface LogEntry {
  requestId?: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  [key: string]: any;
}

export class Logger {
  private formatLog(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  }

  info(data: Partial<LogEntry>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "info" as const,
      message: "",
      ...data,
    };
    console.log(this.formatLog(entry));
  }

  warn(data: Partial<LogEntry>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "warn" as const,
      message: "",
      ...data,
    };
    console.warn(this.formatLog(entry));
  }

  error(data: Partial<LogEntry>): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: "error" as const,
      message: "",
      ...data,
    };
    console.error(this.formatLog(entry));
  }
}

export const logger = new Logger();
```

#### Passo 2: Criar Error Handler Middleware

```bash
touch src/middleware/errorHandler.ts
```

```typescript
// src/middleware/errorHandler.ts
import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export class HttpError extends Error {
  constructor(
    public statusCode: number = 500,
    message: string = "Internal Server Error",
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = (req as any).requestId;

  // Determinar status code
  let statusCode = 500;
  let message = "Erro interno do servidor";

  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    message = error.message;
  } else if (error.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Não autorizado";
  }

  // Log para auditoria
  logger.error({
    requestId,
    statusCode,
    errorName: error.name,
    message: error.message,
    path: req.path,
    method: req.method,
    userAgent: req.get("user-agent"),
    // Incluir stack apenas se não for erro HTTP esperado
    stack: statusCode === 500 ? error.stack : undefined,
  });

  // Resposta segura ao cliente
  const responseBody = {
    error: statusCode === 500 ? "Erro ao processar requisição" : message,
    requestId,
    ...(process.env.NODE_ENV === "development" && {
      debug: {
        message: error.message,
        name: error.name,
      },
    }),
  };

  res.status(statusCode).json(responseBody);
}
```

#### Passo 3: Integrar em app.ts

```typescript
// src/app.ts
import { errorHandler } from "./middleware/errorHandler";
import { requestIdMiddleware } from "./middleware/requestIdMiddleware";

export const buildApp = () => {
  const app = express();

  // Middlewares de entrada (ordem importante!)
  app.use(requestIdMiddleware);
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  // ... ROTAS ...

  // Error handler deve ser ÚLTIMO middleware
  app.use(errorHandler);

  return app;
};
```

#### Passo 4: Remover Try-Catch de Controllers (opcional)

```typescript
// ANTES - src/controllers/chatController.ts
try {
  const result = await this.ragService.ask(message, topK);
  res.json(result);
} catch (error: any) {
  res.status(500).json({ error: error.message || "Erro no processamento" });
}

// DEPOIS (com error handler global)
const result = await this.ragService.ask(message, topK);
res.json(result);
// Erro é automaticamente capturado pelo handler
```

#### Passo 5: Criar Testes

```typescript
// tests/unit/errorHandler.test.ts (NOVO)
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";
import express, { Request, Response, NextFunction } from "express";
import { errorHandler, HttpError } from "../../src/middleware/errorHandler";

describe("Error Handler", () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    app = buildApp();
  });

  it("should catch unhandled error and return 500", async () => {
    const testApp = express();
    testApp.use((req, res) => {
      throw new Error("Test error");
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get("/");
    expect(res.status).toBe(500);
    expect(res.body.error).toContain("Erro");
  });

  it("should not leak stack trace in production", async () => {
    const backupEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    // Test...

    process.env.NODE_ENV = backupEnv;
  });

  it("should include requestId in error response", async () => {
    const res = await request(app).get("/api/bogus-endpoint");
    expect(res.body.requestId).toBeDefined();
  });
});
```

#### Passo 6: Executar Testes

```bash
npm run test -- tests/unit/errorHandler.test.ts
```

**Tempo Esperado**: 50 minutos  
**Dificuldade**: ⭐⭐⭐ Intermediário

---

### TAREFA 2.3: Validação com Zod (2 horas)

**ID**: QUAL-001  
**Risco**: 🟡 Médio (refatoração de validação)  
**Benefício**: 🟠 Alto (type safety)

#### Passo 1: Instalar Zod

```bash
npm install zod
```

#### Passo 2: Criar Pasta de Schemas

```bash
mkdir -p src/schemas
touch src/schemas/documents.schema.ts
touch src/schemas/chat.schema.ts
touch src/schemas/utils.ts
```

#### Passo 3: Criar Schemas

```typescript
// src/schemas/utils.ts
import { z } from "zod";

// Reutilizável
export const metadata = z
  .record(z.union([z.string(), z.number(), z.boolean()]))
  .optional();
```

```typescript
// src/schemas/documents.schema.ts
import { z } from "zod";
import { metadata } from "./utils";

export const InsertDocumentsSchema = z.object({
  documents: z
    .array(
      z.object({
        text: z
          .string()
          .min(1, "Texto não pode ser vazio")
          .max(50000, "Texto muito longo"),
        metadata,
      }),
    )
    .min(1, "Pelo menos um documento é obrigatório")
    .max(100, "Máximo 100 documentos por request"),
});

export type InsertDocumentsRequest = z.infer<typeof InsertDocumentsSchema>;

export const SearchSchema = z.object({
  query: z
    .string()
    .min(1, "Query não pode ser vazia")
    .max(1000, "Query muito longa"),
  topK: z.number().int().min(1).max(10).optional(),
});

export type SearchRequest = z.infer<typeof SearchSchema>;
```

```typescript
// src/schemas/chat.schema.ts
import { z } from "zod";

export const ChatSchema = z.object({
  message: z
    .string()
    .min(1, "Mensagem não pode ser vazia")
    .max(10000, "Mensagem muito longa"),
  topK: z.number().int().min(1).max(10).optional(),
  stream: z.boolean().optional().default(false),
});

export type ChatRequest = z.infer<typeof ChatSchema>;
```

#### Passo 4: Criar Middleware de Validação

```bash
touch src/middleware/validateRequest.ts
```

```typescript
// src/middleware/validateRequest.ts
import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { HttpError } from "./errorHandler";

export function validateRequest(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join("; ");

        throw new HttpError(400, `Validação falhou: ${errorMessages}`);
      }
      next(error);
    }
  };
}
```

#### Passo 5: Atualizar Rotas

```typescript
// src/routes/index.ts
import { validateRequest } from '../middleware/validateRequest';
import { InsertDocumentsSchema, ChatSchema, SearchSchema } from '../schemas';

export const createRoutes = (deps: /*...*/): Router => {
  const router = Router();

  router.post(
    '/documents',
    validateRequest(InsertDocumentsSchema),
    deps.documentController.insertDocuments
  );

  router.post(
    '/search',
    validateRequest(SearchSchema),
    deps.documentController.search
  );

  router.post(
    '/chat',
    validateRequest(ChatSchema),
    deps.chatController.ask
  );

  // ... resto
  return router;
};
```

#### Passo 6: Simplificar Controllers

```typescript
// src/controllers/documentController.ts
insertDocuments = async (req: Request, res: Response): Promise<void> => {
  // req.body já foi validado!
  const documents = req.body.documents; // type-safe
  const ids = await this.ragService.insertDocuments(documents);
  res.status(201).json({ inserted: ids.length, ids });
};
```

#### Passo 7: Testes

```typescript
// tests/unit/validation.test.ts (NOVO)
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";

describe("Request Validation", () => {
  const app = buildApp();

  describe("POST /api/documents", () => {
    it("should reject empty documents array", async () => {
      const res = await request(app)
        .post("/api/documents")
        .send({ documents: [] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Pelo menos um documento");
    });

    it("should reject documents with empty text", async () => {
      const res = await request(app)
        .post("/api/documents")
        .send({
          documents: [{ text: "" }],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("não pode ser vazio");
    });

    it("should accept valid documents", async () => {
      const res = await request(app)
        .post("/api/documents")
        .send({
          documents: [{ text: "Hello world" }],
        });

      expect(res.status).toBe(201);
    });
  });
});
```

**Tempo Esperado**: 1 hora 15 minutos  
**Dificuldade**: ⭐⭐⭐ Intermediário

---

### TAREFA 2.4: Fortalecer Admin Guard (45 min)

**ID**: SEC-002  
**Risco**: 🟡 Médio (breaking change em padrão de auth)  
**Benefício**: 🟠 Alto (segurança)

#### Passo 1: Atualizar adminGuard.ts

```typescript
// src/middleware/adminGuard.ts (SUBSTITUIR COMPLETAMENTE)
import { NextFunction, Request, Response } from "express";
import { env } from "../utils/env";
import { logger } from "../utils/logger";

export function adminGuard(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!env.ragAdminToken) {
    // Sem token configurado = sem autenticação requerida
    next();
    return;
  }

  // APENAS aceitar Bearer token (padrão HTTP)
  const authHeader = req.header("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const providedToken = match?.[1] || "";

  if (!providedToken) {
    const requestId = (req as any).requestId;
    logger.warn({
      requestId,
      event: "missing_auth_header",
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(401).json({
      error: "Token administrativo ausente",
      requestId,
    });
    return;
  }

  if (providedToken !== env.ragAdminToken) {
    const requestId = (req as any).requestId;
    logger.warn({
      requestId,
      event: "invalid_auth_token",
      ip: req.ip,
      path: req.path,
      method: req.method,
      tokenLength: providedToken.length,
    });

    res.status(401).json({
      error: "Token administrativo inválido",
      requestId,
    });
    return;
  }

  // Token válido
  const requestId = (req as any).requestId;
  logger.info({
    requestId,
    event: "admin_access_granted",
    ip: req.ip,
    path: req.path,
    method: req.method,
  });

  next();
}
```

#### Passo 2: Testar

```typescript
// tests/security/adminGuard.test.ts (NOVO ou EXPANDIDO)
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";

describe("Admin Guard", () => {
  const app = buildApp();
  const validToken = process.env.RAG_ADMIN_TOKEN || "test-token-123";

  beforeEach(() => {
    process.env.RAG_ADMIN_TOKEN = validToken;
  });

  it("should reject missing Authorization header", async () => {
    const res = await request(app).get("/api/rag/stats");
    expect(res.status).toBe(401);
    expect(res.body.error).toContain("ausente");
  });

  it("should reject invalid token", async () => {
    const res = await request(app)
      .get("/api/rag/stats")
      .header("Authorization", "Bearer invalid-token");

    expect(res.status).toBe(401);
    expect(res.body.error).toContain("inválido");
  });

  it("should accept valid Bearer token", async () => {
    const res = await request(app)
      .get("/api/rag/stats")
      .header("Authorization", `Bearer ${validToken}`);

    expect(res.status).toBe(200);
  });

  it("should reject x-rag-admin-token header (old format)", async () => {
    const res = await request(app)
      .get("/api/rag/stats")
      .header("x-rag-admin-token", validToken);

    expect(res.status).toBe(401);
  });
});
```

#### Documentação de Migração

Criar arquivo `docs/MIGRATION_AUTH.md`:

````markdown
# Migração de Autenticação

## Mudança em SEC-002

### Antes (Descontinuado)

```bash
curl -H "x-rag-admin-token: seu-token" http://api/rag/stats
```
````

### Depois (Novo Padrão)

```bash
curl -H "Authorization: Bearer seu-token" http://api/rag/stats
```

### Por Quê?

- Padrão HTTP oficial para Bearer tokens
- Melhor segurança (logging, auditoria)
- Compatível com ferramentas padrão

### Ação Necessária

Se você estava usando `x-rag-admin-token`:

1. Atualize seus scripts
2. Atualize sua documentação
3. Atualize seus testes

````

**Tempo Esperado**: 30 minutos
**Dificuldade**: ⭐⭐ Básico

**Checklist Fase 2**:
- [ ] Request ID Middleware (AUDIT-001)
- [ ] Global Error Handler (ARCH-002)
- [ ] Validação com Zod (QUAL-001)
- [ ] Admin Guard fortalecido (SEC-002)
- [ ] `npm run test` todos passam
- [ ] Documentação de migração criada

---

## FASE 3: FUNCIONALIDADE (Dias 9-12)

### TAREFA 3.1: Rate Limiting (1 hora)

**ID**: PERF-001
**Risco**: 🟢 Baixo (apenas proteção adicional)
**Benefício**: 🟡 Médio (segurança)

#### Passo 1: Instalar Dependência
```bash
npm install express-rate-limit
npm install -D @types/express-rate-limit
````

#### Passo 2: Criar Middleware

```bash
touch src/middleware/rateLimiter.ts
```

```typescript
// src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";

// Limiter geral para API
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
  keyGenerator: (req) => {
    // Usar IP para identificar cliente
    return req.ip || "unknown";
  },
});

// Limiter mais restrito para uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50, // máx 50 uploads
  message: {
    error: "Limite de uploads atingido. Tente novamente em 1 hora.",
  },
});

// Limiter ainda mais restrito para transcription
export const transcribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // máx 20 transcrições
  message: {
    error: "Limite de transcrições atingido. Tente novamente em 1 hora.",
  },
});
```

#### Passo 3: Integrar em app.ts

```typescript
// src/app.ts
import { apiLimiter, uploadLimiter, transcribeLimiter } from './middleware/rateLimiter';

export const buildApp = () => {
  const app = express();

  // Middlewares em ordem
  app.use(requestIdMiddleware);
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  // Rate limiters
  app.use('/api', apiLimiter);
  app.use('/api/documents/upload-manual', uploadLimiter);
  app.use('/api/transcribe', transcribeLimiter);

  // Rotas
  app.use('/api', createRoutes({...}));

  // Error handler
  app.use(errorHandler);

  return app;
};
```

#### Passo 4: Testes

```typescript
// tests/integration/rateLimiter.test.ts (NOVO)
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";

describe("Rate Limiter", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
  });

  it("should allow requests within limit", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
    }
  });

  it("should return 429 after limit exceeded", async () => {
    // Fazer muitos requests rapidamente
    for (let i = 0; i < 101; i++) {
      // Skip health check
      await request(app).get("/api/health");
    }

    // Próxima deve ser rate limited
    const res = await request(app).get("/api/chat").send({});
    expect(res.status).toBe(429);
  });
});
```

**Tempo Esperado**: 40 minutos  
**Dificuldade**: ⭐⭐ Básico

---

### TAREFA 3.2: Validação de Arquivo Upload (1.5 horas)

**ID**: SEC-003  
**Risco**: 🟡 Médio (rejeita uploads válidos antigos)  
**Benefício**: 🟠 Alto (segurança)

#### Passo 1: Criar Validador

```bash
touch src/utils/fileValidator.ts
```

```typescript
// src/utils/fileValidator.ts
import fs from "fs";
import path from "path";

export interface FileValidationConfig {
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  allowedExtensions?: string[];
}

const DEFAULT_CONFIG: FileValidationConfig = {
  allowedMimeTypes: [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  allowedExtensions: [".pdf", ".txt", ".md", ".doc", ".docx"],
};

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function validateFile(
  file: Express.Multer.File,
  config: FileValidationConfig = DEFAULT_CONFIG,
): boolean {
  // Validar MIME type
  if (
    config.allowedMimeTypes &&
    !config.allowedMimeTypes.includes(file.mimetype)
  ) {
    throw new FileValidationError(
      `Tipo de arquivo não permitido: ${file.mimetype}. ` +
        `Permitidos: ${config.allowedMimeTypes.join(", ")}`,
    );
  }

  // Validar tamanho
  if (config.maxSizeBytes && file.size > config.maxSizeBytes) {
    const maxMb = (config.maxSizeBytes / 1024 / 1024).toFixed(1);
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    throw new FileValidationError(
      `Arquivo muito grande: ${sizeMb}MB > ${maxMb}MB permitido`,
    );
  }

  // Validar extensão
  if (config.allowedExtensions) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
      throw new FileValidationError(
        `Extensão não permitida: ${ext}. ` +
          `Permitidas: ${config.allowedExtensions.join(", ")}`,
      );
    }
  }

  return true;
}

export function validateFiles(
  files: Express.Multer.File[],
  config: FileValidationConfig = DEFAULT_CONFIG,
): {
  valid: Express.Multer.File[];
  invalid: Array<{ file: Express.Multer.File; error: string }>;
} {
  const valid: Express.Multer.File[] = [];
  const invalid: Array<{ file: Express.Multer.File; error: string }> = [];

  for (const file of files) {
    try {
      validateFile(file, config);
      valid.push(file);
    } catch (error) {
      invalid.push({
        file,
        error: (error as Error).message,
      });
    }
  }

  return { valid, invalid };
}
```

#### Passo 2: Atualizar DocumentController

```typescript
// src/controllers/documentController.ts
import { validateFiles } from "../utils/fileValidator";

uploadManual = async (req: Request, res: Response): Promise<void> => {
  const files = this.extractUploadedFiles(req);
  if (!files.length) {
    res.status(400).json({ error: "Arquivo(s) obrigatório(s)" });
    return;
  }

  // NOVA VALIDAÇÃO
  const { valid, invalid } = validateFiles(files);

  if (invalid.length > 0 && valid.length === 0) {
    res.status(400).json({
      error: "Nenhum arquivo válido",
      details: invalid.map((item) => ({
        filename: item.file.originalname,
        error: item.error,
      })),
    });
    return;
  }

  const system = String(req.body?.system || "HARPIA WMS").trim();
  const module = String(req.body?.module || "Manual").trim();
  const sourceOverride = String(req.body?.source || "").trim();
  const titleOverride = String(req.body?.title || "").trim();

  const items: Array<Record<string, unknown>> = [];
  let totalInserted = 0;

  // Processar apenas arquivos válidos
  for (const file of valid) {
    try {
      const item = await this.processManualFile(file, {
        system,
        module,
        sourceOverride,
        titleOverride,
      });
      items.push(item);
      totalInserted += Number(item.inserted || 0);
    } catch (error) {
      items.push({
        file_name: file.originalname,
        status: "error",
        error: (error as Error)?.message || "Falha ao processar arquivo",
      });
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  // Adicionar inválidos no resultado
  for (const { file, error } of invalid) {
    items.push({
      file_name: file.originalname,
      status: "error",
      error,
    });
  }

  res.status(totalInserted > 0 ? 201 : 400).json({
    message:
      totalInserted > 0
        ? "Manual(is) indexado(s) com sucesso"
        : "Nenhum arquivo válido foi indexado",
    total_files: files.length,
    processed_files: valid.length,
    failed_files: valid.length + invalid.length,
    inserted: totalInserted,
    items,
  });
};
```

#### Passo 3: Testes

```typescript
// tests/security/fileUpload.test.ts (NOVO)
import { describe, it, expect } from "vitest";
import request from "supertest";
import path from "path";
import fs from "fs";
import { buildApp } from "../../src/app";

describe("File Upload Security", () => {
  const app = buildApp();
  let tempFile: string;

  const createTempFile = (content: string, ext: string) => {
    const file = path.join("/tmp", `test-${Date.now()}${ext}`);
    fs.writeFileSync(file, content);
    return file;
  };

  it("should accept valid PDF", async () => {
    const file = createTempFile("%PDF-1.4...", ".pdf");
    const res = await request(app)
      .post("/api/documents/upload-manual")
      .attach("files", file);

    expect(res.status).toBe(201);
  });

  it("should reject executable file", async () => {
    const file = createTempFile("MZ\x90\x00", ".exe");
    const res = await request(app)
      .post("/api/documents/upload-manual")
      .attach("files", file);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("válido");
  });

  it("should reject file exceeding size limit", async () => {
    const largeContent = "x".repeat(60 * 1024 * 1024); // 60MB
    const file = createTempFile(largeContent, ".txt");

    const res = await request(app)
      .post("/api/documents/upload-manual")
      .attach("files", file);

    expect(res.status).toBe(400);
    expect(res.body.details[0].error).toContain("muito grande");
  });
});
```

**Tempo Esperado**: 1 hora  
**Dificuldade**: ⭐⭐⭐ Intermediário

---

### TAREFA 3.3: Frontend Error Handler (45 min)

**ID**: UX-001  
**Risco**: 🟢 Baixo (apenas adiciona handler)  
**Benefício**: 🟡 Médio (UX melhor)

#### Passo 1: Atualizar API.js

```javascript
// frontend/src/api.js (ADICIONAR)
api.interceptors.response.use(
  (response) => {
    // Resposta bem-sucedida
    return response;
  },
  (error) => {
    // Erro na resposta
    if (error.response) {
      // O servidor respondeu com status diferente de 2xx
      const { status, data, headers } = error.response;

      if (status >= 500) {
        // Erro do servidor: mostrar mensagem genérica
        return Promise.reject({
          type: "server",
          message: "Erro ao processar sua requisição. Tente novamente.",
          status,
          requestId: headers["x-request-id"],
          details: process.env.NODE_ENV === "development" ? data : undefined,
        });
      } else if (status === 401) {
        // Não autorizado
        return Promise.reject({
          type: "auth",
          message: "Você não tem permissão para acessar este recurso.",
          status,
        });
      } else if (status === 400) {
        // Validação falhou
        return Promise.reject({
          type: "validation",
          message: data.error || "Dados inválidos.",
          status,
          details: data.details,
        });
      }
    } else if (error.code === "ECONNABORTED") {
      // Timeout
      return Promise.reject({
        type: "timeout",
        message: "A requisição demorou muito tempo. Tente novamente.",
      });
    } else if (error.message === "Network Error") {
      // Sem conexão
      return Promise.reject({
        type: "network",
        message: "Sem conexão com o servidor. Verifique sua internet.",
      });
    }

    // Erro desconhecido
    return Promise.reject({
      type: "unknown",
      message: error.message || "Erro inesperado",
    });
  },
);
```

#### Passo 2: Criar Hook para Erros

```javascript
// frontend/src/hooks/useApiError.js (NOVO)
import { useState } from "react";

export function useApiError() {
  const [error, setError] = useState(null);

  const handleError = (err) => {
    if (typeof err === "string") {
      setError({ message: err, type: "generic" });
    } else if (err?.type) {
      setError(err);
    } else {
      setError({ message: "Erro desconhecido", type: "unknown" });
    }
  };

  const clearError = () => setError(null);

  const getDisplayMessage = () => {
    if (!error) return "";

    switch (error.type) {
      case "server":
        return "⚠️ Erro do servidor. Tente novamente em alguns minutos.";
      case "auth":
        return "🔒 Você não tem permissão. Faça login novamente.";
      case "validation":
        return `📋 ${error.message}`;
      case "timeout":
        return "⏱️ Requisição demorou demais. Tente novamente.";
      case "network":
        return "🌐 Sem conexão com o servidor.";
      default:
        return error.message;
    }
  };

  return {
    error,
    setError,
    handleError,
    clearError,
    displayMessage: getDisplayMessage(),
  };
}
```

#### Passo 3: Usar em Componentes

```javascript
// frontend/src/pages/ChatRag.jsx (EXEMPLO)
import { useApiError } from "../hooks/useApiError";

export default function ChatRag() {
  const { error, handleError, clearError, displayMessage } = useApiError();
  // ... resto do componente

  async function handleAsk(event) {
    event.preventDefault();
    clearError();

    try {
      const response = await api.post("/api/chat", {
        message: question,
        stream: true,
      });
      // ... processar
    } catch (err) {
      handleError(err);
    }
  }

  return (
    <div>
      {error && (
        <div className="error-banner">
          <button onClick={clearError}>✕</button>
          <p>{displayMessage}</p>
        </div>
      )}
      {/* resto do componente */}
    </div>
  );
}
```

**Tempo Esperado**: 30 minutos  
**Dificuldade**: ⭐⭐ Básico

---

### TAREFA 3.4: Streaming com Timeout (1 hora)

**ID**: PERF-002  
**Risco**: 🟡 Médio (altera timeout behavior)  
**Benefício**: 🟡 Médio (estabilidade)

#### Passo 1: Adicionar Env Var

```bash
# .env
CHAT_STREAM_TIMEOUT_MS=600000  # 10 minutos (padrão)
```

#### Passo 2: Atualizar env.ts

```typescript
// src/utils/env.ts
export const env = {
  // ... existing
  chatStreamTimeoutMs: toNumber(process.env.CHAT_STREAM_TIMEOUT_MS, 600000),
};
```

#### Passo 3: Atualizar ChatController

```typescript
// src/controllers/chatController.ts
import { env } from "../utils/env";

ask = async (req: Request, res: Response): Promise<void> => {
  const { message, topK, stream } = req.body;

  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message obrigatoria" });
    return;
  }

  if (stream) {
    const abortController = new AbortController();

    // NOVO: Adicionar timeout
    const streamTimeout = setTimeout(() => {
      abortController.abort();
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            error: "Streaming timeout - requisição demorou muito tempo",
            done: true,
          })}\n\n`,
        );
        res.end();
      }
    }, env.chatStreamTimeoutMs);

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({ type: "heartbeat", ts: Date.now() })}\n\n`,
        );
      }
    }, 15000);

    const closeStream = () => {
      clearTimeout(streamTimeout);
      clearInterval(heartbeat);
      abortController.abort();
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    req.on("close", closeStream);
    req.on("aborted", closeStream);

    try {
      res.write(
        `data: ${JSON.stringify({ type: "status", phase: "Conexao estabelecida" })}\n\n`,
      );
      await this.ragService.askStream(
        message,
        (chunk) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
        },
        topK,
        { signal: abortController.signal },
      );
      res.end();
    } catch (error: any) {
      if (error.name === "AbortError") {
        // Timeout ocorreu
        if (!res.writableEnded) {
          res.write(
            `data: ${JSON.stringify({
              error: "Timeout - resposta não foi concluída a tempo",
            })}\n\n`,
          );
          res.end();
        }
      } else if (!abortController.signal.aborted && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    } finally {
      closeStream();
    }
    return;
  }

  // Modo não-streaming (mantém comportamento original)
  try {
    const result = await this.ragService.ask(message, topK);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Erro no processamento" });
  }
};
```

#### Passo 4: Testes

```typescript
// tests/integration/streaming.test.ts (NOVO)
import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { buildApp } from "../../src/app";

describe("Streaming Timeout", () => {
  const app = buildApp();

  it(
    "should timeout after configured duration",
    async () => {
      // Mock RagService para simular resposta lenta
      vi.stubGlobal("process", {
        env: { CHAT_STREAM_TIMEOUT_MS: "1000" }, // 1 segundo
      });

      const res = await request(app).post("/api/chat").send({
        message: "test",
        stream: true,
      });

      expect(res.status).toBe(200);
      // Response deve incluir timeout error
    },
    { timeout: 5000 },
  );
});
```

**Tempo Esperado**: 40 minutos  
**Dificuldade**: ⭐⭐⭐ Intermediário

**Checklist Fase 3**:

- [ ] Rate Limiting (PERF-001)
- [ ] Validação Upload (SEC-003)
- [ ] Frontend Error Handler (UX-001)
- [ ] Streaming Timeout (PERF-002)
- [ ] `npm run test` todos passam
- [ ] `npm run build` limpo

---

## FASE 4+: PRÓXIMAS FASES

Para poupar espaço neste documento, as fases 4 (Testes e Documentação) e 5 (Otimização) são descritas em `docs/AUDIT_IMPROVEMENT_PLAN.md`.

### Resumo Fase 4 (Testes e Docs)

- Expandir suite de testes para 80%+ cobertura
- Criar ADRs (Architecture Decision Records)
- Documentar mudanças em README

### Resumo Fase 5 (Otimização)

- Criar índices Qdrant
- Implementar cache warming
- Análise de performance

---

## ✅ RESUMO DE IMPLEMENTAÇÃO

### Tempo Total Estimado

```
Fase 1 (Crítica):    ~2 horas
Fase 2 (Qualidade):  ~5 horas
Fase 3 (Funcional):  ~4 horas
Fase 4 (Testes):     ~6 horas
Fase 5 (Otimização): ~3 horas

TOTAL:               ~20 horas
```

### Order Recomendada de Execução

```
Dia 1:
✅ 1.1 Atualizar Multer (30 min)
✅ 1.2 Remover Chroma DB (45 min)
✅ 1.3 Remover Imports Duplicadas (15 min)
✅ 1.4 TypeScript Config (15 min)

Dia 2-3:
✅ 2.1 Request ID Middleware (60 min)
✅ 2.2 Global Error Handler (90 min)
✅ 2.3 Validação Zod (120 min)
✅ 2.4 Admin Guard (45 min)

Dia 4:
✅ 3.1 Rate Limiting (60 min)
✅ 3.2 File Upload Validation (90 min)
✅ 3.3 Frontend Error Handler (45 min)
✅ 3.4 Streaming Timeout (60 min)

Dias 5-6:
✅ Testes (Fase 4)
✅ Documentação

Dia 7:
✅ Otimização (Fase 5)
```

---

## 🧪 EXECUTAR TODOS OS TESTES

```bash
# Testes unitários
npm run test

# Testes com cobertura
npm run test:coverage

# Testes específicos
npm run test -- tests/security/

# Build final
npm run build

# Lint
npm run lint
```

---

**Documento Vivo**: O(a) desenvolvedor(a) atualizará este doc conforme progride.

Last Updated: 07/03/2026
