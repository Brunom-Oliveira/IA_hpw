export interface ParsedSchemaColumn {
  name: string;
  type: string;
}

export interface ParsedSchemaForeignKey {
  field: string;
  referencedTable: string;
}

export interface ParsedSchemaTable {
  table: string;
  columns?: ParsedSchemaColumn[];
  primaryKey?: string[];
  foreignKeys?: ParsedSchemaForeignKey[];
}

export class SchemaTransformer {
  toSemanticText(tableDef: ParsedSchemaTable): string {
    const lines: string[] = [];
    lines.push(`Tabela: ${tableDef.table}`);
    lines.push("");
    lines.push("Campos:");

    if (!tableDef.columns?.length) {
      lines.push("- Nao identificados");
    } else {
      for (const col of tableDef.columns) {
        lines.push(`- ${col.name} (${col.type})`);
      }
    }

    lines.push("");
    lines.push("Chave primaria:");
    if (!tableDef.primaryKey?.length) {
      lines.push("- Nao identificada");
    } else {
      for (const pk of tableDef.primaryKey) {
        lines.push(`- ${pk}`);
      }
    }

    lines.push("");
    lines.push("Relacionamentos:");
    if (!tableDef.foreignKeys?.length) {
      lines.push("- Nao possui chaves estrangeiras identificadas");
    } else {
      for (const fk of tableDef.foreignKeys) {
        lines.push(`- Possui chave estrangeira para ${fk.referencedTable} atraves do campo ${fk.field}`);
      }
    }

    return lines.join("\n");
  }
}
