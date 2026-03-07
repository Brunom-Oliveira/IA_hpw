import { v4 as uuidv4 } from "uuid";
import { DocumentChunk, LlmPort, RagResponse, SearchResult, VectorDbPort } from "../types";
import { env } from "../utils/env";
import { EmbeddingService } from "./llm/embeddingService";
import { RagOpsStatus, ragOpsStatusService } from "./ragOpsStatusService";
import { ragQueryCache } from "./ragQueryCache";

type QueryMode = "schema" | "procedure" | "troubleshooting" | "general";

type QueryAnalysis = {
  mode: QueryMode;
  tableHints: string[];
  terms: string[];
  normalizedQuestion: string;
};

type RankedHit = {
  hit: SearchResult;
  score: number;
};

const STOP_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "como",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "ou",
  "para",
  "por",
  "qual",
  "quais",
  "que",
  "se",
  "uma",
  "um",
]);

export class RagService {
  private readonly MAX_WINDOW = 4096;
  private readonly RESPONSE_RESERVE = 500;
  private readonly SYSTEM_RESERVE = 300;
  private readonly MAX_CONTEXT_DOCUMENTS = 3;
  private readonly MAX_CHUNKS_PER_SOURCE = 1;
  private readonly AVAILABLE_CONTEXT = this.MAX_WINDOW - this.RESPONSE_RESERVE - this.SYSTEM_RESERVE;

  constructor(
    private readonly vectorDb: VectorDbPort,
    private readonly embeddingService: EmbeddingService,
    private readonly llm: LlmPort
  ) {}

  async insertDocuments(input: Array<{ text: string; metadata?: Record<string, string | number | boolean> }>): Promise<string[]> {
    const documents: DocumentChunk[] = input.map((item) => ({
      id: uuidv4(),
      text: item.text,
      metadata: item.metadata,
    }));

    const embeddings = await this.embeddingService.embedBatch(documents.map((doc) => doc.text));
    await this.vectorDb.upsert(documents, embeddings);
    ragQueryCache.clear();
    return documents.map((doc) => doc.id);
  }

  async ask(question: string, topK?: number): Promise<RagResponse> {
    const cacheKey = this.buildCacheKey(question, topK);
    const cached = ragQueryCache.get(cacheKey);
    if (cached) return cached;

    const analysis = this.analyzeQuestion(question);
    const curatedHits = await this.retrieveCuratedHits(question, topK, analysis);
    const contextData = this.buildContext(question, curatedHits, analysis);

    if (!contextData.trim()) {
      const fallback = this.buildNoContextResponse(question);
      ragQueryCache.set(cacheKey, fallback);
      return fallback;
    }

    const prompt = this.buildWmsPrompt(contextData, question, analysis);
    const result = await this.llm.generate(prompt);

    const response = {
      answer: result.response,
      context: contextData,
      matches: curatedHits.length,
      usage: result.usage,
      sources: this.mapSources(curatedHits),
    };
    ragQueryCache.set(cacheKey, response);
    return response;
  }

  async askStream(
    question: string,
    onToken: (chunk: any) => void,
    topK?: number,
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(question, topK);
    const cached = ragQueryCache.get(cacheKey);
    if (cached) {
      onToken({ sources: cached.sources || [], context: cached.context });
      onToken({ content: cached.answer, done: true, usage: cached.usage });
      return;
    }

    const analysis = this.analyzeQuestion(question);
    const curatedHits = await this.retrieveCuratedHits(question, topK, analysis);
    const contextData = this.buildContext(question, curatedHits, analysis);
    const sources = this.mapSources(curatedHits);

    onToken({ sources, context: contextData });

    if (!contextData.trim()) {
      const fallback = this.buildNoContextResponse(question);
      ragQueryCache.set(cacheKey, fallback);
      onToken({
        content: fallback.answer,
        done: true,
      });
      return;
    }

    const prompt = this.buildWmsPrompt(contextData, question, analysis);
    let assembled = "";
    let finalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      executionTimeMs: 0,
    };

    const streamingResponse = (chunk: any) => {
      if (typeof chunk?.content === "string") {
        assembled += chunk.content;
      }
      if (chunk?.usage) {
        finalUsage = chunk.usage;
      }
      onToken(chunk);
    };

    await this.llm.generateStream(prompt, streamingResponse, { signal: options?.signal });
    ragQueryCache.set(cacheKey, {
      answer: assembled.trim(),
      context: contextData,
      matches: curatedHits.length,
      usage: finalUsage,
      sources,
    });
  }

  async search(query: string, topK = 4): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    return this.vectorDb.search(queryEmbedding, topK);
  }

  getDiagnostics(): {
    cache: { size: number; ttl_ms: number; max_items: number };
    config: {
      max_context_documents: number;
      max_chunks_per_source: number;
      available_context_tokens: number;
    };
    runtime: {
      llm_model: string;
      embedding_model: string;
      llm_provider: string;
      qdrant_collection: string;
      rag_keep_alive: string;
      rag_num_ctx: number;
      rag_max_output_tokens: number;
    };
    operations: RagOpsStatus["reindex"];
  } {
    return {
      cache: ragQueryCache.stats(),
      config: {
        max_context_documents: this.MAX_CONTEXT_DOCUMENTS,
        max_chunks_per_source: this.MAX_CHUNKS_PER_SOURCE,
        available_context_tokens: this.AVAILABLE_CONTEXT,
      },
      runtime: {
        llm_model: env.llmModel,
        embedding_model: env.embeddingModel,
        llm_provider: env.llmProvider,
        qdrant_collection: env.qdrantCollection,
        rag_keep_alive: env.ragKeepAlive,
        rag_num_ctx: env.ragNumCtx,
        rag_max_output_tokens: env.ragMaxOutputTokens,
      },
      operations: ragOpsStatusService.getStatus().reindex,
    };
  }

  private async retrieveCuratedHits(question: string, requestedTopK: number | undefined, analysis: QueryAnalysis): Promise<SearchResult[]> {
    const candidateLimit = this.resolveCandidateLimit(question, requestedTopK, analysis);
    const finalLimit = this.resolveFinalContextLimit(requestedTopK, analysis);
    const queryEmbedding = await this.embeddingService.embed(question);
    const hits = await this.vectorDb.search(queryEmbedding, candidateLimit);
    return this.curateHitsByQuestion(question, hits, analysis, finalLimit);
  }

  private resolveCandidateLimit(question: string, requested?: number, analysis?: QueryAnalysis): number {
    const base = requested && requested > 0 ? Math.min(12, requested * 3) : 8;
    const tokens = this.estimateTokens(question);
    const expanded = tokens > 60 ? Math.max(base, 12) : Math.max(base, 8);
    if (analysis?.mode === "schema") return Math.max(expanded, 10);
    return expanded;
  }

  private resolveFinalContextLimit(requested?: number, analysis?: QueryAnalysis): number {
    const desired = requested && requested > 0 ? Math.min(this.MAX_CONTEXT_DOCUMENTS, requested) : this.MAX_CONTEXT_DOCUMENTS;
    if (analysis?.mode === "schema") return Math.min(2, desired);
    return desired;
  }

  private buildContext(_question: string, hits: SearchResult[], analysis: QueryAnalysis): string {
    const budget = analysis.mode === "schema" ? Math.min(2200, this.AVAILABLE_CONTEXT) : this.AVAILABLE_CONTEXT;
    let currentTokens = 0;
    const selectedBlocks: string[] = [];
    const sourceUsage = new Map<string, number>();

    for (const hit of hits) {
      const sourceKey = this.buildSourceKey(hit);
      const sourceCount = sourceUsage.get(sourceKey) || 0;
      if (sourceCount >= this.MAX_CHUNKS_PER_SOURCE) continue;

      const block = this.formatContextBlock(hit);
      const tokens = this.estimateTokens(block);
      if (currentTokens + tokens > budget) break;

      selectedBlocks.push(block);
      currentTokens += tokens;
      sourceUsage.set(sourceKey, sourceCount + 1);
    }

    return selectedBlocks.join("\n\n---\n\n");
  }

  private buildWmsPrompt(context: string, question: string, analysis: QueryAnalysis): string {
    const responseModeInstruction =
      analysis.mode === "schema"
        ? "Se a pergunta citar uma tabela especifica, responda somente com informacoes dessa tabela. Nao use tabelas relacionadas como substitutas."
        : analysis.mode === "troubleshooting"
          ? "Se a pergunta for sobre erro ou falha, responda com base em evidencias do contexto e destaque a acao recomendada."
          : "Se a pergunta for operacional, responda em passos curtos e praticos.";

    const responseFormat =
      analysis.mode === "schema"
        ? [
            "FORMATO DA RESPOSTA:",
            "- Responda em no maximo 6 linhas.",
            "- Cite somente informacoes da tabela alvo.",
            "- Nomeie explicitamente a tabela na primeira linha quando possivel.",
          ]
        : analysis.mode === "troubleshooting"
          ? [
              "FORMATO DA RESPOSTA:",
              "- Responda em no maximo 6 linhas.",
              "- Estruture em: Problema, Evidencias, Acao recomendada.",
              "- Nao sugira causa sem evidencia minima no contexto.",
            ]
          : [
              "FORMATO DA RESPOSTA:",
              "- Responda em no maximo 6 linhas.",
              "- Cite a tabela ou fonte quando isso ajudar.",
              "- Para perguntas operacionais, use passos numerados curtos.",
            ];

    return [
      "Voce e um analista de suporte especialista no sistema HarpiaWMS.",
      "Responda usando apenas o contexto fornecido.",
      "Se o contexto nao trouxer evidencia suficiente, diga claramente que nao encontrou a informacao na base.",
      "Nao invente campos, tabelas, causas ou procedimentos.",
      responseModeInstruction,
      "Priorize resposta objetiva, tecnica e curta.",
      "",
      "CONTEXTO:",
      context,
      "",
      `PERGUNTA: ${question}`,
      "",
      ...responseFormat,
      "",
      "RESPOSTA:",
    ].join("\n");
  }

  private buildNoContextResponse(question: string): RagResponse {
    return {
      answer: this.buildNoContextAnswer(question),
      context: "",
      matches: 0,
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        executionTimeMs: 0,
      },
      sources: [],
    };
  }

  private buildNoContextAnswer(question: string): string {
    const analysis = this.analyzeQuestion(question);
    if (analysis.tableHints.length > 0) {
      const requestedTable = analysis.tableHints.find((hint) => !hint.startsWith("_")) || analysis.tableHints[0].replace(/^_/, "");
      return `Nao encontrei contexto suficiente da tabela ${requestedTable} na base atual para responder com seguranca.`;
    }

    return "Nao encontrei informacoes suficientes na base atual para responder com seguranca.";
  }

  private estimateTokens(text: string): number {
    return Math.ceil(String(text || "").length / 4);
  }

  private analyzeQuestion(question: string): QueryAnalysis {
    const normalizedQuestion = this.normalizeText(question);
    const tableHints = this.extractTableHints(question);
    const terms = normalizedQuestion
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

    const schemaSignals = ["campo", "coluna", "constraint", "fk", "pk", "tabela", "schema", "ddl", "estrutura"];
    const procedureSignals = ["como", "passo", "procedimento", "rotina", "recepcao", "recebimento", "impressao", "configurar"];
    const troubleshootingSignals = ["erro", "falha", "problema", "corrigir", "ajustar", "nao funciona", "timeout", "rejeicao"];

    const hasSchemaSignal = tableHints.length > 0 || schemaSignals.some((signal) => normalizedQuestion.includes(signal));
    const hasProcedureSignal = procedureSignals.some((signal) => normalizedQuestion.includes(signal));
    const hasTroubleshootingSignal = troubleshootingSignals.some((signal) => normalizedQuestion.includes(signal));

    return {
      mode: hasSchemaSignal ? "schema" : hasTroubleshootingSignal ? "troubleshooting" : hasProcedureSignal ? "procedure" : "general",
      tableHints,
      terms,
      normalizedQuestion,
    };
  }

  private curateHitsByQuestion(
    _question: string,
    hits: SearchResult[],
    analysis: QueryAnalysis,
    finalLimit: number,
  ): SearchResult[] {
    if (!Array.isArray(hits) || hits.length === 0) return [];

    const scopedHits = analysis.tableHints.length > 0
      ? this.filterStrictTableHits(hits, analysis.tableHints)
      : hits;

    if (analysis.tableHints.length > 0 && scopedHits.length === 0) {
      return [];
    }

    const ranked = scopedHits
      .map((hit) => ({
        hit,
        score: this.computeHitScore(hit, analysis),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return this.selectDiverseHits(ranked, finalLimit);
  }

  private computeHitScore(hit: SearchResult, analysis: QueryAnalysis): number {
    const title = String(hit.metadata?.title || "");
    const source = String(hit.metadata?.source || hit.metadata?.file_name || "");
    const category = String(hit.metadata?.category || "");
    const system = String(hit.metadata?.system || "");
    const module = String(hit.metadata?.module || "");
    const tableName = String(hit.metadata?.table_name || "");
    const tableSuffix = String(hit.metadata?.table_suffix || "");
    const documentType = String(hit.metadata?.document_type || "");
    const section = String(hit.metadata?.section || "");
    const tags = String(hit.metadata?.tags_csv || "");
    const textHead = String(hit.text || "").slice(0, 2200);
    const haystack = this.normalizeText([title, source, category, system, module, tableName, tableSuffix, documentType, section, tags, textHead].join("\n"));

    let score = this.normalizeVectorScore(hit.distance);

    for (const hint of analysis.tableHints) {
      if (hint.startsWith("_")) {
        const suffixPattern = new RegExp(`_[0]*${hint.slice(1)}\\b`, "i");
        if (suffixPattern.test(`${title}\n${source}\n${system}`)) score += 120;
        if (String(tableSuffix || "").replace(/^0+/, "") === hint.slice(1).replace(/^0+/, "")) score += 180;
        if (suffixPattern.test(textHead)) score += 35;
      } else {
        const normalizedHint = this.normalizeText(hint);
        if (haystack.includes(normalizedHint)) score += 140;
        if (this.normalizeText(title).includes(normalizedHint)) score += 40;
        if (this.normalizeText(tableName).includes(normalizedHint)) score += 160;
      }
    }

    const lexicalOverlap = analysis.terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
    score += lexicalOverlap * 18;

    if (analysis.mode === "schema") {
      if (category.toLowerCase() === "schema") score += 55;
      if (documentType === "schema_table") score += 40;
      if (documentType === "constraints" || section === "constraints") score += analysis.normalizedQuestion.includes("constraint") ? 30 : 0;
      if (documentType === "relationships" || section === "relationships") score += analysis.normalizedQuestion.includes("relacion") || analysis.normalizedQuestion.includes("fk") ? 30 : 0;
      if (this.normalizeText(title).includes("estrutura da tabela")) score += 30;
      if (this.normalizeText(textHead).includes("tabela:")) score += 15;
    }

    if (analysis.mode === "procedure") {
      if (category.toLowerCase() === "manual") score += 45;
      if (category.toLowerCase() === "ticket") score += 20;
      if (this.normalizeText(textHead).includes("procedimento") || this.normalizeText(textHead).includes("passo")) score += 20;
    }

    if (analysis.mode === "troubleshooting") {
      if (category.toLowerCase() === "ticket") score += 45;
      if (category.toLowerCase() === "audio_case") score += 30;
      if (this.normalizeText(textHead).includes("erro") || this.normalizeText(textHead).includes("falha")) score += 25;
      if (this.normalizeText(textHead).includes("causa") || this.normalizeText(textHead).includes("solucao")) score += 20;
    }

    if (!analysis.tableHints.length && analysis.mode === "general") {
      score += lexicalOverlap > 0 ? 10 : 0;
    }

    return score;
  }

  private normalizeVectorScore(rawDistance: number): number {
    if (!Number.isFinite(rawDistance)) return 0;
    if (rawDistance >= 0 && rawDistance <= 1.5) {
      return rawDistance * 40;
    }
    return Math.max(0, 20 - rawDistance);
  }

  private selectDiverseHits(rankedHits: RankedHit[], finalLimit: number): SearchResult[] {
    const selected: SearchResult[] = [];
    const seenSources = new Set<string>();

    for (const item of rankedHits) {
      const sourceKey = this.buildSourceKey(item.hit);
      if (seenSources.has(sourceKey) && selected.length < Math.max(1, finalLimit - 1)) {
        continue;
      }

      selected.push(item.hit);
      seenSources.add(sourceKey);
      if (selected.length >= finalLimit) break;
    }

    return selected;
  }

  private mapSources(hits: SearchResult[]): Array<{ title: string; category: string }> {
    return hits.map((hit) => ({
      title: String(hit.metadata?.title || hit.metadata?.source || "Documento"),
      category: String(hit.metadata?.category || "Geral"),
    }));
  }

  private formatContextBlock(hit: SearchResult): string {
    const title = String(hit.metadata?.title || hit.metadata?.source || "Documento");
    const category = String(hit.metadata?.category || "geral");
    const system = String(hit.metadata?.system || "Nao informado");
    const module = String(hit.metadata?.module || "Nao informado");

    return [
      `Fonte: ${title}`,
      `Categoria: ${category}`,
      `Sistema: ${system}`,
      `Modulo: ${module}`,
      "",
      String(hit.text || "").trim(),
    ].join("\n");
  }

  private buildSourceKey(hit: SearchResult): string {
    return [
      String(hit.metadata?.source || ""),
      String(hit.metadata?.file_name || ""),
      String(hit.metadata?.title || ""),
      String(hit.metadata?.table || ""),
    ].join("|").toUpperCase();
  }

  private buildCacheKey(question: string, topK?: number): string {
    const normalizedQuestion = this.normalizeText(question).replace(/\s+/g, " ").trim();
    return `${normalizedQuestion}::${topK || "default"}`;
  }

  private extractTableHints(question: string): string[] {
    const normalized = String(question || "").toUpperCase();
    const hints = new Set<string>();

    const explicitTable = normalized.match(/\b([A-Z][A-Z0-9_]*_\d{2,4})\b/g) || [];
    explicitTable.forEach((value) => hints.add(value));

    const numericTable = normalized.match(/\bTABELA\s+(\d{2,4})\b/g) || [];
    numericTable.forEach((entry) => {
      const digits = entry.replace(/\D+/g, "");
      if (digits) hints.add(`_${digits}`);
    });

    return [...hints];
  }

  private filterStrictTableHits(hits: SearchResult[], tableHints: string[]): SearchResult[] {
    const strictSuffixes = tableHints
      .filter((hint) => hint.startsWith("_"))
      .map((hint) => hint.slice(1))
      .filter(Boolean);

    const strictNames = tableHints
      .filter((hint) => !hint.startsWith("_"))
      .map((hint) => hint.toUpperCase());

    return hits.filter((hit) => {
      const title = String(hit.metadata?.title || "").toUpperCase();
      const source = String(hit.metadata?.source || "").toUpperCase();
      const system = String(hit.metadata?.system || "").toUpperCase();
      const fileName = String(hit.metadata?.file_name || "").toUpperCase();
      const tableName = String(hit.metadata?.table_name || "").toUpperCase();
      const tableSuffix = String(hit.metadata?.table_suffix || "").toUpperCase();
      const haystack = `${title}\n${source}\n${system}\n${fileName}\n${tableName}\n${tableSuffix}`;

      for (const tableName of strictNames) {
        if (haystack.includes(tableName)) return true;
      }

      for (const suffix of strictSuffixes) {
        const suffixPattern = new RegExp(`_[0]*${suffix}\\b`);
        if (suffixPattern.test(haystack)) return true;
        if (tableSuffix.replace(/^0+/, "") === suffix.replace(/^0+/, "")) return true;
      }

      return false;
    });
  }

  private normalizeText(text: string): string {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
}
