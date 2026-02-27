class KnowledgeTransformer {
  normalizeInput(input) {
    const source = input || {};
    return {
      category: source.category || "documentation",
      system: this.safeText(source.system),
      module: this.safeText(source.module),
      title: this.safeText(source.title),
      problem: this.safeText(source.problem),
      symptoms: this.safeArray(source.symptoms),
      cause: this.safeText(source.cause),
      solution: this.safeText(source.solution),
      tables_related: this.safeArray(source.tables_related),
      tags: this.safeArray(source.tags),
    };
  }

  buildStandardText(item) {
    const symptoms = item.symptoms.length ? item.symptoms : ["Nao informado"];
    const tables = item.tables_related.length ? item.tables_related : ["Nao informado"];
    const tags = item.tags.length ? item.tags : ["Nao informado"];

    return [
      `Tipo: ${item.category}`,
      `Sistema: ${item.system || "Nao informado"}`,
      `Módulo: ${item.module || "Nao informado"}`,
      "",
      `Título: ${item.title || "Nao informado"}`,
      "",
      "Problema:",
      item.problem || "Nao informado",
      "",
      "Sintomas:",
      ...symptoms.map((symptom) => `- ${symptom}`),
      "",
      "Causa:",
      item.cause || "Nao informado",
      "",
      "Solução:",
      item.solution || "Nao informado",
      "",
      "Tabelas Relacionadas:",
      ...tables.map((table) => `- ${table}`),
      "",
      "Tags:",
      ...tags.map((tag) => `- ${tag}`),
    ].join("\n");
  }

  tableToKnowledgeDocument(tableDef, sourceName) {
    const fkTables = Array.from(new Set((tableDef.foreignKeys || []).map((fk) => fk.referencedTable)));

    return {
      category: "schema",
      system: sourceName || "database",
      module: "schema",
      title: `Estrutura da tabela ${tableDef.table}`,
      problem: `Documentacao tecnica da estrutura da tabela ${tableDef.table}.`,
      symptoms: (tableDef.columns || []).map((column) => `${column.name} (${column.type})`),
      cause: (tableDef.primaryKey || []).length
        ? `Chave primaria definida em: ${(tableDef.primaryKey || []).join(", ")}`
        : "Chave primaria nao identificada.",
      solution: (tableDef.foreignKeys || []).length
        ? `Relacionamentos: ${(tableDef.foreignKeys || [])
            .map((fk) => `${fk.field} -> ${fk.referencedTable}`)
            .join("; ")}`
        : "Sem relacionamentos de chave estrangeira identificados.",
      tables_related: fkTables,
      tags: ["schema", "ddl", tableDef.table],
    };
  }

  safeArray(value) {
    if (Array.isArray(value)) {
      return value.map((item) => this.safeText(item)).filter(Boolean);
    }
    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => this.safeText(item))
        .filter(Boolean);
    }
    return [];
  }

  safeText(value) {
    if (typeof value !== "string") return "";
    return value.trim();
  }
}

module.exports = { KnowledgeTransformer };

