const ALLOWED_CATEGORIES = ["documentation", "schema", "audio_case", "ticket", "business_rule"];

class KnowledgeValidator {
  validateManualInput(payload) {
    const errors = [];
    const data = payload || {};

    if (!ALLOWED_CATEGORIES.includes(data.category)) {
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

  isNonEmpty(value) {
    return typeof value === "string" && value.trim().length > 0;
  }
}

module.exports = { KnowledgeValidator, ALLOWED_CATEGORIES };

