class SchemaTransformer {
  toSemanticText(tableDef) {
    const lines = [];
    lines.push(`Tabela: ${tableDef.table}`);
    lines.push("");
    lines.push("Campos:");

    if (!tableDef.columns || tableDef.columns.length === 0) {
      lines.push("- Nao identificados");
    } else {
      for (const col of tableDef.columns) {
        lines.push(`- ${col.name} (${col.type})`);
      }
    }

    lines.push("");
    lines.push("Chave primária:");
    if (!tableDef.primaryKey || tableDef.primaryKey.length === 0) {
      lines.push("- Nao identificada");
    } else {
      for (const pk of tableDef.primaryKey) {
        lines.push(`- ${pk}`);
      }
    }

    lines.push("");
    lines.push("Relacionamentos:");
    if (!tableDef.foreignKeys || tableDef.foreignKeys.length === 0) {
      lines.push("- Nao possui chaves estrangeiras identificadas");
    } else {
      for (const fk of tableDef.foreignKeys) {
        lines.push(`- Possui chave estrangeira para ${fk.referencedTable} através do campo ${fk.field}`);
      }
    }

    return lines.join("\n");
  }
}

module.exports = { SchemaTransformer };

