export interface KnowledgeItemInput {
  category?: string;
  system?: string;
  module?: string;
  title?: string;
  problem?: string;
  symptoms?: string[] | string;
  cause?: string;
  solution?: string;
  tables_related?: string[] | string;
  tags?: string[] | string;
}

export interface KnowledgeItem {
  category: string;
  system: string;
  module: string;
  title: string;
  problem: string;
  symptoms: string[];
  cause: string;
  solution: string;
  tables_related: string[];
  tags: string[];
}

type ParsedSchemaTable = {
  table: string;
  columns?: Array<{ name: string; type: string }>;
  primaryKey?: string[];
  foreignKeys?: Array<{ field: string; referencedTable: string }>;
  check_constraints?: Array<{ expression?: string }>;
};

export class KnowledgeTransformer {
  private readonly maxSchemaColumns = Number(process.env.KNOWLEDGE_SCHEMA_MAX_COLUMNS || 28);
  private readonly maxSchemaRelations = Number(process.env.KNOWLEDGE_SCHEMA_MAX_RELATIONS || 10);

  normalizeInput(input: KnowledgeItemInput): KnowledgeItem {
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

  buildStandardText(item: KnowledgeItem): string {
    const symptoms = item.symptoms.length ? item.symptoms : ["Nao informado"];
    const tables = item.tables_related.length ? item.tables_related : ["Nao informado"];
    const tags = item.tags.length ? item.tags : ["Nao informado"];

    return [
      `Tipo: ${item.category}`,
      `Sistema: ${item.system || "Nao informado"}`,
      `Modulo: ${item.module || "Nao informado"}`,
      "",
      `Titulo: ${item.title || "Nao informado"}`,
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
      "Solucao:",
      item.solution || "Nao informado",
      "",
      "Tabelas Relacionadas:",
      ...tables.map((table) => `- ${table}`),
      "",
      "Tags:",
      ...tags.map((tag) => `- ${tag}`),
    ].join("\n");
  }

  tableToKnowledgeDocument(tableDef: ParsedSchemaTable, sourceName: string): KnowledgeItem {
    const fkTables = Array.from(new Set((tableDef.foreignKeys || []).map((fk) => fk.referencedTable)));
    const columns = Array.isArray(tableDef.columns) ? tableDef.columns : [];
    const limitedColumns = columns.slice(0, this.maxSchemaColumns);
    const extraColumns = Math.max(0, columns.length - limitedColumns.length);
    const fkList = Array.isArray(tableDef.foreignKeys) ? tableDef.foreignKeys : [];
    const limitedFks = fkList.slice(0, this.maxSchemaRelations);
    const extraFks = Math.max(0, fkList.length - limitedFks.length);
    const checkConstraints = Array.isArray(tableDef.check_constraints) ? tableDef.check_constraints : [];
    const topChecks = checkConstraints
      .slice(0, 8)
      .map((constraint) => (constraint?.expression ? constraint.expression : ""))
      .filter(Boolean);
    const checkLines = topChecks.map((expression) => `CHECK: ${expression}`);
    const checkSummary = topChecks.length
      ? `Checks: ${topChecks.join(" | ")}`
      : "Checks nao identificados.";

    return {
      category: "schema",
      system: sourceName || "database",
      module: "schema",
      title: `Estrutura da tabela ${tableDef.table}`,
      problem: `Documentacao tecnica da estrutura da tabela ${tableDef.table}.`,
      symptoms: [
        ...checkLines,
        ...limitedColumns.map((column) => `${column.name} (${column.type})`),
        ...(extraColumns > 0 ? [`... +${extraColumns} colunas omitidas para compactacao`] : []),
      ],
      cause: (tableDef.primaryKey || []).length
        ? `Chave primaria definida em: ${(tableDef.primaryKey || []).join(", ")}`
        : "Chave primaria nao identificada.",
      solution: fkList.length
        ? `Relacionamentos: ${limitedFks
            .map((fk) => `${fk.field} -> ${fk.referencedTable}`)
            .join("; ")}${extraFks > 0 ? `; ... +${extraFks} relacionamentos omitidos` : ""}. ${checkSummary}`
        : `Sem relacionamentos de chave estrangeira identificados. ${checkSummary}`,
      tables_related: fkTables,
      tags: ["schema", "ddl", tableDef.table],
    };
  }

  private safeArray(value: string[] | string | undefined): string[] {
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

  private safeText(value: string | undefined): string {
    if (typeof value !== "string") return "";
    return value.trim();
  }
}
