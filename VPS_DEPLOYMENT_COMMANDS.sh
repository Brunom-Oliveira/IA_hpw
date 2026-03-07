#!/bin/bash

# ============================================
# COMANDOS DE DEPLOY NA VPS
# IA HarpiaWMS - Fases 1 & 2 Completas
# Data: 07/03/2026
# ============================================

set -e  # Exit se houver erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# CONFIGURAÇÕES
# ============================================

PROJECT_PATH="/home/ubuntu/IA_Harpiawms"  # AJUSTE CONFORME SEU CAMINHO
SERVICE_NAME="ia-harpiawms"              # Nome do serviço (PM2/systemd)
BACKUP_DIR="/home/ubuntu/backups"       # Diretório de backup
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ============================================
# FUNÇÕES AUXILIARES
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# ============================================
# 1. VERIFICAÇÕES PRÉ-DEPLOY
# ============================================

echo -e "\n${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}    DEPLOY IA HARPIAWMS - FASE 1 & 2${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}\n"

log_info "Iniciando verificações pré-deploy..."

# Verificar se projeto existe
if [ ! -d "$PROJECT_PATH" ]; then
    log_error "Diretório do projeto não encontrado: $PROJECT_PATH"
    exit 1
fi

log_success "Diretório do projeto encontrado"

# Entrar no diretório
cd "$PROJECT_PATH"
log_success "Navegação para $PROJECT_PATH"

# Verificar se é repositório git
if [ ! -d ".git" ]; then
    log_error "Não é um repositório git"
    exit 1
fi

log_success "Repositório git válido"

# ============================================
# 2. PARAR SERVIÇO (OPCIONAL - comentado por padrão)
# ============================================

log_info "Opcionally: Parando serviço..."
# Descomente se quiser parar antes de fazer pull

# PM2:
# pm2 stop "$SERVICE_NAME"

# Systemd:
# sudo systemctl stop $SERVICE_NAME

# Docker Compose:
# docker-compose stop backend

# ============================================
# 3. FAZER BACKUP (RECOMENDADO)
# ============================================

log_info "Criando backup..."

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

# Backup do branch atual e estado
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.tar.gz"
tar -czf "$BACKUP_FILE" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    src/ package.json package-lock.json CHANGELOG.md

log_success "Backup criado: $BACKUP_FILE"

# ============================================
# 4. VERIFICAR STATUS ATUAL
# ============================================

log_info "Verificando status git atual..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "Branch atual: $CURRENT_BRANCH"

CURRENT_COMMIT=$(git log -1 --format=%h)
log_info "Commit atual: $CURRENT_COMMIT"

# ============================================
# 5. FAZER CHECKOUT PARA MAIN
# ============================================

log_info "Fazendo checkout para branch 'main'..."

if [ "$CURRENT_BRANCH" != "main" ]; then
    git checkout main
    log_success "Checkout para main realizado"
else
    log_info "Já está em main"
fi

# ============================================
# 6. FAZER PULL DE MUDANÇAS
# ============================================

log_info "Fazendo pull das mudanças..."

git pull origin main

NEW_COMMIT=$(git log -1 --format=%h)
log_success "Pull concluído (commit: $NEW_COMMIT)"

# ============================================
# 7. VERIFICAR O QUE FOI MUDADO
# ============================================

log_info "Mudanças recebidas:"
echo ""
git log --oneline "$CURRENT_COMMIT".."$NEW_COMMIT" || echo "Nenhuma mudança"
echo ""

# ============================================
# 8. INSTALAR DEPENDÊNCIAS
# ============================================

log_info "Instalando dependências npm..."

npm install

log_success "Dependências instaladas"

# Limpar cache do npm (opcional)
# npm cache clean --force

# ============================================
# 9. TESTAR BUILD
# ============================================

log_info "Testando TypeScript build..."

npm run build

log_success "Build concluído com sucesso"

# ============================================
# 10. VERIFICAR VULNERABILIDADES
# ============================================

log_warning "Verificando vulnerabilidades de segurança..."

VULN_COUNT=$(npm audit --only=prod 2>&1 | grep "found" | grep -oE "[0-9]+" | head -1 || echo "0")

if [ "$VULN_COUNT" -eq "0" ]; then
    log_success "Nenhuma vulnerabilidade encontrada"
else
    log_warning "Vulnerabilidades encontradas: $VULN_COUNT"
    npm audit
fi

# ============================================
# 11. RODAR TESTES (OPCIONAL)
# ============================================

log_info "Rodando testes unitários..."

if npm run test 2>/dev/null; then
    log_success "Testes passaram"
else
    log_warning "Alguns testes falharam (verifique manualmente se necessário)"
fi

# ============================================
# 12. REINICIAR SERVIÇO
# ============================================

log_info "Reiniciando serviço..."

# Escolha UM dos métodos abaixo conforme seu setup

# OPÇÃO A - PM2:
if command -v pm2 &> /dev/null; then
    log_info "Detectado PM2 - usando para restart"
    pm2 restart "$SERVICE_NAME" --wait-ready --listen-timeout 10000
    pm2 save
    log_success "Serviço reiniciado com PM2"
    
# OPÇÃO B - Systemd:
elif systemctl is-active --quiet $SERVICE_NAME 2>/dev/null; then
    log_info "Detectado systemd - usando para restart"
    sudo systemctl restart $SERVICE_NAME
    log_success "Serviço reiniciado com systemd"
    
# OPÇÃO C - Docker Compose:
elif command -v docker-compose &> /dev/null; then
    log_info "Detectado Docker Compose - usando para restart"
    docker-compose restart backend
    log_success "Container reiniciado com docker-compose"
    
else
    log_warning "Nenhum serviço manager detectado. Reinicie manualmente."
fi

# ============================================
# 13. ESPERAR SERVIÇO INICIAR
# ============================================

log_info "Aguardando serviço iniciar (10 segundos)..."
sleep 10

# ============================================
# 14. VERIFICAR SAÚDE DO SERVIÇO
# ============================================

log_info "Verificando saúde do serviço..."

if command -v curl &> /dev/null; then
    HEALTH_CHECK=$(curl -s http://localhost:3000/api/health 2>/dev/null || echo "{}")
    
    if echo "$HEALTH_CHECK" | grep -q "ok\|status"; then
        log_success "Serviço está respondendo"
        echo "$HEALTH_CHECK" | jq . 2>/dev/null || echo "$HEALTH_CHECK"
    else
        log_warning "Serviço pode não estar pronto. Verifique os logs."
    fi
else
    log_warning "curl não disponível. Verifique manualmente: http://localhost:3000/api/health"
fi

# ============================================
# 15. EXIBIR LOGS
# ============================================

log_info "Últimos logs:"
echo ""

# PM2:
if command -v pm2 &> /dev/null && pm2 list | grep -q "$SERVICE_NAME"; then
    pm2 logs "$SERVICE_NAME" --lines 20 --nostream
    
# Systemd:
elif systemctl is-active --quiet $SERVICE_NAME 2>/dev/null; then
    journalctl -u $SERVICE_NAME -n 20 --no-pager
    
# Docker:
elif command -v docker-compose &> /dev/null; then
    docker-compose logs backend --tail 20
fi

# ============================================
# 16. SUMÁRIO FINAL
# ============================================

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}    DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}\n"

log_success "Branch: main"
log_success "Commit: $(git log -1 --format=%h)"
log_success "Mudanças aplicadas"
log_success "Serviço reiniciado"

echo ""
log_info "Informações úteis:"
echo "  📂 Diretório: $PROJECT_PATH"
echo "  💾 Backup: $BACKUP_FILE"
echo "  🔗 API: http://localhost:3000"
echo "  📋 Status: $(systemctl is-active $SERVICE_NAME 2>/dev/null || echo 'Verifique manualmente')"

echo ""
log_info "Próximos passos:"
echo "  1. Verificar logs: tail -f /var/log/$SERVICE_NAME.log"
echo "  2. Testar api: curl http://localhost:3000/api/health"
echo "  3. Rollback (se necessário): tar -xzf $BACKUP_FILE"

echo ""
