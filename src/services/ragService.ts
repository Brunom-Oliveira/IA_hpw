import { singleton, inject } from "tsyringe";
import { v4 as uuidv4 } from "uuid";
import { DocumentChunk, LlmPort, RagResponse, SearchResult, VectorDbPort } from "../types";
import { env } from "../utils/env";
import { EmbeddingService } from "./llm/embeddingService";
import { RagOpsStatus, ragOpsStatusService } from "./ragOpsStatusService";
import { ragQueryCache } from "./ragQueryCache";
import { QueryAnalysisService } from "./rag/queryAnalysisService";
import { SemanticCacheService } from "./semanticCacheService";

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

@singleton()
export class RagService {
  private readonly MAX_WINDOW = 4096;
  private readonly RESPONSE_RESERVE = 500;
  private readonly SYSTEM_RESERVE = 300;
  private readonly MAX_CONTEXT_DOCUMENTS = 3;
  private readonly MAX_CHUNKS_PER_SOURCE = 1;
  private readonly AVAILABLE_CONTEXT = this.MAX_WINDOW - this.RESPONSE_RESERVE - this.SYSTEM_RESERVE;

  constructor(
    @inject("VectorDbPort") private readonly vectorDb: VectorDbPort,
    private readonly embeddingService: EmbeddingService,
    @inject("LlmPort") private readonly llm: LlmPort,
    private readonly queryAnalysisService: QueryAnalysisService,
    private readonly semanticCache: SemanticCacheService,
  ) {}

  async insertDocuments(input: Array<{ text: string; metadata?: Record<string, string | number | boolean> }>): Promise<string[]> {
    const documents: DocumentChunk[] = input.map((item) => ({
      id: uuidv4(),
      text: item.text,
      metadata: item.metadata,
    }));

    const embeddings = await this.embeddingService.embedBatch(documents.map((doc) => doc.text));
    await this.vectorDb.upsert(documents, embeddings);
    ragQueryCache.invalidateByCollections([env.qdrantCollection]);
    ragQueryCache.invalidateBySourceKeys(
      documents.map((doc) => String(doc.metadata?.source || doc.metadata?.title || ""))
    );
    return documents.map((doc) => doc.id);
  }

  async ask(question: string, topK?: number): Promise<RagResponse> {
    const analysis = this.queryAnalysisService.analyze(question);
    const queryEmbedding = await this.embeddingService.embed(analysis.expandedQuestion || analysis.originalQuestion);

    const semanticCached = await this.semanticCache.find(queryEmbedding);
    if (semanticCached) {
      return { ...semanticCached, answer: `[CACHE SEMÂNTICO] ${semanticCached.answer}` };
    }

    const cacheKey = this.buildCacheKey(question, topK);
    const cached = ragQueryCache.get(cacheKey);
    if (cached) return cached;

    const curatedHits = await this.retrieveCuratedHits(analysis, queryEmbedding, topK);
    const contextData = this.buildContext(question, curatedHits, analysis);

    if (!contextData.trim()) {
      const fallback = this.buildNoContextResponse(analysis);
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

    ragQueryCache.set(cacheKey, response, this.buildCacheMetadata(curatedHits));
    this.semanticCache.add(queryEmbedding, response);
    return response;
  }

  async askStream(
    question: string,
    onToken: (chunk: any) => void,
    topK?: number,
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    const analysis = this.queryAnalysisService.analyze(question);
    const queryEmbedding = await this.embeddingService.embed(analysis.expandedQuestion || analysis.originalQuestion);
    
    const semanticCached = await this.semanticCache.find(queryEmbedding);
    if (semanticCached) {
      onToken({ sources: semanticCached.sources || [], context: semanticCached.context });
      onToken({ content: `[CACHE SEMÂNTICO] ${semanticCached.answer}`, done: true, usage: semanticCached.usage });
      return;
    }

    const cacheKey = this.buildCacheKey(question, topK);
    const cached = ragQueryCache.get(cacheKey);
    if (cached) {
      onToken({ sources: cached.sources || [], context: cached.context });
      onToken({ content: cached.answer, done: true, usage: cached.usage });
      return;
    }

    const curatedHits = await this.retrieveCuratedHits(analysis, queryEmbedding, topK);
    const contextData = this.buildContext(question, curatedHits, analysis);
    const sources = this.mapSources(curatedHits);

    onToken({ sources, context: contextData });

    if (!contextData.trim()) {
      const fallback = this.buildNoContextResponse(analysis);
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
    const finalResponse = {
      answer: assembled.trim(),
      context: contextData,
      matches: curatedHits.length,
      usage: finalUsage,
      sources,
    };
    ragQueryCache.set(cacheKey, finalResponse, this.buildCacheMetadata(curatedHits));
    this.semanticCache.add(queryEmbedding, finalResponse);
  }

  async search(query: string, topK = 4): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    return this.vectorDb.search(queryEmbedding, topK);
  }

  getDiagnostics(): any {
    const status = ragOpsStatusService.getStatus();
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
      operations: status.reindex,
      jobs: status.jobs,
    };
  }

  private async retrieveCuratedHits(analysis: QueryAnalysis, queryEmbedding: number[], requestedTopK?: number): Promise<SearchResult[]> {
    const candidateLimit = this.resolveCandidateLimit(analysis.originalQuestion, requestedTopK, analysis);
    const finalLimit = this.resolveFinalContextLimit(requestedTopK, analysis);
    const hits = await this.vectorDb.search(queryEmbedding, candidateLimit);
    return this.curateHitsByQuestion(hits, analysis, finalLimit);
  }

  private resolveCandidateLimit(question: string, requested?: number, analysis?: any): number {
    const base = requested && requested > 0 ? Math.min(12, requested * 3) : 8;
    const tokens = this.estimateTokens(question);
    const expanded = tokens > 60 ? Math.max(base, 12) : Math.max(base, 8);
    if (analysis?.mode === "schema") return Math.max(expanded, 10);
    return expanded;
  }

  private resolveFinalContextLimit(requested?: number, analysis?: any): number {
    const desired = requested && requested > 0 ? Math.min(this.MAX_CONTEXT_DOCUMENTS, requested) : this.MAX_CONTEXT_DOCUMENTS;
    if (analysis?.mode === "schema") return Math.min(2, desired);
    return desired;
  }

  private buildContext(_question: string, hits: SearchResult[], analysis: any): string {
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

  private buildWmsPrompt(context: string, question: string, analysis: any): string {
    // ... (rest of the method is unchanged)
  }

  private buildNoContextResponse(analysis: any): RagResponse {
    return {
      answer: this.buildNoContextAnswer(analysis),
      context: "",
      matches: 0,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, executionTimeMs: 0 },
      sources: [],
    };
  }

  private buildNoContextAnswer(analysis: any): string {
    if (analysis.tableHints.length > 0) {
      const requestedTable = analysis.tableHints.find((hint: string) => !hint.startsWith("_")) || analysis.tableHints[0].replace(/^_/, "");
      return `Nao encontrei contexto suficiente da tabela ${requestedTable} na base atual para responder com seguranca.`;
    }
    return "Nao encontrei informacoes suficientes na base atual para responder com seguranca.";
  }

  private estimateTokens(text: string): number {
    return Math.ceil(String(text || "").length / 4);
  }
  
  private curateHitsByQuestion(
    hits: SearchResult[],
    analysis: any,
    finalLimit: number,
  ): SearchResult[] {
    // ... (rest of the method is unchanged)
  }

  // ... other private methods like computeHitScore, normalizeVectorScore, selectDiverseHits, etc.
}

