# Estrategia de Testes Atual

## Objetivo

Documentar a suite de testes minima alinhada ao backend apos a consolidacao da arquitetura em TypeScript.

## Problema que Foi Corrigido

A suite anterior estava desalinhada com o runtime atual:

- havia teste importando `ChatService`, que nao existe mais no backend oficial
- havia teste de `RagService` usando assinatura antiga
- a cobertura nao validava o comportamento real de filtro de tabela no RAG

Isso gerava uma falsa percepcao de seguranca.

## Escopo Atual da Suite

### 1. Classificacao

Arquivo:

- [tests/classification.test.ts](c:/Users/suporte/IA_Harpiawms/tests/classification.test.ts)

Valida:

- classificacao por regras para textos tecnicos
- fallback para `general` quando nao ha sinais relevantes

### 2. RAG

Arquivo:

- [tests/vector-search.test.ts](c:/Users/suporte/IA_Harpiawms/tests/vector-search.test.ts)

Valida:

- insercao de documentos com embeddings em lote
- curadoria estrita de contexto quando a pergunta cita uma tabela especifica

Motivo:

- esse e um dos comportamentos mais sensiveis do produto hoje
- foi a area com mais regressao funcional recente

### 3. Whisper

Arquivo:

- [tests/whisper-chat.test.ts](c:/Users/suporte/IA_Harpiawms/tests/whisper-chat.test.ts)

Valida:

- fluxo de transcricao quando o processo Whisper conclui com sucesso
- propagacao de erro quando o binario retorna codigo diferente de zero

Motivo:

- o backend precisa tratar corretamente o contrato do processo externo
- esse teste evita quebrar a integracao sem perceber

## Comando de Validacao

```bash
npm test
```

No ambiente local Windows deste projeto, o comando pode precisar ser executado como:

```bash
npm.cmd test
```

## Criterios Arquiteturais para Novos Testes

1. O teste deve mirar contratos atuais da pilha TypeScript oficial.
2. O teste nao deve depender de rotas ou services legados removidos.
3. Integracoes externas devem ser mockadas quando o objetivo for validar logica de dominio.
4. Regras criticas de RAG devem ter cobertura direcionada, principalmente filtro de tabela e composicao de contexto.

## Proxima Etapa Recomendada

Adicionar testes para:

1. `KnowledgeService`
2. `SchemaService`
3. `DocumentController`
4. `ChatController` com fluxo SSE
