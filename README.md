# IA HarpiaWMS (Containerizado)

Projeto pronto para subir em qualquer VPS via Docker Compose, com:
- Backend API (`ia-hpw`) em `:8090`
- Frontend em `:5173`
- Qdrant em `:6333`
- Ollama em `:11434`
- Whisper.cpp compilado dentro da imagem do backend

## 1. Pré-requisitos

- Docker Engine
- Docker Compose plugin (`docker compose`)
- Pasta `models/` com modelo Whisper (recomendado `ggml-medium.bin`)

Exemplo:

```bash
mkdir -p models uploads docs
# copie seu modelo para:
# models/ggml-medium.bin
```

## 2. Subir tudo

```bash
docker compose up -d --build
```

Verificar saúde:

```bash
docker compose ps
curl -sS http://127.0.0.1:8090/api/health
curl -sS http://127.0.0.1:6333/collections/knowledge_base | head
curl -sS http://127.0.0.1:11434/api/tags | head
```

Acesse:
- Frontend: `http://SEU_IP:5173`
- Backend: `http://SEU_IP:8090`

## 3. Modelos Ollama

O serviço `ollama-init` já tenta baixar automaticamente:
- `mistral`
- `nomic-embed-text`

Também pode rodar manual:

```bash
docker compose exec ollama ollama pull mistral
docker compose exec ollama ollama pull nomic-embed-text
```

## 4. Variáveis importantes

Baseado em `config/.env.example`:
- `PORT=8090`
- `QDRANT_URL=http://qdrant:6333`
- `OLLAMA_BASE_URL=http://ollama:11434`
- `WHISPER_BIN_PATH=/opt/whisper.cpp/build/bin/whisper-cli`
- `WHISPER_MODEL_PATH=/app/models/ggml-medium.bin`

No Compose essas variáveis já são injetadas no backend.

## 5. Migração para outra VPS (sem dor)

### Backup

```bash
# no host atual
cd /root/IA_hpw

tar -czf backup-ia-hpw-files.tar.gz \
  docker-compose.yml docker/ src/ frontend/ config/ package*.json tsconfig.json README.md docs/ models/ uploads/

docker run --rm -v harpia_qdrant_data:/data -v $(pwd):/backup alpine \
  sh -c "cd /data && tar -czf /backup/backup-qdrant.tar.gz ."

docker run --rm -v harpia_ollama_data:/data -v $(pwd):/backup alpine \
  sh -c "cd /data && tar -czf /backup/backup-ollama.tar.gz ."
```

### Restore

```bash
# na nova VPS
mkdir -p /root/IA_hpw && cd /root/IA_hpw
# copie os .tar.gz para cá

tar -xzf backup-ia-hpw-files.tar.gz

docker volume create harpia_qdrant_data
docker volume create harpia_ollama_data

docker run --rm -v harpia_qdrant_data:/data -v $(pwd):/backup alpine \
  sh -c "cd /data && tar -xzf /backup/backup-qdrant.tar.gz"

docker run --rm -v harpia_ollama_data:/data -v $(pwd):/backup alpine \
  sh -c "cd /data && tar -xzf /backup/backup-ollama.tar.gz"

docker compose up -d --build
```

## 6. Como evitar ficar fora do ar

- Use `restart: unless-stopped` (já aplicado)
- Healthchecks (já aplicados)
- Atualização com baixo risco:

```bash
git pull origin main
docker compose build backend frontend
docker compose up -d backend frontend
```

- Tenha monitoramento simples:

```bash
docker compose ps
docker compose logs --tail=100 backend
```

## 7. Troubleshooting rápido

- Backend não sobe:

```bash
docker compose logs --tail=200 backend
```

- Erro de transcrição Whisper:
  - confirme `models/ggml-medium.bin` no host
  - confirme `WHISPER_MODEL_PATH=/app/models/ggml-medium.bin`

- Chat com erro de vetor (`qdrant`):

```bash
docker compose logs --tail=200 qdrant backend
```

- Chat com erro de LLM (`ollama`):

```bash
docker compose logs --tail=200 ollama backend
docker compose exec ollama ollama list
```