# Melhoria de Qualidade do RAG

## Objetivo

Melhorar a qualidade das respostas do RAG sem trocar imediatamente o modelo e sem aumentar o custo computacional de forma desnecessaria.

## Problemas Atacados

1. O vetor retornava poucos candidatos e o sistema aceitava esses resultados quase sem curadoria.
2. O contexto enviado ao LLM era montado apenas por ordem de retorno, sem diversidade de fonte.
3. Perguntas sobre tabela especifica ainda corriam risco de cair em documento relacionado, mas nao alvo.
4. Quando nao havia contexto suficiente, o sistema ainda chamava o LLM, aumentando latencia e risco de resposta ruim.
5. O prompt estava mal estruturado e com texto corrompido por encoding.

## Ajustes Aplicados

### 1. Recuperacao ampliada com curadoria posterior

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- o sistema passou a buscar mais candidatos no vetor do que o numero final de trechos usados no contexto
- a selecao final agora acontece apos analise da pergunta

Motivo:

- a busca vetorial sozinha nao e suficiente para escolher os melhores trechos em perguntas operacionais ou de schema

### 2. Analise explicita da pergunta

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- a pergunta passa por classificacao leve de intencao:
  - `schema`
  - `procedure`
  - `general`
- tambem sao extraidas dicas de tabela e termos lexicais relevantes

Motivo:

- respostas melhores exigem entender o tipo de pergunta antes de montar o contexto

### 3. Filtro estrito por tabela

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- quando a pergunta cita uma tabela especifica, os hits passam por filtro estrito de metadata
- documentos de tabela relacionada deixam de ser usados como substitutos

Motivo:

- esse era um dos principais erros funcionais observados no sistema

### 4. Reranking hibrido

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- o score final do hit passou a considerar:
  - score vetorial
  - match lexical
  - match de tabela
  - categoria do documento
  - aderencia ao tipo da pergunta

Motivo:

- isso reduz respostas baseadas em trecho semanticamente proximo, mas operacionalmente errado

### 5. Diversidade de fontes

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- o contexto final passou a limitar repeticao de chunks da mesma fonte
- o sistema tenta compor o contexto com fontes diferentes quando isso agrega qualidade

Motivo:

- antes o contexto podia ser dominado por varios chunks do mesmo documento, reduzindo cobertura da resposta

### 6. Fallback deterministico sem LLM

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- quando nao ha contexto suficiente, o sistema responde diretamente sem chamar o LLM

Motivo:

- reduz latencia
- evita alucinacao
- deixa explicita a ausencia de evidencia na base

### 7. Prompt reestruturado

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- prompt reescrito em texto limpo
- instrucoes especificas por tipo de pergunta
- limite de resposta curta
- reforco de uso exclusivo do contexto

Motivo:

- o prompt antigo estava com encoding ruim e instrucoes genericas demais

### 8. Metadata semantica enriquecida na indexacao

Arquivos:

- [src/utils/ragMetadata.ts](c:/Users/suporte/IA_Harpiawms/src/utils/ragMetadata.ts)
- [src/controllers/documentController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/documentController.ts)
- [src/services/pdfIngestService.ts](c:/Users/suporte/IA_Harpiawms/src/services/pdfIngestService.ts)
- [src/services/knowledgeService.ts](c:/Users/suporte/IA_Harpiawms/src/services/knowledgeService.ts)
- [src/services/schemaService.ts](c:/Users/suporte/IA_Harpiawms/src/services/schemaService.ts)
- [src/sql/schemaIndexer.ts](c:/Users/suporte/IA_Harpiawms/src/sql/schemaIndexer.ts)

O que mudou:

- a indexacao passou a gerar metadata padronizada, incluindo:
  - `document_type`
  - `section`
  - `table_name`
  - `table_suffix`
  - `related_tables_csv`
  - `tags_csv`

Motivo:

- o RAG nao deve depender apenas de `title` e `source`
- a qualidade de recuperacao melhora quando a estrutura semantica do documento ja nasce explicita

### 9. Cache de consulta para reduzir latencia

Arquivos:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)
- [src/services/ragQueryCache.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragQueryCache.ts)

O que mudou:

- perguntas repetidas com a mesma formulacao e `topK` passam a reutilizar a resposta pronta
- o cache e invalidado quando novos documentos entram na base
- o stream do chat tambem reaproveita a resposta em cache, sem abrir nova geracao no LLM

Motivo:

- a VPS nao deve gastar CPU no mesmo prompt repetidamente
- esse ganho reduz latencia sem trocar modelo nem piorar a qualidade

Configuracao:

- `RAG_CACHE_TTL_MS`
  - tempo de vida do cache em milissegundos
  - default atual: `600000` (10 minutos)
- `RAG_CACHE_MAX_ITEMS`
  - limite maximo de entradas em memoria
  - default atual: `300`

### 10. Reindexacao completa da metadata

Arquivos:

- [src/services/ragMetadataReindexService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragMetadataReindexService.ts)
- [src/scripts/reindex-rag-metadata.ts](c:/Users/suporte/IA_Harpiawms/src/scripts/reindex-rag-metadata.ts)

O que mudou:

- foi criado um servico para varrer as colecoes do Qdrant e enriquecer payloads ja existentes
- isso atualiza documentos antigos sem exigir reupload manual

Motivo:

- a metadata nova precisa existir tambem nos documentos que ja estavam indexados antes desta fase
- sem reindexacao, a qualidade do filtro por tabela e do reranking ficaria inconsistente

Como executar:

```bash
npm run reindex:rag-metadata
```

Configuracao:

- `RAG_REINDEX_BATCH_SIZE`
  - quantidade de pontos lidos por scroll no Qdrant
  - default atual: `100`

### 11. Embeddings em lote com concorrencia controlada

Arquivo:

- [src/services/llm/embeddingService.ts](c:/Users/suporte/IA_Harpiawms/src/services/llm/embeddingService.ts)

O que mudou:

- `embedBatch` deixou de ser totalmente serial
- os embeddings agora sao gerados em paralelo com limite de concorrencia
- o fluxo tambem passou a respeitar timeout e retry configuraveis

Motivo:

- upload manual, schema e reindexacao ficavam mais lentos do que o necessario
- em VPS pequena nao convem liberar concorrencia sem limite

Configuracao:

- `EMBEDDING_BATCH_CONCURRENCY`
  - quantidade de embeddings simultaneos
  - default atual: `2`
- `OLLAMA_EMBED_TIMEOUT_MS`
- `OLLAMA_EMBED_RETRIES`

### 12. Formato de resposta por tipo de pergunta

Arquivo:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)

O que mudou:

- perguntas passaram a ter formato de resposta mais restrito por tipo:
  - `schema`
  - `procedure`
  - `troubleshooting`
- perguntas de erro/falha agora recebem tratamento proprio no prompt e no reranking

Motivo:

- um unico formato para toda pergunta tende a produzir resposta generica demais
- troubleshooting exige saida diferente de schema ou procedimento

### 13. Observabilidade basica do RAG

Arquivos:

- [src/services/ragService.ts](c:/Users/suporte/IA_Harpiawms/src/services/ragService.ts)
- [src/controllers/chatController.ts](c:/Users/suporte/IA_Harpiawms/src/controllers/chatController.ts)
- [src/routes/index.ts](c:/Users/suporte/IA_Harpiawms/src/routes/index.ts)

O que mudou:

- novo endpoint:
  - `GET /api/rag/stats`
- a resposta expõe:
  - tamanho atual do cache
  - TTL
  - limite maximo de itens
  - configuracao de contexto usada pelo RAG

Motivo:

- operacao precisa visibilidade minima para saber se cache e contexto estao coerentes

## Cobertura de Testes

Arquivo:

- [tests/vector-search.test.ts](c:/Users/suporte/IA_Harpiawms/tests/vector-search.test.ts)

Validacoes adicionadas:

- filtro estrito por tabela
- resposta sem LLM quando nao ha contexto suficiente
- diversidade de fontes no contexto final
- uso de `table_name` e `table_suffix` de metadata explicita
- reutilizacao de cache para perguntas repetidas

## Resultado Esperado

1. Menos respostas misturando tabelas erradas.
2. Menos respostas longas com contexto irrelevante.
3. Melhor uso de manuais em perguntas operacionais.
4. Menor latencia quando a base nao tem evidencia suficiente.
5. Menor dependencia de heuristica textual sobre chunks brutos.

## Proxima Etapa Recomendada

1. Executar a reindexacao em producao para popular metadata nova no Qdrant
2. Adicionar testes para `KnowledgeService` e `SchemaService`
3. Avaliar keep-alive do modelo e cache mais granular por fonte
