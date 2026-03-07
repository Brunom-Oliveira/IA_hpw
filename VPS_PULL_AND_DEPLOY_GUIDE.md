# 🚀 COMANDOS PARA APLICAR MUDANÇAS NA VPS

## 📋 Sumário Rápido

```bash
# Resumo dos comandos principais:
cd /path/to/IA_Harpiawms
git checkout main
git pull origin main
npm install
npm run build
npm audit
pm2 restart ia-harpiawms  # ou systemctl restart
```

---

## ✅ COMANDOS COMPLETOS (PASSO-A-PASSO)

### 1️⃣ NAVEGAÇÃO E VERIFICAÇÃO INICIAL

```bash
# Entrar no diretório do projeto
cd /home/ubuntu/IA_Harpiawms
# OU
cd /var/www/IA_Harpiawms
# OU ajuste conforme seu caminho

# Verificar branch atual
git branch

# Ver status
git status

# Ver histórico de commits
git log --oneline -5
```

---

### 2️⃣ FAZER BACKUP (RECOMENDADO)

```bash
# Criar backup antes de qualquer mudança
mkdir -p ~/backups
tar -czf ~/backups/backup_$(date +%Y%m%d_%H%M%S).tar.gz \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    .

# OU específico de arquivos importantes:
cp -r src src.backup.$(date +%Y%m%d_%H%M%S)
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup
```

---

### 3️⃣ FAZER CHECKOUT PARA MAIN

```bash
# Se estiver em outra branch, mudar para main
git checkout main

# Verificar que está em main
git branch
# Deve mostrar: * main

# Ver commit atual
git log -1 --oneline
```

---

### 4️⃣ FAZER PULL DAS MUDANÇAS

```bash
# Baixar mudanças do repositório remoto
git pull origin main

# Ver mudanças recebidas
git log --oneline -10

# Ver arquivos modificados
git diff HEAD~1 --name-only
```

---

### 5️⃣ INSTALAR DEPENDÊNCIAS

```bash
# Instalar dependências (novo Zod foi adicionado)
npm install

# OU com limpeza (mais seguro):
rm -rf node_modules package-lock.json
npm install

# Verificar que Zod foi instalado
npm list zod
```

---

### 6️⃣ TESTAR BUILD

```bash
# Compilar TypeScript
npm run build

# Verificar se dist/ foi criado
ls -la dist/ | head -20

# Tamanho do build
du -sh dist/

# Se houver erro, verifique:
npm run build 2>&1 | grep "error TS"
```

---

### 7️⃣ VERIFICAR SEGURANÇA

```bash
# Verificar vulnerabilidades (deve ser 0)
npm audit --only=prod

# Se houver problemas, tentar fix:
npm audit fix

# Ver detalhes de vulnerabilidades (se houver):
npm audit --json | jq '.vulnerabilities'
```

---

### 8️⃣ RODAR TESTES (OPCIONAL)

```bash
# Rodar testes unitários
npm run test

# Rodar com cobertura (se disponível)
npm run test:coverage

# Rodar testes específicos
npm run test -- --testNamePattern="ARCH-002"
```

---

### 9️⃣ PARAR SERVIÇO ANTES DE RESTART

```bash
# OPÇÃO A - PM2:
pm2 stop ia-harpiawms

# OPÇÃO B - Systemd:
sudo systemctl stop ia-harpiawms

# OPÇÃO C - Docker:
docker-compose stop backend

# OPÇÃO D - Manualmente (se rodando):
# Encontrar processo
ps aux | grep node
# Matar processo
kill -9 <PID>
```

---

### 🔟 REINICIAR SERVIÇO

```bash
# OPÇÃO A - PM2 (recomendado):
pm2 restart ia-harpiawms

# Com verificação de saúde:
pm2 restart ia-harpiawms --wait-ready --listen-timeout 10000

# Salvar configuração PM2:
pm2 save
pm2 startup

# Ver status:
pm2 status

# Ver logs:
pm2 logs ia-harpiawms --lines 50


# ============================================
# OPÇÃO B - Systemd:
sudo systemctl restart ia-harpiawms

# Ver status:
sudo systemctl status ia-harpiawms

# Ver logs:
sudo journalctl -u ia-harpiawms -n 50 -f

# Habilitar auto-start:
sudo systemctl enable ia-harpiawms


# ============================================
# OPÇÃO C - Docker Compose:
docker-compose restart backend

# Ver logs:
docker-compose logs -f backend --tail 50

# Ou ver histórico:
docker-compose logs backend --tail 100

# Build se necessário:
docker-compose up -d --build


# ============================================
# OPÇÃO D - Nginx (se usando como proxy):
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

### 1️⃣1️⃣ AGUARDAR SERVIÇO INICIAR

```bash
# Esperar alguns segundos
sleep 10

# Verificar se está escutando na porta
netstat -tlnp | grep 3000
# OU
ss -tlnp | grep 3000
```

---

### 1️⃣2️⃣ VERIFICAR SAÚDE DO SERVIÇO

```bash
# Testar endpoint health check
curl -X GET http://localhost:3000/api/health

# Com headers e pretty print:
curl -s http://localhost:3000/api/health | jq .

# Verificar resposta com requestId (novo):
curl -i -X GET http://localhost:3000/api/health \
  -H "x-request-id: test-$(date +%s)"

# Resposta esperada:
# {
#   "status": "ok",
#   "timestamp": "2026-03-07T15:30:45.123Z",
#   "requestId": "test-1234567890"
# }
```

---

### 1️⃣3️⃣ VERIFICAR LOGS

```bash
# PM2:
pm2 logs ia-harpiawms --lines 50
pm2 logs ia-harpiawms --lines 200 --nostream  # Sem stream automático

# Systemd:
journalctl -u ia-harpiawms -n 50 -f          # Últimas 50 linhas com follow
journalctl -u ia-harpiawms --since "1 hour ago"  # Últimas 1 hora
sudo journalctl -u ia-harpiawms -xe           # Com erros

# Docker:
docker-compose logs backend --tail 50 -f

# Arquivo de log (se existir):
tail -f /var/log/ia-harpiawms.log
tail -f /home/ubuntu/.pm2/logs/ia-harpiawms-error.log
```

---

### 1️⃣4️⃣ TESTAR MUDANÇAS ESPECÍFICAS

```bash
# Testar Global Error Handler (ARCH-002)
# Deve retornar erro genérico sem stack trace
curl -X GET http://localhost:3000/api/nonexistent

# Resposta esperada:
# {
#   "error": "Não foi possível encontrar /api/nonexistent neste servidor.",
#   "status": 404,
#   "timestamp": "2026-03-07T15:30:45.123Z",
#   "requestId": "abc12345-def6-..."
# }


# Testar Request ID (AUDIT-001)
# Verificar que header x-request-id está na resposta
curl -i http://localhost:3000/api/health

# Procurar por: x-request-id: ... na resposta


# Testar Admin Guard (SEC-002)
# Deve rejeitar sem token
curl -X POST http://localhost:3000/api/admin/reindex
# Resposta esperada: 401 "Token administrativo ausente"

# Com token correto (Bearer):
curl -X POST http://localhost:3000/api/admin/reindex \
  -H "Authorization: Bearer $RAG_ADMIN_TOKEN"
# Deve retornar 200 ou 202


# Testar Validação Zod (QUAL-001)
# Deve retornar 422 com detalhes de erro
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{"documents": []}'

# Resposta esperada: 422 com mensagem de validação
```

---

### 1️⃣5️⃣ ROLLBACK EM CASO DE PROBLEMA

```bash
# Ver backup disponível
ls -lah ~/backups/ | head -10

# Restaurar backup
cd ~
tar -xzf ~/backups/backup_YYYYMMDD_HHMMSS.tar.gz -C /home/ubuntu/IA_Harpiawms/

# OU reverter último commit
git reset --hard HEAD~1

# OU voltar para commit específico
git log --oneline | head -20  # Ver commits
git reset --hard <COMMIT_HASH>

# OU reverter pull e voltar para commit anterior
git fetch origin
git reset --hard origin/main~1

# Depois reiniciar:
npm install
npm run build
pm2 restart ia-harpiawms
```

---

### 1️⃣6️⃣ MONITORAMENTO Pós-Deploy

```bash
# Ver uso de CPU e memória
top
# OU específico do Node.js:
ps aux | grep node

# Ver conexões de rede
netstat -tlnp | grep node

# Verificar espaço em disco
df -h

# Ver logs em tempo real
pm2 logs ia-harpiawms -f

# Prometheus/Grafana (se configurado):
curl http://localhost:9090/metrics

# Health check automático (Cron):
# Adicionar ao crontab:
# */5 * * * * curl -s http://localhost:3000/api/health > /tmp/health.check || echo "DOWN" | mail admin@example.com
```

---

## 🚨 TROUBLESHOOTING

### Erro: "fatal: not a git repository"

```bash
# Verificar caminho correto
pwd
ls -la .git

# Se não houver .git/, clonar repositório:
git clone https://github.com/Brunom-Oliveira/IA_hpw.git
cd IA_hpw
```

### Erro: "npm ERR! code ERESOLVE"

```bash
# Resolver conflito de dependências
npm install --legacy-peer-deps

# OU atualizar npm:
npm install -g npm@latest
npm install
```

### Erro: "EACCES: permission denied"

```bash
# Executar com sudo (não recomendado):
sudo npm install

# OU corrigir permissões:
sudo chown -R $USER:$USER ~/.npm
```

### Serviço não responde

```bash
# Verificar se está rodando
ps aux | grep node
pm2 status

# Checar porta
lsof -i :3000
ss -tlnp | grep 3000

# Reiniciar
pm2 restart ia-harpiawms
sudo systemctl restart ia-harpiawms

# Ver erros
pm2 logs ia-harpiawms --err
```

### Mudanças não aparecem

```bash
# Forçar pull
git fetch --force origin
git reset --hard origin/main

# Limpar cache
npm cache clean --force

# Reinstalar
rm -rf node_modules
npm install
npm run build
```

---

## 📊 RESUMO DO QUE FOI MUDADO

**Fase 1 - Segurança Crítica:**

- ✅ SEC-001: Multer 1.4.5-lts.2 (fecha 3 CVEs)
- ✅ MAINT-001: chromaVectorDbService.ts removido
- ✅ CODE-001: app.ts limpo
- ✅ BUILD-001: TypeScript nodenext

**Fase 2 - Qualidade de Código:**

- ✅ ARCH-002: Global error handler
- ✅ AUDIT-001: Request ID tracking
- ✅ QUAL-001: Validação com Zod
- ✅ SEC-002: Admin guard (Bearer only)

**Novos arquivos:**

- src/middleware/errorHandler.ts
- src/middleware/requestIdMiddleware.ts
- src/middleware/validateRequest.ts
- src/schemas/documents.schema.ts
- src/schemas/chat.schema.ts

---

## 🎯 VERIFICAÇÃO FINAL

```bash
# Checklist pós-deploy:
[ ] git pull concluído
[ ] npm install executado
[ ] npm run build passou
[ ] npm audit = 0 vulnerabilidades
[ ] Serviço restarted
[ ] curl http://localhost:3000/api/health retorna OK
[ ] Logs sem errors
[ ] Admin endpoint responde com Bearer token
[ ] Request IDs aparecem nos logs/responses
```

---

## 📞 SUPORTE

Se encontrar problemas:

1. Verificar logs: `pm2 logs ia-harpiawms`
2. Verificar CHANGELOG.md para detalhes
3. Fazer rollback se necessário
4. Contactar desenvolvimento

---

**Realizado em**: 07/03/2026  
**Repositório**: https://github.com/Brunom-Oliveira/IA_hpw  
**Branch**: main
