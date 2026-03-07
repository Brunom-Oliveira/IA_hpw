export const ALLOWED_KNOWLEDGE_CATEGORIES = [
  "documentation",
  "schema",
  "audio_case",
  "ticket",
  "business_rule",
] as const;

export class KnowledgeValidator {
  validateManualInput(payload: Record<string, unknown>) {
    const errors: string[] = [];
    const data = payload || {};

    if (!ALLOWED_KNOWLEDGE_CATEGORIES.includes(String(data.category || "") as (typeof ALLOWED_KNOWLEDGE_CATEGORIES)[number])) {
      errors.push("category invalida");
    }
    if (!this.isNonEmpty(data.system)) {
      errors.push("system obrigatorio");
    }
    if (!this.isNonEmpty(data.module)) {
      errors.push("module obrigatorio");
    }
    if (!this.isNonEmpty(data.title)) {
      errors.push("title obrigatorio");
    }
    if (!this.isNonEmpty(data.problem) && !this.isNonEmpty(data.cause) && !this.isNonEmpty(data.solution)) {
      errors.push("Informe ao menos um campo entre problem, cause e solution");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private isNonEmpty(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }
}
