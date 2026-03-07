import { ParsedSchemaTable } from "./sqlParser";

export interface SchemaDocument {
  table_name: string;
  schema: string;
  document_type: "schema_overview" | "constraints" | "triggers" | "relationships";
  related_tables: string[];
  text: string;
}

export function transformDDLToDocuments(parsedDDL: { tables?: ParsedSchemaTable[] }): SchemaDocument[] {
  const tables = Array.isArray(parsedDDL?.tables) ? parsedDDL.tables : [];
  const documents: SchemaDocument[] = [];

  for (const table of tables) {
    const relatedTables = unique(
      (table.foreign_keys || []).map(
        (fk: ParsedSchemaTable["foreign_keys"][number]) => `${fk.references.schema}.${fk.references.table_name}`
      )
    );
    const mainColumns = (table.columns || [])
      .slice(0, 8)
      .map((column: ParsedSchemaTable["columns"][number]) => `${column.name} (${column.type})`);
    const purpose = inferPurpose(table.table_name);

    documents.push({
      table_name: table.table_name,
      schema: table.schema,
      document_type: "schema_overview",
      related_tables: relatedTables,
      text: [
        `Tabela: ${table.schema}.${table.table_name}`,
        `Finalidade inferida: ${purpose}`,
        `Primary Key: ${(table.primary_key || []).join(", ") || "Nao definida"}`,
        "Campos principais:",
        ...(mainColumns.length ? mainColumns.map((item: string) => `- ${item}`) : ["- Nao identificados"]),
        "Relacionamentos:",
        ...(relatedTables.length ? relatedTables.map((item: string) => `- ${item}`) : ["- Nao identificados"]),
      ].join("\n"),
    });

    documents.push({
      table_name: table.table_name,
      schema: table.schema,
      document_type: "constraints",
      related_tables: relatedTables,
      text: [
        `Tabela: ${table.schema}.${table.table_name}`,
        "CHECK constraints e validacoes:",
        ...(table.check_constraints || []).length
          ? table.check_constraints.map(
              (item: ParsedSchemaTable["check_constraints"][number]) => `- ${item.name || "CHECK"}: ${item.expression}`
            )
          : ["- Nenhuma CHECK constraint detectada"],
      ].join("\n"),
    });

    if ((table.triggers || []).length) {
      for (const trigger of table.triggers) {
        const impactedTables = extractImpactedTables(trigger.body, table.table_name);
        documents.push({
          table_name: table.table_name,
          schema: table.schema,
          document_type: "triggers",
          related_tables: unique(relatedTables.concat(impactedTables)),
          text: [
            `Trigger: ${trigger.name}`,
            `Tabela alvo: ${table.schema}.${table.table_name}`,
            `Quando executa: ${trigger.timing}`,
            `Evento: ${trigger.event}`,
            "Tabelas impactadas:",
            ...(impactedTables.length ? impactedTables.map((item: string) => `- ${item}`) : ["- Nao identificadas"]),
            "Regras principais resumidas:",
            summarizeTrigger(trigger.body),
          ].join("\n"),
        });
      }
    } else {
      documents.push({
        table_name: table.table_name,
        schema: table.schema,
        document_type: "triggers",
        related_tables: relatedTables,
        text: [
          `Tabela: ${table.schema}.${table.table_name}`,
          "Triggers:",
          "- Nenhuma trigger encontrada para esta tabela.",
        ].join("\n"),
      });
    }

    documents.push({
      table_name: table.table_name,
      schema: table.schema,
      document_type: "relationships",
      related_tables: relatedTables,
      text: [
        `Tabela: ${table.schema}.${table.table_name}`,
        "Relacoes de chave estrangeira:",
        ...(table.foreign_keys || []).length
          ? table.foreign_keys.map(
              (fk: ParsedSchemaTable["foreign_keys"][number]) =>
                `- (${fk.columns.join(", ")}) -> ${fk.references.schema}.${fk.references.table_name} (${fk.references.columns.join(", ")})`
            )
          : ["- Nenhuma FK detectada"],
      ].join("\n"),
    });
  }

  return documents;
}

function inferPurpose(tableName: string): string {
  const name = String(tableName || "").toLowerCase();
  if (name.includes("log") || name.includes("audit")) return "Registro historico e trilha de auditoria";
  if (name.includes("item") || name.includes("detail")) return "Detalhamento de entidades principais";
  if (name.includes("user") || name.includes("cliente") || name.includes("customer")) return "Cadastro de atores do sistema";
  if (name.includes("order") || name.includes("pedido")) return "Gestao de pedidos/transacoes";
  if (name.includes("cfg") || name.includes("config")) return "Tabela de configuracao de regras";
  return "Persistencia de dados operacionais da aplicacao";
}

function extractImpactedTables(triggerBody: string, currentTableName: string): string[] {
  const body = String(triggerBody || "");
  const regex = /\b(into|update|from|join)\s+("?[\w$#]+"?(?:\."?[\w$#]+"?)?)/gi;
  const tables: string[] = [];
  let match = regex.exec(body);

  while (match) {
    const raw = cleanupIdentifier(match[2]);
    const tableOnly = raw.split(".").pop();
    if (tableOnly && tableOnly.toUpperCase() !== String(currentTableName || "").toUpperCase()) {
      tables.push(raw);
    }
    match = regex.exec(body);
  }

  return unique(tables);
}

function summarizeTrigger(triggerBody: string): string {
  const compact = String(triggerBody || "").replace(/\s+/g, " ").trim();
  if (!compact) return "- Corpo nao disponivel.";
  const summary = compact.slice(0, 520);
  return `- ${summary}${compact.length > 520 ? "..." : ""}`;
}

function cleanupIdentifier(value: string): string {
  return String(value || "").replace(/"/g, "").replace(/\s+/g, "").trim();
}

function unique(list: string[]): string[] {
  return Array.from(new Set((list || []).filter(Boolean)));
}
