# RAG Fine-tune & Quality Improvement Project

**Data**: 10/03/2026  
**Responsavel**: Squad IA  
**Status**: Em andamento (scaffold criado, aguardando dataset real)

---

## 1) Objetivo
- Elevar precisao e consistencia das respostas RAG em consultas de dominio WMS.
- Reduzir custo/token via prompt menor e comportamento aprendido.
- Diminuir alucinacoes e respostas genericas, aumentando aderencia a fontes.

## 2) Escopo
- Fine-tuning de modelo LLM base (Open/Local) com dados rotulados do WMS.
- Avaliacao offline + A/B online (feature flag) antes de adocao total.
- Nao inclui mudanca de infraestrutura de vetores (Qdrant permanece).

### Fora do escopo
- Suporte multilanguage.
- Reescrita do pipeline de ingestion de documentos.

## 3) Entregaveis
1. Dataset de treino/validacao/teste rotulado (JSONL).
2. Script de preparo de dados (limpeza, split, dedup).
3. Script de treino (fine-tune) + config de hiperparametros (placeholder criado).
4. Suite de avaliacao offline com metricas de fidelidade.
5. Plano de rollout (A/B) e rollback.
6. Documentacao atualizada (este doc + updates no INDEX).

## 4) Premissas e requisitos
- Base de dados interna pode ser usada para rotulacao apos anonimizacao.
- Limite de contexto do modelo alinhado com `RAG_NUM_CTX`.
- Ambiente com GPU ou endpoint de fine-tuning disponivel.
- Variaveis de ambiente de credenciais configuradas fora do repositório.

## 5) Pipeline de dados (passo a passo)
1. **Coleta**: extrair pares pergunta/resposta de tickets, FAQs e logs de chat que tiveram sucesso.  
2. **Filtro**: remover PII, normalizar acentos, padronizar nomes de tabela (UPPER_CASE).  
3. **Alinhamento RAG**: para cada exemplo, armazenar as fontes (IDs ou titles) usadas na resposta.  
4. **Deduplicacao**: remover duplicatas com hash de pergunta+resposta normalizada.  
5. **Split**: 80/10/10 (train/val/test) estratificando por modo (schema/procedure/troubleshooting/general).  
6. **Formato**: JSONL com campos:  
   ```json
   {
     "instruction": "<pergunta>",
     "context": "<trechos RAG ou vazio se sem contexto>",
     "response": "<resposta esperada>",
     "sources": ["titulo1", "titulo2"],
     "mode": "schema|procedure|troubleshooting|general"
   }
   ```

## 6) Treino (baseline sugerido)
- Modelo base: Llama-3-8B ou Granite-8B (compatibilidade com ollama ou provider escolhido).
- Max tokens: 1024 output; LR ~2e-5; warmup 5%; epochs 3; batch eff. 64.
- Incluir `mode` e `sources` no prompt de treino para reforcar citacao correta.
- Early stopping em BLEU/Rouge e metrica de factualidade (ver abaixo).

## 7) Avaliacao offline
- **Factualidade**: % de frases suportadas pelas fontes fornecidas.
- **Citacao**: % de respostas que citam pelo menos 1 fonte correta.
- **Prec/Rec modo schema**: taxa de acerto ao responder perguntas de tabela.
- **Tamanho**: tokens medios por resposta (queremos reduzir vs baseline).
- **Tempo**: latencia de inferencia single sample (batch=1) no hardware alvo.

## 8) Avaliacao online (A/B)
- Feature flag: `RAG_FT_ENABLED`.
- Grupo A (controle): modelo atual + prompt.
- Grupo B (tratamento): modelo fine-tunado (mesmo RAG/embedding).
- Metricas: CSAT, timeout rate, alucinacao reportada, tempo de resposta, taxa de uso de cache.
- Duracao minima: 7 dias ou 5k sessoes, o que ocorrer primeiro.
- Critérios de sucesso:  
  - +10% CSAT,  
  - -20% alucinacao reportada,  
  - +5% citacao correta,  
  - latencia nao piorar >10%.

## 9) Rollout e rollback
- Rollout gradual: 10% → 25% → 50% → 100% dos usuarios.
- Rollback: desativar `RAG_FT_ENABLED` e limpar cache de respostas finetunadas.
- Preservar logs de comparacao (requestId) para auditoria.

## 10) Observabilidade
- Metrics: latencia p50/p95, token usage, cache hit, citacao correta (amostra), erro 5xx.
- Logs: incluir `model_version` e `ft_exp_id` em cada resposta.
- Dashboard: grafico de comparacao Controle vs Tratamento.

## 11) Riscos e mitigacao
- **Overfit**: usar val set estratificado e early stopping.  
- **Dados sensiveis**: pipeline de PII stripping antes do treino.  
- **Custo**: limitar tamanho do dataset (ex.: 10-20k exemplos) e monitorar tokens.  
- **Drift**: agendar re-treino trimestral ou quando schema mudar.

## 12) Cronograma (estimativa)
- Semana 1: coleta + limpeza + dedup + split.
- Semana 2: rotulacao/fato-check + baseline treino + avaliacao offline.
- Semana 3: A/B test inicial + ajustes.
- Semana 4: rollout completo + handoff.

## 13) RACI resumido
- **Responsavel**: Squad IA (treino e eval).
- **Aprovador**: Lider tecnico.
- **Consultado**: Donos de dominio WMS.
- **Informado**: Produto / Operacoes.

## 14) Checklist de pronto para producao
- [ ] Dataset revisado e sem PII.
- [ ] Fine-tune concluido com metricas >= baseline.
- [ ] Teste offline salvo (relatorio).
- [ ] Flag de rollout configurada e testada.
- [ ] Dashboard de monitoramento ativo.
- [ ] Plano de rollback validado.
- [ ] Model version registrada em .env e docs.

## 15) Comandos úteis (scaffold atual)
```bash
# Preparar dataset (lê data/finetune/raw/*.jsonl e gera dataset.jsonl)
npm run ft:prepare

# Placeholder de treino (valida dataset e orienta próximo passo)
npm run ft:train
```
