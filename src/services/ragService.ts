import { v4 as uuidv4 } from "uuid";
import { DocumentChunk, LlmPort, RagResponse, SearchResult, VectorDbPort } from "../types";
import { EmbeddingService } from "./llm/embeddingService";

export class RagService {
  private readonly MAX_WINDOW = 4096;
  private readonly RESPONSE_RESERVE = 500;
  private readonly SYSTEM_RESERVE = 300;
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
    return documents.map((doc) => doc.id);
  }

  async ask(question: string, topK?: number): Promise<RagResponse> {
    const resolvedTopK = this.resolveTopK(question, topK);
    const queryEmbedding = await this.embeddingService.embed(question);
    const hits = await this.vectorDb.search(queryEmbedding, resolvedTopK);
    const curatedHits = this.curateHitsByQuestion(question, hits);

    const contextData = this.buildContext(question, curatedHits);
    const prompt = this.buildWmsPrompt(contextData, question);

    const result = await this.llm.generate(prompt);

    return {
      answer: result.response,
      context: contextData,
      matches: curatedHits.length,
      usage: result.usage,
      sources: curatedHits.map(h => ({ title: String(h.metadata?.title || "Documento"), category: String(h.metadata?.category || "Geral") }))
    };
  }

  async askStream(question: string, onToken: (chunk: any) => void, topK?: number): Promise<void> {
    const resolvedTopK = this.resolveTopK(question, topK);
    const queryEmbedding = await this.embeddingService.embed(question);
    const hits = await this.vectorDb.search(queryEmbedding, resolvedTopK);
    const curatedHits = this.curateHitsByQuestion(question, hits);

    const contextData = this.buildContext(question, curatedHits);
    const prompt = this.buildWmsPrompt(contextData, question);

    const sources = curatedHits.map(h => ({
      title: String(h.metadata?.title || "Documento"),
      category: String(h.metadata?.category || "Geral")
    }));

    // Send sources first
    onToken({ sources, context: contextData });

    await this.llm.generateStream(prompt, onToken);
  }

  async search(query: string, topK = 4): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    return this.vectorDb.search(queryEmbedding, topK);
  }

  private resolveTopK(question: string, requested?: number): number {
    if (requested && requested > 0) return Math.min(10, requested);
    
    const tokens = this.estimateTokens(question);
    if (tokens < 20) return 4;
    if (tokens > 60) return 8;
    return 6;
  }

  private buildContext(question: string, hits: SearchResult[]): string {
    const questionTokens = this.estimateTokens(question);
    const budget = this.AVAILABLE_CONTEXT - questionTokens;
    
    let currentTokens = 0;
    const selectedText: string[] = [];

    for (const hit of hits) {
      const tokens = this.estimateTokens(hit.text);
      if (currentTokens + tokens > budget) break;
      
      selectedText.push(hit.text);
      currentTokens += tokens;
    }

    return selectedText.join("\n\n---\n\n");
  }

  private buildWmsPrompt(context: string, question: string): string {
    return `Você é um Analista de Suporte Especialista no sistema HarpiaWMS.
Sua missão é resolver problemas técnicos e operacionais baseando-se APENAS no contexto fornecido.

INSTRUÇÕES:
1. Seja técnico, direto e objetivo.
2. Se o contexto mencionar nomes de tabelas SQL, use-os na resposta.
3. Se não houver informações no contexto para responder, diga: "Não encontrei informações sobre isso na minha base de conhecimento do WMS."
4. Sugira passos de diagnóstico baseados em sintomas, causas e soluções descritas no contexto.

CONTEXTO DO WMS:
${context}

PERGUNTA DO USUÁRIO:
${question}

RESPOSTA TÉCNICA:`;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private curateHitsByQuestion(question: string, hits: SearchResult[]): SearchResult[] {
    if (!Array.isArray(hits) || hits.length === 0) return [];

    const tableHints = this.extractTableHints(question);
    if (tableHints.length === 0) return hits;

    const scored = hits
      .map((hit) => ({
        hit,
        score: this.computeHitLexicalScore(hit, tableHints),
      }))
      .sort((a, b) => b.score - a.score);

    const bestScore = scored[0]?.score ?? 0;
    if (bestScore <= 0) {
      // If the user explicitly asked for a table and we found no related chunks,
      // prefer empty context over unrelated tables.
      return [];
    }

    return scored
      .filter((item) => item.score > 0)
      .map((item) => item.hit);
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

  private computeHitLexicalScore(hit: SearchResult, tableHints: string[]): number {
    const title = String(hit.metadata?.title || "").toUpperCase();
    const source = String(hit.metadata?.source || "").toUpperCase();
    const textHead = String(hit.text || "").slice(0, 2500).toUpperCase();
    const haystack = `${title}\n${source}\n${textHead}`;

    let score = 0;
    for (const hint of tableHints) {
      if (!hint) continue;

      if (hint.startsWith("_")) {
        const suffix = hint;
        const regex = new RegExp(`[A-Z0-9_]+${suffix}\\b`, "g");
        if (regex.test(haystack)) score += 40;
        if (title.includes(suffix)) score += 20;
      } else {
        if (haystack.includes(hint)) score += 60;
        if (title.includes(hint)) score += 25;
      }
    }

    return score;
  }
}
