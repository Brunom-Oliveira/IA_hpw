import { singleton } from "tsyringe";
import { QueryAnalysis } from "../../types";

const STOP_WORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "qual", "quais", "que", "se", "uma", "um",
]);

const MIN_WORDS_FOR_EXPANSION = 3;

@singleton()
export class QueryAnalysisService {
  public analyze(question: string): QueryAnalysis {
    let expandedQuestion: string | undefined;
    const wordCount = question.trim().split(/\s+/).length;

    if (wordCount <= MIN_WORDS_FOR_EXPANSION) {
      expandedQuestion = `Qual o procedimento ou significado de: ${question}?`;
    }

    const questionToAnalyze = expandedQuestion || question;
    const normalizedQuestion = this.normalizeText(questionToAnalyze);
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
      originalQuestion: question,
      expandedQuestion,
      normalizedQuestion,
    };
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

  private normalizeText(text: string): string {
    return String(text || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s_]/g, "")
      .toLowerCase();
  }
}
