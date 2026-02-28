function parseDDL(sqlText) {
  const source = String(sqlText || "");
  const tableBlocks = extractCreateTableBlocks(source);
  const tables = tableBlocks.map(parseCreateTableBlock);
  const tableMap = new Map(tables.map((table) => [table.full_name.toUpperCase(), table]));

  attachAlterTableConstraints(source, tableMap);
  attachIndexes(source, tableMap);
  attachTriggers(source, tableMap);
  attachColumnComments(source, tableMap);

  return {
    tables: Array.from(tableMap.values()),
  };
}

function extractCreateTableBlocks(sqlText) {
  const blocks = [];
  const regex = /create\s+table\s+/gi;
  let match = regex.exec(sqlText);

  while (match) {
    const start = match.index;
    const openParen = sqlText.indexOf("(", regex.lastIndex);
    if (openParen < 0) break;

    let depth = 0;
    let closeParen = -1;
    for (let i = openParen; i < sqlText.length; i += 1) {
      const char = sqlText[i];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (depth === 0) {
        closeParen = i;
        break;
      }
    }
    if (closeParen < 0) break;

    const semicolon = sqlText.indexOf(";", closeParen);
    const end = semicolon > -1 ? semicolon + 1 : closeParen + 1;
    blocks.push(sqlText.slice(start, end));
    regex.lastIndex = end;
    match = regex.exec(sqlText);
  }

  return blocks;
}

function parseCreateTableBlock(block) {
  const headerMatch = block.match(/create\s+table\s+([^\s(]+)/i);
  const fullNameRaw = cleanupIdentifier(headerMatch ? headerMatch[1] : "UNKNOWN.UNKNOWN");
  const { schema, table } = splitSchemaAndTable(fullNameRaw);

  const contentStart = block.indexOf("(");
  const contentEnd = block.lastIndexOf(")");
  const inside = contentStart >= 0 && contentEnd > contentStart ? block.slice(contentStart + 1, contentEnd) : "";
  const definitions = splitTopLevelByComma(inside);

  const columns = [];
  const primaryKey = [];
  const foreignKeys = [];
  const checkConstraints = [];

  for (const rawDef of definitions) {
    const definition = rawDef.trim();
    if (!definition) continue;

    if (/^(constraint\s+\S+\s+)?primary\s+key/i.test(definition)) {
      primaryKey.push(...extractColumnsFromConstraint(definition));
      continue;
    }

    if (/^(constraint\s+\S+\s+)?foreign\s+key/i.test(definition)) {
      const fk = parseForeignKeyDefinition(definition);
      if (fk) foreignKeys.push(fk);
      continue;
    }

    if (/^(constraint\s+\S+\s+)?check\s*\(/i.test(definition)) {
      checkConstraints.push(parseCheckConstraint(definition));
      continue;
    }

    const parsedColumn = parseColumnDefinition(definition);
    if (parsedColumn) {
      columns.push(parsedColumn);
      if (/primary\s+key/i.test(definition)) {
        primaryKey.push(parsedColumn.name);
      }
      if (/references\s+/i.test(definition)) {
        const fk = parseInlineForeignKey(definition, parsedColumn.name);
        if (fk) foreignKeys.push(fk);
      }
      if (/check\s*\(/i.test(definition)) {
        const check = parseCheckConstraint(definition);
        if (check.expression) checkConstraints.push(check);
      }
    }
  }

  return {
    schema,
    table_name: table,
    full_name: `${schema}.${table}`,
    columns,
    primary_key: unique(primaryKey),
    foreign_keys: foreignKeys,
    indexes: [],
    triggers: [],
    check_constraints: checkConstraints,
    comments_on_columns: {},
  };
}

function parseColumnDefinition(definition) {
  const match = definition.match(/^("?[\w$#]+"?)\s+(.+)$/i);
  if (!match) return null;

  const name = cleanupIdentifier(match[1]);
  const rest = match[2];
  const typeMatch = rest.match(/^([A-Z][A-Z0-9_]*(?:\s*\([^)]*\))?)/i);
  const dataType = typeMatch ? typeMatch[1].trim() : "UNKNOWN";
  const defaultMatch = rest.match(/\bdefault\b\s+(.+?)(?=\bnot\s+null\b|\bconstraint\b|\breferences\b|\bcheck\b|$)/i);

  return {
    name,
    type: dataType,
    default: defaultMatch ? defaultMatch[1].trim() : null,
    not_null: /\bnot\s+null\b/i.test(rest),
  };
}

function parseForeignKeyDefinition(definition) {
  const localColumns = extractColumnsFromConstraint(definition);
  const refMatch = definition.match(/\breferences\s+([^\s(]+)\s*\(([^)]+)\)/i);
  if (!refMatch) return null;

  const refFull = cleanupIdentifier(refMatch[1]);
  const { schema, table } = splitSchemaAndTable(refFull);

  return {
    columns: localColumns,
    references: {
      schema,
      table_name: table,
      columns: refMatch[2].split(",").map((part) => cleanupIdentifier(part.trim())),
    },
  };
}

function parseInlineForeignKey(definition, columnName) {
  const refMatch = definition.match(/\breferences\s+([^\s(]+)\s*\(([^)]+)\)/i);
  if (!refMatch) return null;
  const refFull = cleanupIdentifier(refMatch[1]);
  const { schema, table } = splitSchemaAndTable(refFull);
  return {
    columns: [columnName],
    references: {
      schema,
      table_name: table,
      columns: refMatch[2].split(",").map((part) => cleanupIdentifier(part.trim())),
    },
  };
}

function parseCheckConstraint(definition) {
  const expressionMatch = definition.match(/\bcheck\s*\(([\s\S]+)\)\s*$/i);
  const nameMatch = definition.match(/^constraint\s+("?[\w$#]+"?)/i);
  return {
    name: nameMatch ? cleanupIdentifier(nameMatch[1]) : null,
    expression: expressionMatch ? expressionMatch[1].trim() : definition.trim(),
  };
}

function attachAlterTableConstraints(sqlText, tableMap) {
  const regex = /alter\s+table\s+([^\s]+)\s+add\s+([\s\S]*?);/gi;
  let match = regex.exec(sqlText);

  while (match) {
    const fullName = cleanupIdentifier(match[1]);
    const table = findTable(tableMap, fullName);
    if (!table) {
      match = regex.exec(sqlText);
      continue;
    }

    const clause = match[2].trim();
    if (/primary\s+key/i.test(clause)) {
      table.primary_key = unique(table.primary_key.concat(extractColumnsFromConstraint(clause)));
    }
    if (/foreign\s+key/i.test(clause)) {
      const fk = parseForeignKeyDefinition(clause);
      if (fk) table.foreign_keys.push(fk);
    }
    if (/check\s*\(/i.test(clause)) {
      table.check_constraints.push(parseCheckConstraint(clause));
    }

    match = regex.exec(sqlText);
  }
}

function attachIndexes(sqlText, tableMap) {
  const regex = /create\s+(unique\s+)?index\s+("?[\w$#]+"?)\s+on\s+([^\s(]+)\s*\(([^)]+)\)\s*;/gi;
  let match = regex.exec(sqlText);

  while (match) {
    const isUnique = Boolean(match[1]);
    const indexName = cleanupIdentifier(match[2]);
    const fullName = cleanupIdentifier(match[3]);
    const table = findTable(tableMap, fullName);
    if (table) {
      table.indexes.push({
        name: indexName,
        unique: isUnique,
        columns: match[4].split(",").map((item) => cleanupIdentifier(item.trim())),
      });
    }
    match = regex.exec(sqlText);
  }
}

function attachTriggers(sqlText, tableMap) {
  const blocks = sqlText.match(/create(?:\s+or\s+replace)?\s+trigger[\s\S]*?end\s*;\/?/gi) || [];
  for (const block of blocks) {
    const header = block.match(
      /create(?:\s+or\s+replace)?\s+trigger\s+("?[\w$#]+"?)\s+(before|after|instead\s+of)\s+([\w\s,]+?)\s+on\s+([^\s]+)\s/i
    );
    if (!header) continue;

    const triggerName = cleanupIdentifier(header[1]);
    const timing = header[2].replace(/\s+/g, " ").toUpperCase();
    const event = header[3].replace(/\s+/g, " ").trim().toUpperCase();
    const fullName = cleanupIdentifier(header[4]);
    const table = findTable(tableMap, fullName);
    if (!table) continue;

    table.triggers.push({
      name: triggerName,
      timing,
      event,
      body: block.trim(),
    });
  }
}

function attachColumnComments(sqlText, tableMap) {
  const regex = /comment\s+on\s+column\s+([^\s]+)\.([^\s]+)\s+is\s+'([^']*)'\s*;/gi;
  let match = regex.exec(sqlText);

  while (match) {
    const tableFullName = cleanupIdentifier(match[1]);
    const column = cleanupIdentifier(match[2]);
    const comment = match[3].trim();
    const table = findTable(tableMap, tableFullName);
    if (table) {
      table.comments_on_columns[column] = comment;
    }
    match = regex.exec(sqlText);
  }
}

function splitTopLevelByComma(text) {
  const parts = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'" && text[i - 1] !== "\\") inSingleQuote = !inSingleQuote;
    if (!inSingleQuote) {
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) {
        parts.push(current);
        current = "";
        continue;
      }
    }
    current += char;
  }

  if (current.trim()) parts.push(current);
  return parts;
}

function extractColumnsFromConstraint(definition) {
  const match = definition.match(/\(([^)]+)\)/);
  if (!match) return [];
  return match[1].split(",").map((part) => cleanupIdentifier(part.trim()));
}

function splitSchemaAndTable(fullName) {
  const cleaned = cleanupIdentifier(fullName);
  const parts = cleaned.split(".");
  if (parts.length === 1) {
    return { schema: "PUBLIC", table: parts[0] };
  }
  return { schema: parts[0], table: parts[1] };
}

function cleanupIdentifier(value) {
  return String(value || "")
    .replace(/"/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function findTable(tableMap, tableFullName) {
  const cleaned = cleanupIdentifier(tableFullName).toUpperCase();
  if (tableMap.has(cleaned)) return tableMap.get(cleaned);

  const tableOnly = cleaned.split(".").pop();
  for (const [key, value] of tableMap.entries()) {
    if (key.endsWith(`.${tableOnly}`)) return value;
  }
  return null;
}

function unique(list) {
  return Array.from(new Set((list || []).filter(Boolean)));
}

module.exports = {
  parseDDL,
};

