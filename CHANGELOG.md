# CHANGE LOG - IA HarpiaWMS Improvements

**Início do Projeto de Melhoria**: 07 de Março de 2026  
**Versão do Projeto**: v1.0.0 → v1.1.0 (em progresso)

---

## 📋 FORMATO DE REGISTRO

```
## [DATA] - [VERSÃO SNAPSHOT]

### [ID] - Descrição da Mudança
- **Componente**: Arquivo(s) afetado(s)
- **Tipo**: Security | Feature | Fix | Refactor | Docs | Test
- **Criticidade**: 🔴 Crítica | 🟠 Alta | 🟡 Média | 🟢 Baixa
- **Justificativa**: Por que foi feita
- **Impacto**: O que muda para o usuário/desenvolvedor
- **Testes**: Testes adicionados ou modificados
- **Breaking**: Sim/Não - alguma compatibilidade quebrada?
- **Revisão**: Checklist de verificação
- **Auditoria**: ID de commit/PR

---
```

## 📝 HISTÓRICO DE MUDANÇAS

### [07/03/2026] - Fase 1: Segurança e Críticos - INICIADO ✅

#### [SEC-001] ✅ CONCLUÍDO - Multer Versão Segura 1.4.5-lts.2

- **Componente**: `package.json`, `npm` dependencies
- **Tipo**: Security
- **Criticidade**: 🔴 Crítica
- **Justificativa**: 3 vulnerabilidades HIGH em multer@1.4.5-lts.1 - VERIFICADO E FECHADO ✅
- **Impacto**:
  - ✅ Fecha buraco de segurança
  - ✅ Zero breaking changes
  - ✅ Compatível com código existente
- **Testes Realizados**:
  - ✅ `npm audit` mostra 0 vulnerabilidades
  - ✅ `npm list multer` confirma 1.4.5-lts.2
  - ✅ package-lock.json atualizado
  - ✅ Sem conflitos de dependência
- **Breaking**: Não
- **Auditoria**:
  - Commit: `fix(security): [SEC-001] multer atualizado para 1.4.5-lts.2`
  - Data: 07/03/2026
  - Status: ✅ COMPLETO

#### [MAINT-001] ✅ CONCLUÍDO - Remover Código Morto (Chroma DB)

- **Componente**: `src/services/vector-db/chromaVectorDbService.ts`
- **Tipo**: Refactor
- **Criticidade**: 🔴 Crítica (bloqueador de build)
- **Justificativa**:
  - Código desatualizado causa confusão
  - Não é usado em runtime (Qdrant é o VectorDB oficial)
  - Confunde novos desenvolvedores
- **Arquivos Modificados**:
  ```
  ✓ src/services/vector-db/chromaVectorDbService.ts           [DELETED]
  ✓ src/scripts/index-documents.ts                            [UPDATED - imports]
  ✓ src/services/vector-db/qdrantVectorDbService.ts           [NO CHANGE]
  ```
- **Mudanças Executadas**:
  - ✅ Arquivo chromaVectorDbService.ts removido
  - ✅ Import em index-documents.ts atualizado para QdrantVectorDbService
  - ✅ Construtor de RagService ajustado (ChromaVectorDbService → QdrantVectorDbService)
  - ✅ Verificação de build: nenhum novo erro introduzido
- **Testes Realizados**:
  - ✅ `npm run build` executado - apenas PRÉ-EXISTENTES erros (RAG services)
  - ✅ `git grep chromaVectorDbService` -> zero resultados (referências removidas)
  - ✅ index-documents.ts compila sem erros relacionados a imports
- **Breaking**: Não (código nunca foi utilizado em runtime)
- **Auditoria**:
  - Commit: `aa55db8`
  - Mensagem: "fix: [MAINT-001] remover chromaVectorDbService.ts e atualizar imports"
  - Data: 07/03/2026
  - Status: ✅ COMPLETO e VERIFICADO

---

#### [CODE-001] - Remover Imports Duplicados

- **Componente**: `src/app.ts` (linhas 1-5)
- **Tipo**: Fix
- **Criticidade**: 🟠 Alta
- **Justificativa**: Imports duplicadas causam confusão
- **Antes**:
  ```typescript
  import express from "express";
  import cors from "cors";
  import express from "express"; // ← DUP
  import cors from "cors"; // ← DUP
  ```
- **Depois**:
  ```typescript
  import express from "express";
  import cors from "cors";
  ```
- **Testes**:
  - [ ] `npm run lint` sem warnings
  - [ ] `npm run build` sem alterações
  - [ ] App inicia normalmente
- **Breaking**: Não
- **Auditoria**: [PENDENTE]

---

#### [BUILD-001] - Atualizar TypeScript moduleResolution

- **Componente**: `tsconfig.json`
- **Tipo**: Fix
- **Criticidade**: 🟠 Alta
- **Justificativa**: "Node" será removido em TypeScript 7.0
- **Mudança**:

  ```json
  // ANTES
  "moduleResolution": "Node"

  // DEPOIS
  "moduleResolution": "bundler"
  ```

- **Compatibilidade**:
  - TypeScript 5.x: ✅
  - TypeScript 6.x: ✅
  - TypeScript 7.x: ✅
- **Testes**:
  - [ ] `npm run build` sem typecheck errors
  - [ ] `npm run lint` sem warnings
- **Breaking**: Não
- **Auditoria**: [PENDENTE]

---

### [PLANEJADO] - Fase 2: Qualidade de Código

#### [ARCH-002] - Implementar Global Error Handler

- **Componente**: Novo `src/middleware/errorHandler.ts`, `src/app.ts`
- **Tipo**: Feature
- **Criticidade**: 🟠 Alta
- **Justificativa**:
  - Aumenta segurança (não vaza stack traces)
  - Centraliza logging
  - Consistência em respostas de erro
- **Arquivos a Criar**:
  - [ ] `src/middleware/errorHandler.ts` (nova função)
  - [ ] `src/utils/logger.ts` (novo logger)
- **Integração**:
  ```typescript
  // src/app.ts
  app.use(cors());
  app.use(express.json());
  // ... ROUTES ...
  app.use(errorHandler); // ← Último middleware
  ```
- **Testes Necessários**:
  - [ ] 404 não vaza stack trace
  - [ ] 500 não vaza stack trace
  - [ ] Erro em controller é capturado
  - [ ] Request ID aparece em erro
- **Exemplo de Teste**:
  ```typescript
  it("should not leak stack trace on 500 error", async () => {
    const res = await request(app).post("/api/bad-endpoint").send({});
    expect(res.status).toBe(500);
    expect(res.body.error).not.toContain("Error:");
    expect(res.body.error).not.toContain("at ");
  });
  ```
- **Breaking**: Não (apenas centraliza handlers existentes)
- **Auditoria**: [PENDENTE]

---

#### [AUDIT-001] - Request ID Tracking

- **Componente**: Novo `src/middleware/requestIdMiddleware.ts`
- **Tipo**: Feature
- **Criticidade**: 🟠 Alta
- **Justificativa**: Necessário para auditoria e rastreamento
- **Características**:
  - Gera UUID para cada request
  - Injeta em `req.requestId`
  - Retorna em response header `x-request-id`
  - Armazenado em logs
- **Arquivo Novo**:

  ```typescript
  // src/middleware/requestIdMiddleware.ts
  import { v4 as uuidv4 } from 'uuid';

  export function requestIdMiddleware(...) {
    // Implementar
  }
  ```

- **Uso em app.ts**:
  ```typescript
  app.use(requestIdMiddleware); // ← Primeiro middleware
  app.use(errorHandler);
  ```
- **Testes**:
  - [ ] Request sem header x-request-id gera novo
  - [ ] Request com header x-request-id preserva
  - [ ] Response contém x-request-id header
  - [ ] Request ID é UUID válido
- **Breaking**: Não
- **Auditoria**: [PENDENTE]

---

#### [QUAL-001] - Validação de Entrada com Zod

- **Componente**: Novo `src/schemas/`, middleware `src/middleware/validateRequest.ts`
- **Tipo**: Feature
- **Criticidade**: 🟠 Alta
- **Justificativa**:
  - Type-safe validation em runtime
  - Reutilizável entre endpoints
  - Mensagens de erro detalhadas
- **Pacotes Necessários**:
  ```bash
  npm install zod
  npm install -D @types/zod  # (se necessário)
  ```
- **Arquivos a Criar**:
  - [ ] `src/schemas/documents.schema.ts`
  - [ ] `src/schemas/chat.schema.ts`
  - [ ] `src/schemas/upload.schema.ts`
  - [ ] `src/middleware/validateRequest.ts`
- **Exemplo Schema**:

  ```typescript
  // src/schemas/documents.schema.ts
  import { z } from 'zod';

  export const InsertDocumentsSchema = z.object({
    documents: z.array(
      z.object({
        text: z.string().min(1),
        metadata: z.record(...).optional(),
      })
    ).min(1),
  });
  ```

- **Uso em Rotas**:
  ```typescript
  router.post(
    "/documents",
    validateRequest(InsertDocumentsSchema),
    documentController.insertDocuments,
  );
  ```
- **Testes**:
  - [ ] Invalid data retorna 400 com mensagens claras
  - [ ] Valid data passa para controller
  - [ ] Schema rejeita tipos inválidos
- **Breaking**: Não (apenas mais validação)
- **Auditoria**: [PENDENTE]

---

#### [SEC-002] - Fortalecer Admin Guard

- **Componente**: `src/middleware/adminGuard.ts`
- **Tipo**: Security
- **Criticidade**: 🟡 Média
- **Mudanças**:
  - Apenas Bearer token (não mais fallback x-rag-admin-token)
  - Logging de tentativas de acesso
  - Request ID em resposta de erro
- **Testes**:
  - [ ] Rejeita request sem Authorization header
  - [ ] Rejeita token inválido
  - [ ] Aceita Bearer token válido
  - [ ] Loga tentativa de unauthorized access
- **Breaking**: Sim - se estiver usando header x-rag-admin-token (documentar migração)
- **Auditoria**: [PENDENTE]

---

### [PLANEJADO] - Fase 3: Funcionalidade

#### [PERF-001] - Rate Limiting

- **Componente**: Novo `src/middleware/rateLimiter.ts`
- **Tipo**: Feature
- **Criticidade**: 🟡 Média
- **Justificativa**: Proteção contra DoS/abuso
- **Pacotes**:
  ```bash
  npm install express-rate-limit
  ```
- **Configuração**:
  - API geral: 100 req/15min
  - Upload: 50 uploads/hora
- **Testes**:
  - [ ] Request 101 após 100 retorna 429
  - [ ] Contador reset após janela
- **Breaking**: Não (proteção adicional)
- **Auditoria**: [PENDENTE]

---

#### [SEC-003] - Validação de Upload de Arquivo

- **Componente**: `src/controllers/documentController.ts`, novo `src/utils/fileValidator.ts`
- **Tipo**: Security
- **Criticidade**: 🟡 Média
- **Mudanças**:
  - Validar MIME type
  - Limitar tamanho (50MB)
  - Rejeitar arquivos perigosos
- **MIME Allowed**:
  ```
  application/pdf
  text/plain
  application/msword
  application/vnd.openxmlformats-officedocument.wordprocessingml.document
  ```
- **Testes**:
  - [ ] Rejeita .exe, .sh, etc
  - [ ] Rejeita arquivo > 50MB
  - [ ] Aceita PDF válido
- **Breaking**: Não (apenas mais restritivo)
- **Auditoria**: [PENDENTE]

---

#### [UX-001] - Frontend Error Handler

- **Componente**: `frontend/src/api.js`
- **Tipo**: Feature
- **Criticidade**: 🟡 Média
- **Mudanças**:
  - Response interceptor para erros 5xx
  - Mensagens amigáveis
  - Retorna request ID
- **Testes**:
  - [ ] 500 error mostra mensagem genérica
  - [ ] Timeout mostra mensagem apropriada
- **Breaking**: Não
- **Auditoria**: [PENDENTE]

---

#### [PERF-002] - Streaming com Timeout

- **Componente**: `src/controllers/chatController.ts`
- **Tipo**: Feature
- **Criticidade**: 🟡 Média
- **Mudanças**:
  - Adiciona timeout configurável para streaming
  - Limpa recursos corretamente
- **Env Var**:
  ```
  CHAT_STREAM_TIMEOUT_MS=600000  # 10 minutos
  ```
- **Testes**:
  - [ ] Stream timeout após 10 minutos
  - [ ] Recursos liberados
- **Breaking**: Não
- **Auditoria**: [PENDENTE]

---

### [PLANEJADO] - Fase 4: Testes e Documentação

#### [TEST-001] - Expandir Suite de Testes

- **Componente**: `tests/`
- **Tipo**: Test
- **Criticidade**: 🟡 Média
- **Meta de Cobertura**: 80%+
- **Novos Testes**:
  - [ ] Security tests (validation, auth, file upload)
  - [ ] Error handler tests
  - [ ] Request ID middleware tests
  - [ ] Rate limiter tests
  - [ ] Integration tests
- **Target Files**:

  ```
  tests/security/
    ├── validation.test.ts (NOVO)
    ├── fileUpload.test.ts (NOVO)
    └── adminGuard.test.ts (EXPANDIDO)

  tests/unit/
    ├── errorHandler.test.ts (NOVO)
    ├── requestIdMiddleware.test.ts (NOVO)
    └── ragService.test.ts (EXPANDIDO)

  tests/integration/
    ├── api.test.ts (NOVO)
    └── e2e/
        └── chatFlow.e2e.ts (NOVO)
  ```

- **Executar**:
  ```bash
  npm run test
  npm run test:coverage
  ```
- **Auditoria**: [PENDENTE]

---

#### [DOCS-001] - Criar ADRs (Architecture Decision Records)

- **Componente**: `docs/adr/`
- **Tipo**: Docs
- **Criticidade**: 🟢 Baixa
- **ADRs Necessárias**:
  - [ ] `docs/adr/0001-single-vector-db-qdrant.md` (Chroma vs Qdrant)
  - [ ] `docs/adr/0002-zod-for-validation.md` (Validação)
  - [ ] `docs/adr/0003-global-error-handler.md` (Err Handling)
  - [ ] `docs/adr/0004-request-id-tracking.md` (Auditoria)
- **Formato**:

  ```markdown
  # ADR-000X: Título

  ## Status

  [Decidido|Rejeitado|Deprecated]

  ## Contexto

  ## Decisão

  ## Alternativas Consideradas

  ## Consequências
  ```

- **Auditoria**: [PENDENTE]

---

#### [DOCS-002] - Atualizar README

- **Componente**: `README.md`
- **Tipo**: Docs
- **Mudanças Necessárias**:
  - [ ] Adicionar seção "Segurança"
  - [ ] Documentar variáveis de ambiente novas
  - [ ] Adicionar guia de desenvolvimento
- **Auditoria**: [PENDENTE]

---

### [PLANEJADO] - Fase 5: Otimização

#### [PERF-003] - Criar Índices Qdrant

- **Componente**: `src/services/vector-db/qdrantVectorDbService.ts`
- **Tipo**: Feature
- **Criticidade**: 🟢 Baixa
- **Mudanças**:
  - Criar índice HNSW automaticamente
  - Otimizar parâmetros
- **Testes**:
  - [ ] Índice é criado no boot
  - [ ] Search performance melhora
- **Auditoria**: [PENDENTE]

---

#### [PERF-004] - Implementar Cache Warming

- **Componente**: `src/services/ragService.ts`
- **Tipo**: Feature
- **Criticidade**: 🟢 Baixa
- **Justificativa**: Primeira query sempre é lenta (cold start)
- **Solução**:
  - Pre-embedder queries comuns
  - Warm cache no boot
- **Auditoria**: [PENDENTE]

---

## 📊 RESUMO DE PROGRESSO

### Geral

```
Tarefas Planejadas: 18
Tarefas Completadas: 0
Tarefas Em Progresso: 0
Tarefas Restantes: 18

Progresso: 0%
```

### Por Fase

```
Fase 1 (Crítica):     0/4 completadas
Fase 2 (Qualidade):   0/4 completadas
Fase 3 (Funcional):   0/5 completadas
Fase 4 (Testes):      0/3 completadas
Fase 5 (Otimização):  0/2 completadas
```

---

## 🔗 FORMATO DE PULL REQUEST

Ao criar PR, use este template:

```markdown
## Descrição

[Descrever mudança]

## Related Issues

Fecha #AUDIT_IMPROVEMENT_PLAN

## Tipo de Mudança

- [ ] Security
- [ ] Feature
- [ ] Fix
- [ ] Refactor
- [ ] Docs
- [ ] Test

## Checklist

- [ ] Testes adicionados/modificados
- [ ] Documentação atualizada
- [ ] `npm run lint` passa
- [ ] `npm run build` produz output válido
- [ ] `npm run test` todos passam
- [ ] Sem breaking changes OU documentado

## Impacto

- [ ] Backend
- [ ] Frontend
- [ ] Infraestrutura
- [ ] Documentação
```

---

## 📞 CONTATO E QUESTÕES

**Documento de Referência**: `docs/AUDIT_IMPROVEMENT_PLAN.md`  
**Questões**? Consulte a análise detalhada.

---

**Último Update**: 07/03/2026  
**Próximo Review**: 07/04/2026
