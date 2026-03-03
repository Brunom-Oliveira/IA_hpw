# Migration Checklist (VPS -> VPS)

Este guia reduz risco de indisponibilidade ao migrar o container para outra VPS.

## 1. Modelos fixos no compose

Use nomes com tag explicita para evitar erro `model not found`:

- `LLM_MODEL=mistral:latest`
- `EMBEDDING_MODEL=nomic-embed-text:latest`

No `ollama-init`, fazer pull com as mesmas tags.

## 2. Subida

```bash
cd /root/IA_hpw
docker compose up -d --build
```

## 3. Checklist automatico (1 comando)

```bash
cd /root/IA_hpw
chmod +x scripts/migrate-check.sh
./scripts/migrate-check.sh
```

O script valida:

- status dos containers
- `GET /api/health`
- colecao `knowledge_base` no Qdrant
- modelos no Ollama
- upload manual de teste (`README.md`)
- pergunta RAG de teste
- ultimos logs do backend

## 4. Parametros opcionais

```bash
API_URL=http://127.0.0.1:8090 \
QDRANT_URL=http://127.0.0.1:6333 \
OLLAMA_URL=http://127.0.0.1:11434 \
TOPK=2 \
./scripts/migrate-check.sh
```

## 5. Atualizacao segura (sem derrubar tudo)

```bash
git pull origin main
docker compose build backend frontend
docker compose up -d backend frontend
```

## 6. Comandos de diagnostico rapido

```bash
docker compose ps
docker compose logs --tail=120 backend
docker compose logs --tail=120 ollama
docker compose logs --tail=120 qdrant
```
