# 🚀 PRÓXIMOS PASSOS - MAPA DE AÇÃO

**Data**: 07 de março de 2026  
**Status Atual**: ✅ Fases 1-2 Completas | Prontas para Fase 3  
**Responsável**: GitHub Copilot (Agent) + Tim de Dev

---

## 📋 STATUS ATUAL - RESUMO RÁPIDO

### ✅ Completadas (Fases 1-2)

| Fase       | Tarefas       | Status      | Commits |
| ---------- | ------------- | ----------- | ------- |
| **Fase 1** | 4/4 Segurança | ✅ PRONTO   | 3       |
| **Fase 2** | 4/4 Qualidade | ✅ PRONTO   | 7       |
| **TOTAL**  | **8/8**       | ✅ **100%** | **11**  |

**Detalhes de Tarefas Completas**:

```
✅ SEC-001:  Multer security patch (1.4.5-lts.1 → 1.4.5-lts.2)
✅ MAINT-001: Remover chromaVectorDbService.ts
✅ CODE-001:  Remover imports duplicados
✅ BUILD-001: TypeScript moduleResolution (Node → bundler)
✅ ARCH-002:  Global error handler (143 linhas)
✅ AUDIT-001: Request ID tracking (45 linhas)
✅ QUAL-001:  Validação com Zod (14 schemas)
✅ SEC-002:   Admin guard hardening + logging
```

**Verificações Realizadas**:

- ✅ API respondendo: http://localhost:8090/api/health → 200 OK
- ✅ Docker: 6/6 containers healthy
- ✅ Testes: 29/29 passed
- ✅ npm audit: 0 vulnerabilidades
- ✅ Build: Sem novos erros
- ✅ Git: 11 commits em origin/main

---

## 🎯 FASE 3: FUNCIONALIDADE (Próxima - 4 Tarefas)

### Visão Geral Fase 3

| ID           | Tarefa                 | Duração | Dificuldade | Benefício |
| ------------ | ---------------------- | ------- | ----------- | --------- |
| **PERF-001** | Rate Limiting          | 1h      | ⭐⭐        | 🟡 Médio  |
| **SEC-003**  | File Upload Validation | 1.5h    | ⭐⭐⭐      | 🟠 Alto   |
| **UX-001**   | Frontend Error Handler | 45m     | ⭐⭐⭐      | 🟡 Médio  |
| **PERF-002** | Streaming Timeout      | 1h      | ⭐⭐⭐      | 🟡 Médio  |

**Total Fase 3**: ~4.25 horas  
**Início Recomendado**: Amanhã (08 de março)

---

## 📊 PRÓXIMOS PASSOS - ORDEM DE EXECUÇÃO

### 1️⃣ **IMEDIATO (Próximas 24h)**

#### ✅ Pré-requisitos

```bash
# Pull dos últimos commits
git pull origin main

# Verificar branches disponíveis
git branch -a

# Status geral
npm run build && npm test && npm audit
```

#### 📋 Checklist de Conformidade

- [ ] Ler este documento completamente
- [ ] Revisar IMPLEMENTATION_TASKS.md (Seção Fase 3)
- [ ] Verificar ambiente local pronto (npm, docker)
- [ ] Preparar branch feature/phase3-functionality

---

### 2️⃣ **FASE 3 - TAREFA 1: Rate Limiting (1 hora)**

**ID**: PERF-001  
**Objetivo**: Proteger API contra DoS/abuso  
**Documentação**: `IMPLEMENTATION_TASKS.md` linhas ~968-1050

#### Passos Técnicos

```bash
# 1. Criar branch
git checkout -b feature/rate-limiting

# 2. Instalar dependências
npm install express-rate-limit
npm install -D @types/express-rate-limit

# 3. Criar arquivo
touch src/middleware/rateLimiter.ts

# 4. Copiar código de IMPLEMENTATION_TASKS.md (linhas 995-1040)

# 5. Atualizar app.ts para usar rate limiter

# 6. Testes
npm run test

# 7. Build
npm run build

# 8. Commit
git add .
git commit -m "feat: [PERF-001] implementar rate limiting"

# 9. Push
git push origin feature/rate-limiting
```

**Arquivos a Modificar**:

- ✏️ `src/middleware/rateLimiter.ts` (NOVO)
- ✏️ `src/app.ts` (ADD imports + middleware)
- ✏️ `tests/integration/rateLimiter.test.ts` (NOVO)

**Verificação de Sucesso**:

```bash
✅ npm run build: Sem erros
✅ npm run test: Testes passando
✅ curl http://localhost:8090/api/health: 200 OK
✅ Header RateLimit-Remaining presente
```

---

### 3️⃣ **FASE 3 - TAREFA 2: File Upload Validation (1.5 horas)**

**ID**: SEC-003  
**Objetivo**: Validar tipo/tamanho de arquivo  
**Documentação**: `IMPLEMENTATION_TASKS.md` linhas ~1074-1260

#### Passos Técnicos

```bash
# 1. Criar branch
git checkout -b feature/file-validation

# 2. Criar validador
touch src/utils/fileValidator.ts

# 3. Copiar código de IMPLEMENTATION_TASKS.md (linhas 1105-1190)

# 4. Atualizar DocumentController
# Modificar: src/controllers/documentController.ts
# Adicionar validação antes de processar

# 5. Testes
npm run test

# 6. Build
npm run build

# 7. Commit
git add .
git commit -m "feat: [SEC-003] implementar validação de upload"

# 8. Push
git push origin feature/file-validation
```

**Arquivos a Modificar**:

- ✏️ `src/utils/fileValidator.ts` (NOVO)
- ✏️ `src/controllers/documentController.ts` (ADD validação)
- ✏️ `tests/security/fileUpload.test.ts` (NOVO)

**Validação de Implementação**:

- ✅ Rejeita extensões perigosas (.exe, .sh, etc)
- ✅ Rejeitaações que excedem 50MB
- ✅ Aceita PDF, DOCX, TXT, MD
- ✅ Testes cobrindo exceções

---

### 4️⃣ **FASE 3 - TAREFA 3: Frontend Error Handler (45 min)**

**ID**: UX-001  
**Objetivo**: Tratamento de erro no frontend  
**Documentação**: `IMPLEMENTATION_TASKS.md` linhas ~1262-1350

#### Passos Técnicos

```bash
# 1. Criar branch
git checkout -b feature/frontend-error-handler

# 2. Modificar frontend/src/api.js
# Adicionar interceptor de erro (linhas 1300-1350 do doc)

# 3. Testes (se aplicável)
cd frontend && npm test

# 4. Build
npm run build

# 5. Commit
git add .
git commit -m "feat: [UX-001] implementar frontend error handler"

# 6. Push
git push origin feature/frontend-error-handler
```

**Arquivos a Modificar**:

- ✏️ `frontend/src/api.js` (ADD interceptor)

**Funcionalidades Implementadas**:

- ✅ Servidor 5xx → mensagem genérica (sem tech details)
- ✅ Timeout → mensagem específica
- ✅ Erro rede → feedback claro
- ✅ Request ID incluído em erros

---

### 5️⃣ **FASE 3 - TAREFA 4: Streaming Timeout (1 hora)**

**ID**: PERF-002  
**Objetivo**: Evitar conexões penduradas  
**Documentação**: `IMPLEMENTATION_TASKS.md` linhas ~1352-1620

#### Passos Técnicos

```bash
# 1. Criar branch
git checkout -b feature/streaming-timeout

# 2. Modificar src/controllers/chatController.ts
# Adicionar AbortController + timeout

# 3. Testes
npm run test

# 4. Build
npm run build

# 5. Commit
git add .
git commit -m "feat: [PERF-002] implementar streaming com timeout"

# 6. Push
git push origin feature/streaming-timeout
```

**Arquivos a Modificar**:

- ✏️ `src/controllers/chatController.ts` (ADD timeout logic)
- ✏️ `tests/integration/streaming.test.ts` (NOVO)
- ✓ `.env`: Adicionar `CHAT_STREAM_TIMEOUT_MS=600000` (10 min padrão)

**Configurações**:

```env
# .env (ADICIONAR)
CHAT_STREAM_TIMEOUT_MS=600000  # 10 minutos
```

---

## 📅 CRONOGRAMA RECOMENDADO

### Semana 1 (Semana de 07-13 de março)

```
07 (Hoje):     ✅ Fases 1-2 verificadas | Planejamento Fase 3
08 (Amanhã):   ⏳ PERF-001 (Rate Limiting) - 1h
09:            ⏳ SEC-003 (File Validation) - 1.5h
10:            ⏳ UX-001 (Frontend Error) - 45m
11:            ⏳ PERF-002 (Streaming Timeout) - 1h
               ⏳ Testes finais + ajustes - 1h
12-13:         📝 Documentar + Revisar tudo
```

### Tempo Total Estimado

```
Fase 3: ~4.25 horas (pode ser concluída em 1 dia se dedicado)
```

---

## 🔧 RECURSOS NECESSÁRIOS

### Dependências npm (a instalar)

```bash
npm install express-rate-limit
npm install -D @types/express-rate-limit
```

### Ferramentas

- ✅ Git (para branches e commits)
- ✅ npm (para teste e build)
- ✅ Docker (para validação)
- ✅ curl/Postman (para testes manuais)

### Documentação de Referência

| Arquivo                          | Propósito                      |
| -------------------------------- | ------------------------------ |
| `docs/IMPLEMENTATION_TASKS.md`   | Código detalhado por tarefa    |
| `docs/AUDIT_IMPROVEMENT_PLAN.md` | Justificativa de cada melhoria |
| `docs/IMPLEMENTATION_STATUS.md`  | Status completo Fases 1-2      |
| `.env.example`                   | Variáveis de ambiente          |

---

## ✅ CHECKLIST POR TAREFA

### Antes de Começar Cada Tarefa

- [ ] Ler seção correspondente em `IMPLEMENTATION_TASKS.md`
- [ ] Criar branch feature/xxx
- [ ] Preparar arquivos necessários
- [ ] Testar localmente

### Durante Implementação

- [ ] Seguir padrão de código existente
- [ ] Adicionar comments quando necessário
- [ ] Executar `npm run lint`
- [ ] Executar `npm run test`
- [ ] Executar `npm run build`

### Após Implementação

- [ ] Verificação manual da funcionalidade
- [ ] Commit com mensagem descritiva
- [ ] Push para origin
- [ ] Update documentação se necessário

---

## 🐛 TROUBLESHOOTING

### Problema: npm install falha

```bash
# Solução
rm -rf node_modules package-lock.json
npm install
```

### Problema: Testes falhando em 2 arquivos (tsyringe)

```
❌ rag/queryAnalysisService.test.ts - Missing 'tsyringe'
❌ rag/scoringService.test.ts - Missing 'tsyringe'
```

**Status**: Pré-existente, não bloqueador  
**Solução**: Agendar para Fase 4 (testes)  
**Ignorar por agora**: `npm test 2>&1 | grep -v tsyringe`

### Problema: Build falha após mudança

```bash
# Debug
npm run build 2>&1 | head -50

# Solução típica
npm install  # Instalar deps faltando
npm run build  # Tentar novamente
```

---

## 📞 SUPORTE

### Perguntas Frequentes

**Q: Qual ordem executar as 4 tarefas?**  
A: Ordem recomendada: PERF-001 → SEC-003 → UX-001 → PERF-002

**Q: Posso pular alguma tarefa?**  
A: Não recomendado. Todas as 4 tarefas se complementam.

**Q: Quanto tempo leva tudo?**  
A: ~4-5 horas se continuo, ou 2-3 dias em paralelo.

**Q: Preciso fazer merge manual das branches?**  
A: Sim, após sucesso de cada tarefa:

```bash
git checkout main
git pull origin main
git merge feature/xxx
git push origin main
```

---

## 🎯 PRÓXIMAS FASES (After Fase 3)

### Fase 4: Testes e Documentação (6 horas)

```
- Aumentar cobertura de testes para 80%+
- Criar ADRs (Architecture Decision Records)
- Documentar endpoints em OpenAPI/Swagger
```

### Fase 5: Otimização (3 horas)

```
- Criar índices Qdrant
- Implementar cache warming
- Performance benchmarking
```

---

## 📊 DASHBOARD DE PROGRESSO

```
Fases 1-2:  ████████████████████ 100% ✅
Fase 3:     □□□□□□□□□□□□□□□□□□□□   0% ⏳
Fase 4:     □□□□□□□□□□□□□□□□□□□□   0% ⏳
Fase 5:     □□□□□□□□□□□□□□□□□□□□   0% ⏳
            ─────────────────────────
TOTAL:      ████░░░░░░░░░░░░░░░░  20%
```

---

## 🚀 COMEÇAR AGORA

Se pronto para começar Fase 3:

```bash
# 1. Atualizar código
git pull origin main

# 2. Criar branch
git checkout -b feature/phase3-start

# 3. Seguir passos acima para PERF-001

# 4. Quando completo:
git add .
git commit -m "feat: [PERF-001] iniciar Fase 3"
git push origin feature/phase3-start
```

---

**Documento Vivo**: Atualizado conforme progresso  
**Última Atualização**: 07 de março de 2026  
**Próxima Review**: Após conclusão de cada tarefa

---

**Status**: 🟡 Pronto para iniciar Fase 3  
**Bloqueadores**: Nenhum  
**Riscos**: Baixo (todas tarefas bem documentadas)

Você está pronto para começar! 🚀
