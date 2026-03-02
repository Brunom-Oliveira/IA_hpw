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

    const contextData = this.buildContext(question, hits);
    const prompt = this.buildWmsPrompt(contextData, question);

    const result = await this.llm.generate(prompt);

    return {
      answer: result.response,
      context: contextData,
      matches: hits.length,
      usage: result.usage,
      sources: hits.map(h => ({ title: String(h.metadata?.title || "Documento"), category: String(h.metadata?.category || "Geral") }))
    };
  }

  async askStream(question: string, onToken: (chunk: any) => void, topK?: number): Promise<void> {
    const resolvedTopK = this.resolveTopK(question, topK);
    const queryEmbedding = await this.embeddingService.embed(question);
    const hits = await this.vectorDb.search(queryEmbedding, resolvedTopK);

    const contextData = this.buildContext(question, hits);
    const prompt = this.buildWmsPrompt(contextData, question);

    const sources = hits.map(h => ({
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
}

