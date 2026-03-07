import axios from "axios";
import { randomUUID } from "crypto";
import { env } from "../utils/env";
import { EmbeddingService } from "./llm/embeddingService";
import { LlmPort } from "../types";
import { KnowledgeItem, KnowledgeItemInput, KnowledgeTransformer } from "./knowledgeTransformer";
import { KnowledgeValidator } from "./knowledgeValidator";
import { SchemaParser } from "../schema/schemaParser";
import { parseDDL, ParsedSchemaTable as DdlParsedSchemaTable } from "../sql/sqlParser";
import { buildRagMetadata, extractPrimaryTableName } from "../utils/ragMetadata";
import { ragQueryCache } from "./ragQueryCache";

type LegacyParsedSchemaTable = {
  table: string;
  columns?: Array<{ name: string; type: string }>;
  primaryKey?: string[];
  foreignKeys?: Array<{ field: string; referencedTable: string }>;
  check_constraints?: Array<{ expression?: string }>;
};

type ExtractedAudioPayload = {
  mantis: {
    summary: string;
    description: string;
  };
  knowledge_item: KnowledgeItem;
};

export class KnowledgeService {
  private collectionReady = false;
  private readonly transformer = new KnowledgeTransformer();
  private readonly validator = new KnowledgeValidator();
  private readonly schemaParser = new SchemaParser();

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly llm: LlmPort,
  ) {}

  async ingestManual(payload: KnowledgeItemInput): Promise<{ id: string; payload: Record<string, unknown> }> {
    const validation = this.validator.validateManualInput(payload as Record<string, unknown>);
    if (!validation.valid) {
      const error = new Error(validation.errors.join("; "));
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const normalized = this.transformer.normalizeInput(payload);
    return this.indexOne(normalized);
  }

  async ingestAudioTranscription(
    transcription: string,
    defaults: { system?: string; module?: string } = {},
  ): Promise<{ id: string; payload: Record<string, unknown> }> {
    if (!transcription || typeof transcription !== "string") {
      const error = new Error("transcription obrigatoria");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const structured = await this.structureByLlm(transcription, defaults);
    return this.ingestManual(structured);
  }

  async autoProcessAudioTranscription(
    transcription: string,
    defaults: { system?: string; module?: string } = {},
    options: { save_to_knowledge?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    if (!transcription || typeof transcription !== "string") {
      const error = new Error("transcription obrigatoria");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const normalizedTranscription = await this.normalizeTranscriptionText(transcription);
    const parsed = await this.extractAudioTicketAndKnowledge(normalizedTranscription, defaults);
    const shouldSave = Boolean(options.save_to_knowledge);

    if (!shouldSave) {
      return {
        saved: false,
        transcription_normalized: normalizedTranscription,
        mantis: parsed.mantis,
        knowledge_item: parsed.knowledge_item,
      };
    }

    const saved = await this.ingestManual(parsed.knowledge_item);
    return {
      saved: true,
      transcription_normalized: normalizedTranscription,
      mantis: parsed.mantis,
      knowledge_item: parsed.knowledge_item,
      index_result: saved,
    };
  }

  async ingestSqlContent(sqlText: string, sourceName = "schema.sql"): Promise<Record<string, unknown>> {
    if (!sqlText || typeof sqlText !== "string") {
      const error = new Error("Conteudo SQL obrigatorio");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const tableDefs = this.parseSqlWithFallback(sqlText);
    if (!tableDefs.length) {
      const error = new Error("Nao foi possivel identificar CREATE TABLE valido no arquivo SQL");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    const indexed: Array<{ table: string; id: string }> = [];
    for (const tableDef of tableDefs) {
      if (!tableDef?.table) continue;
      const doc = this.transformer.tableToKnowledgeDocument(tableDef, sourceName);
      const result = await this.indexOne(doc);
      indexed.push({
        table: tableDef.table,
        id: String(result.id),
      });
    }

    if (!indexed.length) {
      const error = new Error("Nenhuma tabela valida encontrada para indexacao");
      (error as Error & { statusCode?: number }).statusCode = 400;
      throw error;
    }

    return {
      indexed_tables: indexed.map((item) => item.table),
      total: indexed.length,
      items: indexed,
    };
  }

  async listItems(category = ""): Promise<Record<string, unknown>[]> {
    await this.ensureCollection();
    const response = await axios.post(`${env.qdrantUrl}/collections/${env.qdrantCollection}/points/scroll`, {
      with_payload: true,
      with_vector: false,
      limit: 300,
    });

    const points = this.extractScrollPoints(response.data);
    const items = points.map((point) => ({
      id: point.id,
      ...(point.payload || {}),
    }));

    if (!category) return items;
    return items.filter((item) => String((item as Record<string, unknown>).category || "") === category);
  }

  async getStats(): Promise<{ total: number; by_category: Record<string, number> }> {
    const items = await this.listItems();
    const byCategory: Record<string, number> = {};

    for (const item of items) {
      const key = String(item.category || "unknown");
      byCategory[key] = (byCategory[key] || 0) + 1;
    }

    return {
      total: items.length,
      by_category: byCategory,
    };
  }

  private async ensureCollection(): Promise<void> {
    if (this.collectionReady) return;

    try {
      await axios.get(`${env.qdrantUrl}/collections/${env.qdrantCollection}`);
      this.collectionReady = true;
      return;
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }

    await axios.put(`${env.qdrantUrl}/collections/${env.qdrantCollection}`, {
      vectors: {
        size: env.qdrantVectorSize,
        distance: env.qdrantDistance,
      },
    });
    this.collectionReady = true;
  }

  private async indexOne(structuredData: KnowledgeItem): Promise<{ id: string; payload: Record<string, unknown> }> {
    await this.ensureCollection();
    const text = this.transformer.buildStandardText(structuredData);
    const vector = await this.embedText(text);
    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const point = {
      id,
      vector,
      payload: {
        created_at: createdAt,
        text,
        ...buildRagMetadata({
          category: structuredData.category,
          system: structuredData.system,
          module: structuredData.module,
          title: structuredData.title,
          source: structuredData.title || structuredData.system || "knowledge-item",
          text,
          tableName: structuredData.tables_related[0] || extractPrimaryTableName(text),
          relatedTables: structuredData.tables_related || [],
          tags: structuredData.tags || [],
          documentType: structuredData.category === "schema" ? "schema_table" : undefined,
        }),
        tables_related: structuredData.tables_related || [],
        tags: structuredData.tags || [],
      },
    };

    await axios.put(`${env.qdrantUrl}/collections/${env.qdrantCollection}/points`, { points: [point] });
    ragQueryCache.clear();
    return { id, payload: point.payload };
  }

  private async embedText(text: string): Promise<number[]> {
    const vector = await this.embeddingService.embed(text);
    if (vector.length === env.qdrantVectorSize) return vector;
    if (vector.length > env.qdrantVectorSize) return vector.slice(0, env.qdrantVectorSize);
    return vector.concat(new Array(env.qdrantVectorSize - vector.length).fill(0));
  }

  private parseSqlWithFallback(sqlText: string): LegacyParsedSchemaTable[] {
    try {
      return this.schemaParser.parseSql(sqlText);
    } catch {
      const parsed = parseDDL(sqlText);
      const tables = Array.isArray(parsed.tables) ? parsed.tables : [];
      return tables.map((table) => ({
        table: String(table.table_name || ""),
        columns: Array.isArray(table.columns) ? table.columns.map((column) => ({ name: column.name, type: column.type })) : [],
        primaryKey: Array.isArray(table.primary_key) ? table.primary_key : [],
        check_constraints: Array.isArray(table.check_constraints)
          ? table.check_constraints.map((check) => ({ expression: check.expression }))
          : [],
        foreignKeys: Array.isArray(table.foreign_keys)
          ? table.foreign_keys.map((fk: DdlParsedSchemaTable["foreign_keys"][number]) => ({
              field: Array.isArray(fk.columns) ? String(fk.columns[0] || "") : "",
              referencedTable: `${fk.references?.schema || ""}.${fk.references?.table_name || ""}`.replace(/^\./, ""),
            }))
          : [],
      })).filter((table) => table.table);
    }
  }

  private async structureByLlm(
    transcription: string,
    defaults: { system?: string; module?: string },
  ): Promise<KnowledgeItem> {
    const prompt = [
      "Voce e um normalizador tecnico para base de conhecimento.",
      "Converta a transcricao em JSON valido com as chaves:",
      "category, system, module, title, problem, symptoms, cause, solution, tables_related, tags.",
      "Use category=audio_case.",
      "Retorne apenas JSON sem markdown.",
      "",
      `Transcricao: ${transcription}`,
    ].join("\n");

    const response = await this.llm.generate(prompt, { temperature: 0.1 });
    const parsed = this.tryParseJson(response.response);

    return this.transformer.normalizeInput({
      category: "audio_case",
      system: defaults.system || String(parsed.system || "Nao informado"),
      module: defaults.module || String(parsed.module || "Nao informado"),
      title: String(parsed.title || "Caso derivado de audio"),
      problem: String(parsed.problem || transcription),
      symptoms: Array.isArray(parsed.symptoms) ? parsed.symptoms as string[] : [],
      cause: String(parsed.cause || ""),
      solution: String(parsed.solution || ""),
      tables_related: Array.isArray(parsed.tables_related) ? parsed.tables_related as string[] : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags as string[] : ["audio_case"],
    });
  }

  private async extractAudioTicketAndKnowledge(
    transcription: string,
    defaults: { system?: string; module?: string },
  ): Promise<ExtractedAudioPayload> {
    const prompt = [
      "Voce e um analista de suporte especialista em chamados MantisBT.",
      "Objetivo: gerar resumo tecnico de alta qualidade a partir de transcricao de audio.",
      "REGRAS OBRIGATORIAS:",
      "- Nao invente informacoes nao citadas na transcricao.",
      "- Se algo nao estiver claro, use 'Nao identificado na transcricao'.",
      "- Preserve codigos numericos e identificadores citados.",
      "- Linguagem objetiva, formal e sem girias.",
      "Retorne JSON valido com as chaves: mantis_summary, mantis_description, knowledge_item.",
      "knowledge_item deve conter exatamente:",
      "category, system, module, title, problem, symptoms, cause, solution, tables_related, tags.",
      "Use category='ticket' para atendimento operacional.",
      "mantis_summary: maximo 120 caracteres e focado no incidente.",
      "mantis_description: texto pronto para colar no Mantis com blocos curtos:",
      "Contexto, Evidencias, Causa provavel, Acao/Encaminhamento.",
      "Retorne somente JSON puro, sem markdown.",
      "",
      `Transcricao: ${transcription}`,
    ].join("\n");

    const response = await this.llm.generate(prompt, { temperature: 0.1 });
    const parsed = this.tryParseJson(response.response);
    const codeMatches = Array.from(new Set((String(transcription).match(/\b\d{3,}\b/g) || []).map((value) => value.trim())));

    const rawKnowledge = (parsed.knowledge_item || {}) as Record<string, unknown>;
    const knowledgeItem = this.transformer.normalizeInput({
      ...rawKnowledge,
      category: String(rawKnowledge.category || parsed.category || "ticket"),
      system: defaults.system || String(rawKnowledge.system || parsed.system || "Nao informado"),
      module: defaults.module || String(rawKnowledge.module || parsed.module || "Nao informado"),
      title: String(rawKnowledge.title || parsed.title || "Caso derivado de audio"),
      problem: String(rawKnowledge.problem || parsed.problem || transcription),
      symptoms: Array.isArray(rawKnowledge.symptoms) ? rawKnowledge.symptoms as string[] : (Array.isArray(parsed.symptoms) ? parsed.symptoms as string[] : []),
      cause: String(rawKnowledge.cause || parsed.cause || ""),
      solution: String(rawKnowledge.solution || parsed.solution || ""),
      tables_related: Array.isArray(rawKnowledge.tables_related)
        ? rawKnowledge.tables_related as string[]
        : (Array.isArray(parsed.tables_related) ? parsed.tables_related as string[] : []),
      tags: Array.isArray(rawKnowledge.tags)
        ? rawKnowledge.tags as string[]
        : (Array.isArray(parsed.tags) ? parsed.tags as string[] : ["ticket", "audio", ...codeMatches.map((code) => `codigo_${code}`)]),
    });

    const mantisSummary = this.safeLimit(String(parsed.mantis_summary || knowledgeItem.title || "Solicitacao derivada de audio"), 120);
    const mantisDescription = String(
      parsed.mantis_description ||
      [
        `Resumo: ${mantisSummary}`,
        "",
        "Contexto:",
        knowledgeItem.problem || "Nao identificado na transcricao",
        "",
        "Evidencias:",
        ...(knowledgeItem.symptoms.length
          ? knowledgeItem.symptoms.map((item) => `- ${item}`)
          : ["- Nao identificado na transcricao"]),
        "",
        `Causa provavel: ${knowledgeItem.cause || "Nao identificado na transcricao"}`,
        `Acao/encaminhamento: ${knowledgeItem.solution || "Nao identificado na transcricao"}`,
      ].join("\n")
    ).trim();

    return {
      mantis: {
        summary: mantisSummary,
        description: mantisDescription,
      },
      knowledge_item: knowledgeItem,
    };
  }

  private async normalizeTranscriptionText(transcription: string): Promise<string> {
    const prompt = [
      "Voce e um revisor de transcricao ASR.",
      "Reescreva o texto em portugues claro e correto.",
      "REGRAS:",
      "- Nao invente informacoes.",
      "- Preserve codigos, numeros, nomes proprios e termos tecnicos.",
      "- Se um trecho estiver incompreensivel, mantenha o trecho original.",
      "- Retorne somente o texto revisado, sem explicacoes.",
      "",
      `Transcricao bruta: ${transcription}`,
    ].join("\n");

    try {
      const response = await this.llm.generate(prompt, { temperature: 0.1 });
      const revised = String(response.response || "").trim();
      return revised || String(transcription).trim();
    } catch {
      return String(transcription).trim();
    }
  }

  private extractScrollPoints(data: unknown): Array<{ id: string | number; payload?: Record<string, unknown> }> {
    const result = (data as { result?: { points?: Array<{ id: string | number; payload?: Record<string, unknown> }> } | Array<{ id: string | number; payload?: Record<string, unknown> }> })?.result;
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.points)) return result.points;
    return [];
  }

  private tryParseJson(raw: string): Record<string, unknown> {
    try {
      const cleaned = String(raw)
        .trim()
        .replace(/^```json/, "")
        .replace(/^```/, "")
        .replace(/```$/, "")
        .trim();
      return JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private safeLimit(value: string, max: number): string {
    const text = String(value || "").trim();
    if (!text) return "";
    if (text.length <= max) return text;
    return `${text.slice(0, Math.max(0, max - 3)).trim()}...`;
  }
}
