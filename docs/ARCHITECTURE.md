# Arquitetura Atual do Backend

## Objetivo

Documentar a arquitetura oficial do backend apos a consolidacao do runtime em uma unica pilha TypeScript.

## Estado Atual

O backend possui:

- um unico `composition root` em [src/app.ts](c:/Users/suporte/IA_Harpiawms/src/app.ts)
- uma unica aplicacao Express
- controllers TypeScript
- services TypeScript
- compatibilidade de rotas legadas preservada por um router TS

Nao existe mais montagem paralela de routers JS no boot da aplicacao.

## Composition Root

Arquivo principal:

- [src/app.ts](c:/Users/suporte/IA_Harpiawms/src/app.ts)

Responsabilidades:

- carregar middleware global
- instanciar dependencias centrais
- compor controllers
- registrar rotas oficiais e rotas de compatibilidade
- registrar tratamento global de erro

## Rotas Oficiais

Arquivo:

- [src/routes/index.ts](c:/Users/suporte/IA_Harpiawms/src/routes/index.ts)

Superficie oficial `/api`:

- `POST /api/documents`
- `POST /api/documents/upload-manual`
- `POST /api/search`
- `POST /api/classify`
- `POST /api/chat`
- `POST /api/transcribe`
- `GET /api/health`

## Rotas de Compatibilidade

Arquivo:

- [src/routes/compatibility.ts](c:/Users/suporte/IA_Harpiawms/src/routes/compatibility.ts)

Mantidas para nao quebrar frontend legado, curl e integracoes existentes:

- `POST /knowledge/manual`
- `POST /knowledge/upload-audio`
- `POST /knowledge/auto-audio`
- `POST /knowledge/upload-sql`
- `GET /knowledge/items`
- `GET /knowledge/stats`
- `POST /schema/ingest`
- `POST /schema/upload`
- `POST /rag/ask`
- `POST /rag/upload`

Essas rotas agora sao atendidas por controllers TS e nao mais por routers JS independentes.

## Services Canonicos

### RAG

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

Responsavel por:

- insert de documentos
- busca vetorial
- curadoria de hits
- montagem de contexto
- geracao de resposta
- streaming de resposta

### Conhecimento

- [src/services/knowledgeService.ts](c:/Users/suporte/IA_Harpiawms/src/services/knowledgeService.ts)
- [src/services/knowledgeTransformer.ts](c:/Users/suporte/IA_Harpiawms/src/services/knowledgeTransformer.ts)
- [src/services/knowledgeValidator.ts](c:/Users/suporte/IA_Harpiawms/src/services/knowledgeValidator.ts)

Responsavel por:

- insercao manual de conhecimento
- processamento de transcricao
- geracao de estrutura para Mantis e base
- ingestao de SQL no formato de conhecimento
- dashboard de itens e estatisticas

### Schema

- [src/services/schemaService.ts](c:/Users/suporte/IA_Harpiawms/src/services/schemaService.ts)
- [src/services/schemaTransformer.ts](c:/Users/suporte/IA_Harpiawms/src/services/schemaTransformer.ts)
- [src/schema/schemaParser.ts](c:/Users/suporte/IA_Harpiawms/src/schema/schemaParser.ts)
- [src/sql/sqlParser.ts](c:/Users/suporte/IA_Harpiawms/src/sql/sqlParser.ts)
- [src/sql/ddlTransformer.ts](c:/Users/suporte/IA_Harpiawms/src/sql/ddlTransformer.ts)
- [src/sql/schemaIndexer.ts](c:/Users/suporte/IA_Harpiawms/src/sql/schemaIndexer.ts)

Responsavel por:

- ingestao do `docs/schema.sql`
- upload de DDL para indexacao
- geracao de texto semantico de tabelas
- parsing estrutural de SQL/DDL
- transformacao de DDL em documentos semanticos
- indexacao de documentos de schema no Qdrant

### LLM / Embeddings / Vector DB / Whisper

- [src/services/llm/llmService.ts](c:/Users/suporte/IA_Harpiawms/src/services/llm/llmService.ts)
- [src/services/llm/embeddingService.ts](c:/Users/suporte/IA_Harpiawms/src/services/llm/embeddingService.ts)
- [src/services/vector-db/qdrantVectorDbService.ts](c:/Users/suporte/IA_Harpiawms/src/services/vector-db/qdrantVectorDbService.ts)
- [src/services/whisper/whisperService.ts](c:/Users/suporte/IA_Harpiawms/src/services/whisper/whisperService.ts)

## Controllers Canonicos

- [src/controllers/chatController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/chatController.ts)
- [src/controllers/documentController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/documentController.ts)
- [src/controllers/transcribeController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/transcribeController.ts)
- [src/controllers/knowledgeController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/knowledgeController.ts)
- [src/controllers/schemaController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/schemaController.ts)
- [src/controllers/publicRagController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/publicRagController.ts)

## Legado Removido do Runtime

Arquivos removidos:

- `src/routes/knowledge.routes.js`
- `src/routes/rag.routes.js`
- `src/routes/schema.routes.js`
- `src/knowledge/knowledge.service.js`
- `src/knowledge/knowledge.transformer.js`
- `src/knowledge/knowledge.validator.js`
- `src/schema/schema.ingest.service.js`
- `src/schema/schema.transformer.js`
- `src/schema/schema.parser.js`
- `src/sql/sqlParser.js`
- `src/sql/ddlTransformer.js`
- `src/sql/schemaIndexer.js`

Esses arquivos deixaram de ser necessarios depois da consolidacao da composicao e da migracao dos dominios de conhecimento e schema para TS.

## Decisoes Arquiteturais

1. O runtime deve ter uma unica arvore de composicao.
2. Compatibilidade de rotas deve ser preservada no router TS, e nao por boot paralelo.
3. Dominio central deve ficar em TypeScript.
4. Utilitarios de dominio devem seguir a pilha TypeScript oficial.

## Estrategia de Testes

Documento:

- [docs/TESTING.md](c:/Users/suporte/IA_Harpiawms/docs/TESTING.md)

Estado atual:

- a suite de testes foi realinhada ao runtime TypeScript oficial
- nao existem mais testes dependentes de services removidos do backend
- o comportamento critico de filtro de tabela no RAG passou a ter cobertura automatizada

## Proxima Etapa Recomendada

Seguir para a fase de melhoria de qualidade do RAG, agora com base arquitetural e validacao automatizada minima consistentes.
