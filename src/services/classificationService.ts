import { LlmPort } from "../types";

const LABELS = ["billing", "technical", "logistics", "general"] as const;
type Label = (typeof LABELS)[number];

const KEYWORDS: Record<Label, string[]> = {
  billing: ["fatura", "boleto", "pagamento", "cobranca", "invoice"],
  technical: ["erro", "bug", "falha", "stack", "api", "timeout"],
  logistics: ["entrega", "atraso", "transporte", "coleta", "frete"],
  general: [],
};

export interface ClassificationResult {
  label: Label;
  confidence: number;
  rationale: string;
}

export class ClassificationService {
  constructor(private readonly llm: LlmPort) {}

  classifyByRules(text: string): ClassificationResult {
    const normalized = text.toLowerCase();
    const scores: Record<Label, number> = {
      billing: 0,
      technical: 0,
      logistics: 0,
      general: 0,
    };

    (Object.keys(KEYWORDS) as Label[]).forEach((label) => {
      const keywords = KEYWORDS[label];
      scores[label] = keywords.reduce((sum, token) => sum + (normalized.includes(token) ? 1 : 0), 0);
    });

    const top = (Object.entries(scores).sort((a, b) => b[1] - a[1])[0] ?? ["general", 0]) as [Label, number];
    const label = top[1] === 0 ? "general" : top[0];
    const confidence = Math.min(0.95, top[1] === 0 ? 0.45 : 0.55 + top[1] * 0.12);

    return {
      label,
      confidence,
      rationale: `Classificacao por palavras-chave: ${label}`,
    };
  }

  async classify(text: string, mode: "rules" | "llm" = "rules"): Promise<ClassificationResult> {
    if (mode === "rules") {
      return this.classifyByRules(text);
    }

    const prompt = [
      "Classifique o texto em uma categoria: billing, technical, logistics ou general.",
      "Responda apenas em JSON com as chaves label, confidence, rationale.",
      `Texto: ${text}`,
    ].join("\n");

    const raw = await this.llm.generate(prompt, { temperature: 0.1 });
    const parsed = this.tryParse(raw);
    return parsed ?? this.classifyByRules(text);
  }

  private tryParse(raw: string): ClassificationResult | null {
    try {
      // Aceita resposta crua ou encapsulada em bloco markdown.
      const sanitized = raw.trim().replace(/^```json/, "").replace(/```$/, "").trim();
      const data = JSON.parse(sanitized) as Partial<ClassificationResult>;
      if (!data.label || !LABELS.includes(data.label)) return null;

      return {
        label: data.label,
        confidence: typeof data.confidence === "number" ? data.confidence : 0.6,
        rationale: data.rationale ?? "Classificacao pelo modelo",
      };
    } catch {
      return null;
    }
  }
}
