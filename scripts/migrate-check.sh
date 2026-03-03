#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:8090}"
QDRANT_URL="${QDRANT_URL:-http://127.0.0.1:6333}"
OLLAMA_URL="${OLLAMA_URL:-http://127.0.0.1:11434}"
TOPK="${TOPK:-2}"

echo "[1/7] Containers"
docker compose ps

echo "[2/7] Health API"
curl -fsS "${API_URL}/api/health" | sed 's/^/[api] /'
echo

echo "[3/7] Qdrant collection"
curl -fsS "${QDRANT_URL}/collections/knowledge_base" | head -c 400
echo
echo

echo "[4/7] Ollama tags"
curl -fsS "${OLLAMA_URL}/api/tags" | head -c 600
echo
echo

echo "[5/7] Teste upload manual (README.md)"
curl -fsS -X POST "${API_URL}/api/documents/upload-manual" \
  -F "files=@./README.md" \
  -F "system=HARPIA WMS" \
  -F "module=Recepcao" | sed 's/^/[upload] /'
echo

echo "[6/7] Teste pergunta RAG"
curl -fsS -X POST "${API_URL}/rag/ask" \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Como acessar upload de manual?\",\"topK\":${TOPK}}" | sed 's/^/[rag] /'
echo

echo "[7/7] Ultimos logs backend"
docker compose logs --tail=80 backend

echo
echo "Checklist concluido com sucesso."
