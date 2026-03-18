# Plano de Evolução do Agente RAG – Harpia WMS
Sintaxe simples, execução nível sênior, sem quebrar código existente. Use como checklist (marque `[x]` quando concluído) e registre commits por item.

## Rotinas foco
Recebimento, conferência, armazenamento, movimentação, devolução, expedição, internalização. Exemplos: B311, B315.

## 1) Tags e metadados
- [ ] Definir tags por rotina/processo: `rotina`, `processo`, `tela/menu` (opcional), `papel`.
- [ ] Atualizar transformer/indexador para incluir tags, `table_name/table_suffix`, `source/title` claros (ex.: “Manual Recepção – B311 – Peso variavel”).
- [ ] Garantir `table_name` e `table_suffix` da tabela principal (já corrigido, validar).

## 2) Reindexação dirigida
- [ ] Separar coleções: `schema_knowledge` (schemas) e `knowledge_base` (manuais/fluxos).
- [ ] Reindexar manuais e schemas com novas tags das rotinas foco.
- [ ] Remover duplicatas antigas das rotinas críticas.
- [ ] Validar via Qdrant `scroll` se `rotina/processo` estão no payload.

## 3) Detecção de intenção (leve)
- [ ] Adicionar regex/palavras-chave por processo/rotina antes do `ask`.
- [ ] Se detectar, preencher `intent.processo` e `intent.rotina`.
- [ ] Passar `intent` para o serviço RAG para filtro/bias.

## 4) Recuperação “task-aware”
- [ ] Ao buscar, filtrar/ordenar por tags quando `intent` existir.
- [ ] Rerank local: similaridade + bônus se `rotina/processo` casam.
- [ ] Ajustar `topK` (3–5) e limitar contexto a hits da mesma rotina quando aplicável.

## 5) Prompt estruturado
- [ ] Template fixo: Intenção detectada, Rotina(s) sugeridas, Passo a passo, Pré-requisitos, Erros comuns, Fontes.
- [ ] Incluir fallback curto seguro quando `matches == 0` ou timeout.
- [ ] Manter persona “Analista de Suporte WMS Harpia”.

## 6) Fallbacks e tempo de resposta
- [ ] Frontend com `stream=false` (feito) – confirmar bundle.
- [ ] Ajustar timeouts (ex.: `OLLAMA_TIMEOUT_MS` 60–90s, `CHAT_STREAM_TIMEOUT_MS` similar).
- [ ] `RAG_MAX_OUTPUT_TOKENS` curto (<=80) para rapidez.
- [ ] Fallback: “Não encontrei passos para <rotina>. Especifique B311/B315.”.

## 7) Feedback e observabilidade
- [ ] Feedback 👍/👎 no frontend salvando `{query, intent, sources, rotina_detectada}`.
- [ ] Logs estruturados: request_id, intent, rotina, fontes, latência, fallback.
- [ ] Métricas: % respostas com fonte, latência média, taxa de fallback por processo.

## 8) Dashboard / endpoints
- [x] Endpoints schema: `/knowledge/schema-items`, `/knowledge/schema-stats`.
- [x] Dashboard consumindo `schema_knowledge`.
- [ ] (Opcional) Abas separadas para schemas/manuais; mostrar rotina/processo nas colunas.

## 9) Testes de aceitação
- [ ] Suite 20–30 perguntas (3 por processo + genéricas).
- [ ] Métricas: precisão@1, cobertura, tempo médio < 10s, taxa de fallback.
- [ ] Conferir frontend mostra resposta e fontes.

## 10) Sequência sugerida (passo a passo)
1. `git pull && docker-compose up -d --build`.
2. Implementar tags no transformer/indexador.
3. Adicionar camada de intenção; passar `intent` ao RAG.
4. Aplicar filtro/bônus por tags na busca.
5. Atualizar prompt template + fallback seguro.
6. Reindexar manuais/schemas das rotinas foco.
7. Hard refresh do frontend; confirmar chat non-stream.
8. Rodar suite de testes; revisar logs/latência.
9. Habilitar feedback; coletar métricas.
10. Documentar cada entrega (item, commit, data).

## 11) Boas práticas (não quebrar código)
- Adicionar caminhos condicionais (se `intent` existe, aplica filtros; senão fluxo atual).
- Manter defaults de coleções/rotas para compatibilidade.
- Commits pequenos e descritos; anotar alterações de env no README/DEPLOY.

## 12) Viabilidade e custo (resumo)
- Esforço: 3–5 dias para tagging/rerank/prompt/testes; +1–2 dias UI/feedback.
- Infra: modelos leves (<=3B) em CPU; opcional GPU para menor latência.
- Resultado esperado: respostas diretas com rotina correta, passos claros, fontes; redução de fallbacks e tempo de resposta.
