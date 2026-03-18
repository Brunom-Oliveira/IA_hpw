# Execução do Projeto – Agente RAG Harpia WMS
Guia prático e sequencial para aplicar as melhorias. Marque `[x]` ao concluir e registre commits.

## 0) Preparação
- [ ] `git pull` e `docker-compose up -d --build`.
- [ ] Confirmar modelos Ollama baixados: `llama3.2:1b` (rápido) e `nomic-embed-text`.
- [ ] Variáveis (compose/backend): `LLM_MODEL=llama3.2:1b`, `OLLAMA_TIMEOUT_MS≈60000-90000`, `CHAT_STREAM_TIMEOUT_MS≈60000`, `stream=false` no chat.

## 1) Taxonomia e Metadados
- [ ] Fixar lista de rotinas/processos: recebimento, conferência, armazenamento, movimentação, devolução, expedição, internalização (ex.: B311, B315).
- [ ] Tags padrão por item: `rotina`, `processo`, `papel`, `tela/menu`, `fonte` (atlassian, 3cx, manual, schema), `system/module`, `table_name/table_suffix` (para schemas).
- [ ] Atualizar transformer/indexador para escrever essas tags em todos os pontos (schemas e manuais).

## 2) Pipelines de Ingestão (automação)
- [ ] **Schemas SQL → schema_knowledge**: script existente; garantir tags e `table_name` corretos.
- [ ] **Atlassian (manuais)**: export/crawler → chunk → tags (rotina/processo) → `knowledge_base`.
- [ ] **Áudio 3CX**: transcrever (Whisper) → resumir (LLM) → classificar processo/rotina → tags → `knowledge_base`.
- [ ] **Inserção manual**: endpoint/form com campos obrigatórios de tags; validação.
- [ ] Agendar reindex (cron/CI) para Atlassian e 3CX; rodar reindex manual inicial.

## 3) Intent Detection e Recuperação
- [ ] Camada de intenção (regex/keywords) para mapear perguntas → `intent.processo` e, se houver, `intent.rotina`.
- [ ] Busca/Rerank: filtrar/boost por tags de `rotina/processo`; `topK` 3–5; contexto curto.
- [ ] Fallback se `matches==0` ou timeout: resposta curta orientando a especificar rotina.

## 4) Prompt
- [ ] Template fixo: Intenção, Rotina(s) sugeridas, Passo a passo, Pré-requisitos, Erros comuns, Fontes.
- [ ] Persona: Analista de Suporte WMS Harpia; citar fontes sempre.

## 5) Frontend
- [ ] Rebuild frontend após alterações (`docker-compose up -d --build frontend`).
- [ ] Chat sem streaming; exibir fontes e rotina detectada; feedback 👍/👎 por resposta.
- [ ] Dashboard consumindo `schema_knowledge`; filtros por processo/rotina; contagem por fonte.
- [ ] Form de inserção manual com tags obrigatórias.

## 6) Observabilidade e Feedback
- [ ] Logs estruturados: request_id, intent, rotina/processo, fontes, latência, fallback.
- [ ] Métricas simples: % respostas com fonte, latência média, taxa de fallback por processo, uso de cache.
- [ ] Persistir feedback do usuário (👍/👎) com query, fontes, rotina detectada.

## 7) Testes de Aceitação
- [ ] Criar suite de 20–30 perguntas (3 por processo + variações de rotina explícita/implícita).
- [ ] Critérios: precisão@1, cobertura, tempo médio <10s, taxa de fallback aceitável (<10% em rotinas foco).
- [ ] Validar no frontend (UI) e via API.

## 8) Rollout
- [ ] Reindex final (schemas + manuais + 3CX).
- [ ] Verificar dashboard (contagens) e amostras de respostas.
- [ ] Comunicar mudanças e como usar (nota curta com rotinas cobertas e comportamento de fallback).

## 9) Pendências abertas (preencher)
- [ ] ___________________________________________
- [ ] ___________________________________________
- [ ] ___________________________________________
