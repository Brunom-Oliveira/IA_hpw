# Consolidacao do Runtime

## Escopo

Este documento registra a consolidacao da aplicacao em uma unica pilha TypeScript, com foco em:

- remover composicao paralela de routers JS
- centralizar boot e dependencias
- preservar contratos externos
- reduzir ambiguidade de manutencao

## Problema Original

O projeto executava duas camadas ao mesmo tempo:

1. uma pilha TypeScript em `/api/*`
2. uma pilha legada JavaScript em `/rag`, `/schema` e `/knowledge`

Consequencias:

- regras de negocio duplicadas
- fluxo de execucao ambiguo
- mais risco de corrigir um caminho e deixar outro incorreto
- dificuldade de testes e de observabilidade

## Ajustes Aplicados

### 1. Composition root unico

Arquivo impactado:

- [src/app.ts](c:/Users/suporte/IA_Harpiawms/src/app.ts)

O que mudou:

- o boot deixou de usar `require()` de routers JS legados
- o runtime passou a instanciar apenas controllers e services da pilha TS

Motivo:

- o `app.ts` precisava voltar a ser a unica origem da composicao da aplicacao

### 2. Router de compatibilidade

Arquivo criado:

- [src/routes/compatibility.ts](c:/Users/suporte/IA_Harpiawms/src/routes/compatibility.ts)

O que mudou:

- endpoints antigos foram preservados
- a compatibilidade deixou de depender de routers JS separados

Motivo:

- evitar quebra de frontend, curl e integracoes existentes

### 3. Migracao do dominio de conhecimento para TS

Arquivos criados:

- [src/services/knowledgeService.ts](c:/Users/suporte/IA_Harpiawms/src/services/knowledgeService.ts)
- [src/services/knowledgeTransformer.ts](c:/Users/suporte/IA_Harpiawms/src/services/knowledgeTransformer.ts)
- [src/services/knowledgeValidator.ts](c:/Users/suporte/IA_Harpiawms/src/services/knowledgeValidator.ts)

O que mudou:

- o runtime nao depende mais de `src/knowledge/knowledge.service.js`
- insercao manual, audio, SQL, dashboard e estatisticas passaram para TS

Motivo:

- conhecimento e um dominio central do produto e nao podia continuar fora da pilha oficial

### 4. Migracao do dominio de schema para TS

Arquivos criados:

- [src/services/schemaService.ts](c:/Users/suporte/IA_Harpiawms/src/services/schemaService.ts)
- [src/services/schemaTransformer.ts](c:/Users/suporte/IA_Harpiawms/src/services/schemaTransformer.ts)
- [src/schema/schemaParser.ts](c:/Users/suporte/IA_Harpiawms/src/schema/schemaParser.ts)
- [src/sql/sqlParser.ts](c:/Users/suporte/IA_Harpiawms/src/sql/sqlParser.ts)
- [src/sql/ddlTransformer.ts](c:/Users/suporte/IA_Harpiawms/src/sql/ddlTransformer.ts)
- [src/sql/schemaIndexer.ts](c:/Users/suporte/IA_Harpiawms/src/sql/schemaIndexer.ts)

O que mudou:

- o runtime nao depende mais de `src/schema/schema.ingest.service.js`
- ingestao do schema e upload DDL passaram a sair da composicao legada
- parsing, transformacao e indexacao de DDL passaram a usar utilitarios TS nativos

Motivo:

- schema era o ultimo dominio ainda apoiado em adapter de transicao

### 5. Reimplementacao do endpoint publico de ingestao PDF em TS

Arquivo criado:

- [src/services/pdfIngestService.ts](c:/Users/suporte/IA_Harpiawms/src/services/pdfIngestService.ts)

O que mudou:

- `/rag/upload` passou a usar `RagService` oficial

Motivo:

- evitar pipeline paralelo de embeddings e indexacao

### 6. Remocao do legado morto

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

Motivo:

- depois da migracao, esses arquivos nao eram mais usados no runtime
- mantelos so aumentaria ruido e risco de confusao

## Resultado Arquitetural

### Antes

- dois estilos de aplicacao convivendo no mesmo processo
- dominio central dividido entre TS e JS

### Depois

- um unico backend Express
- uma unica composicao central
- controllers TS
- services TS
- compatibilidade preservada sem dualidade arquitetural

## Estado Final Desta Fase

- nao existem mais utilitarios JS de schema/DDL no runtime
- o fluxo de schema foi consolidado integralmente em TypeScript
- a base esta pronta para a proxima fase: qualidade de resposta e testes

## Validacao Executada

Comando:

```bash
npm run build
```

Resultado:

- compilacao TypeScript concluida com sucesso apos cada fase da migracao
