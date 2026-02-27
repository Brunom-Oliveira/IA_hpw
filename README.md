# IA HarpiaWMS Backend

Backend Node.js + TypeScript com arquitetura modular para:
- RAG manual com Qdrant local + Ollama
- Chatbot com LLM local (Ollama ou llama.cpp server)
- Classificacao de texto (tickets/historicos)
- Transcricao de audio com Whisper (whisper.cpp)

## Estrutura de pastas

```text
src/
  rag/
    ingest.service.js
    embedding.service.js
    search.service.js
    rag.service.js
  schema/
    schema.parser.js
    schema.transformer.js
    schema.ingest.service.js
  controllers/
  routes/
    rag.routes.js
    schema.routes.js
  services/
    llm/
    whisper/
    vector-db/
  scripts/
  utils/
config/
docker/
tests/
```

## Requisitos (Ubuntu VPS 4c/8GB)

- Node.js 20+
- npm 10+
- Docker + Docker Compose
- Ollama instalado (ou endpoint llama.cpp server)
- whisper.cpp compilado e binario `whisper-cli`
- Modelo Whisper `.bin` em disco (ex.: `models/ggml-base.bin`)

## Setup

1. Instale dependencias:

```bash
npm install
```

2. Crie o arquivo `.env`:

```bash
cp config/.env.example .env
```

3. Ajuste as variaveis no `.env`:
- `OLLAMA_BASE_URL`
- `LLM_MODEL`
- `EMBEDDING_MODEL`
- `QDRANT_URL`
- `QDRANT_COLLECTION`
- `QDRANT_VECTOR_SIZE`
- `SCHEMA_SQL_PATH`
- `WHISPER_BIN_PATH`
- `WHISPER_MODEL_PATH`

4. Rode em desenvolvimento:

```bash
npm run dev
```

5. Build e execucao de producao:

```bash
npm run build
npm start
```

## Docker

Subir app + Qdrant:

```bash
docker compose up --build
```

Observacao:
- O serviço de LLM local (Ollama/llama.cpp) e Whisper podem rodar fora do compose, na mesma VPS.
- Se quiser incluir Ollama no compose, adicione um serviço extra conforme capacidade de RAM da VPS.

## Embeddings e indexacao de documentos

1. Coloque arquivos em `data/documents` (`.txt`, `.md`, `.pdf`).
2. Rode:

```bash
npm run index:docs
```

O script quebra texto em chunks e indexa no vetor DB com embeddings gerados pelo modelo local.

## Endpoints RAG (Qdrant + Ollama)

Base URL: `http://localhost:3000/rag`

- `POST /upload` (multipart/form-data)
  - Campo do arquivo: `file` (PDF)
  - Fluxo: extracao PDF -> chunk 800 chars -> embedding -> upsert no Qdrant

- `POST /ask`
```json
{
  "question": "Qual e a politica de devolucao?"
}
```
Fluxo: embedding da pergunta -> top 5 no Qdrant -> prompt com contexto -> resposta do Ollama.

### Controle de tokens no RAG

Arquivos:
- `src/rag/rag.constants.js`
- `src/rag/tokenManager.js`
- `src/rag/contextBuilder.js`
- `src/rag/rag.service.js`

Politica:
- Janela total: `4096`
- Reserva resposta: `500`
- Reserva system/instrucoes: `300`
- Contexto disponivel: `3296`

Recursos:
- Estimativa: `estimateTokens(text) = Math.ceil(text.length / 4)`
- Deduplicacao simples antes de montar contexto
- Context builder com budget de tokens
- Protecao opcional por middleware (`RAG_ENABLE_TOKEN_GUARD=true`)
- Logs de uso reais do Ollama:
  - `prompt_eval_count` (input)
  - `eval_count` (output)
  - `total_tokens`
  - `execution_time_ms`

## Endpoint Schema Ingest (DDL -> conhecimento semantico)

Base URL: `http://localhost:3000/schema`

- `POST /ingest`
  - Lê arquivo `./docs/schema.sql`
  - Extrai `CREATE TABLE`, colunas, PK e FK
  - Transforma em texto semantico por tabela
  - Gera embedding via `nomic-embed-text`
  - Indexa no Qdrant na colecao `schema_documents`

Resposta:
```json
{
  "message": "Schema SQL processado e indexado com sucesso",
  "indexed_tables": ["clients", "orders"],
  "total": 2
}
```

## Modulo Knowledge (ingestao estruturada)

Arquivos principais:
- `src/knowledge/knowledge.service.js`
- `src/knowledge/knowledge.transformer.js`
- `src/knowledge/knowledge.validator.js`
- `src/routes/knowledge.routes.js`

Colecao vetorial usada:
- `knowledge_base` (Qdrant)
- `size: 768`
- `distance: Cosine`

### Endpoints

Base URL: `http://localhost:3000/knowledge`

1. `POST /manual`
```json
{
  "category": "documentation",
  "system": "WMS",
  "module": "Picking",
  "title": "Erro de separacao",
  "problem": "Pedido fica travado",
  "symptoms": ["status parado", "fila crescente"],
  "cause": "Job de validacao nao executou",
  "solution": "Reprocessar fila",
  "tables_related": ["orders", "order_items"],
  "tags": ["operacao", "picking"]
}
```

2. `POST /upload-audio`
```json
{
  "transcription": "texto da transcricao...",
  "system": "WMS",
  "module": "Atendimento"
}
```

3. `POST /upload-sql` (multipart/form-data)
- Campo do arquivo: `file` (`.sql`)

4. `GET /items?category=documentation`
- Lista itens indexados para dashboard.

5. `GET /stats`
- Retorna total e contagem por categoria.

### Padrao de texto para embedding

Todos os itens sao normalizados neste formato:

```text
Tipo: {{category}}
Sistema: {{system}}
Módulo: {{module}}

Título: {{title}}

Problema:
{{problem}}

Sintomas:
- {{symptom}}

Causa:
{{cause}}

Solução:
{{solution}}

Tabelas Relacionadas:
- {{table}}

Tags:
- {{tag}}
```

## Frontend React (gestao da base)

Estrutura:
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/AddKnowledge.jsx`
- `frontend/src/pages/UploadAudio.jsx`
- `frontend/src/pages/UploadSQL.jsx`

Execucao:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Paginas:
- Dashboard com listagem, filtro por categoria e contagem por tipo.
- Insercao manual estruturada.
- Upload SQL com retorno de tabelas detectadas.
- Upload de transcricao de audio para estruturacao + indexacao.

## Endpoints

Base URL: `http://localhost:3000/api`

- `POST /documents`
```json
{
  "documents": [
    { "text": "Conteudo do documento", "metadata": { "source": "manual.md" } }
  ]
}
```

- `POST /search`
```json
{
  "query": "atraso na entrega",
  "topK": 4
}
```

- `POST /classify`
```json
{
  "text": "Cliente reportou timeout na API",
  "mode": "rules"
}
```

- `POST /chat`
```json
{
  "message": "Qual o status da entrega do pedido 123?",
  "topK": 4
}
```

- `POST /transcribe` (multipart/form-data)
  - Campo do arquivo: `audio`

## Testes

```bash
npm test
```

Cobertura atual:
- Classificacao de texto
- Fluxo base de busca vetorial
- Estrutura de chat + contrato de transcricao

## Manutencao

- Servicos externos foram isolados em `src/services/*` para facilitar troca de providers.
- Controllers validam entrada e mantem regras HTTP separadas da regra de negocio.
- `RagService` centraliza indexacao e busca de contexto vetorial.
