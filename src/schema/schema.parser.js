const { Parser } = require("node-sql-parser");

class SchemaParser {
  constructor() {
    this.parser = new Parser();
  }

  parseSql(sqlText) {
    let ast;
    try {
      ast = this.parser.astify(sqlText, { database: "MySQL" });
    } catch (error) {
      console.error("[schema][parser] Falha ao fazer parse SQL:", error.message);
      throw new Error("Arquivo SQL invalido para parser");
    }

    const statements = Array.isArray(ast) ? ast : [ast];
    const createTables = statements.filter((stmt) => this.isCreateTable(stmt));
    return createTables.map((stmt) => this.extractTable(stmt));
  }

  isCreateTable(stmt) {
    if (!stmt || stmt.type !== "create") return false;
    return String(stmt.keyword || "").toLowerCase() === "table";
  }

  extractTable(stmt) {
    const tableName = this.getTableName(stmt.table);
    const defs = Array.isArray(stmt.create_definitions) ? stmt.create_definitions : [];

    const columns = defs
      .filter((def) => String(def.resource || "").toLowerCase() === "column")
      .map((def) => ({
        name: this.getColumnName(def.column),
        type: this.getColumnType(def.definition),
      }))
      .filter((col) => col.name);

    const primaryKey = [];
    const foreignKeys = [];

    for (const def of defs) {
      const resource = String(def.resource || "").toLowerCase();
      if (resource !== "constraint") continue;

      const type = String(def.constraint_type || "").toLowerCase();
      if (type.includes("primary")) {
        primaryKey.push(...this.extractConstraintColumns(def));
      }

      if (type.includes("foreign")) {
        const localColumns = this.extractConstraintColumns(def);
        const referencedTable = this.getReferencedTable(def.reference_definition);
        for (const localColumn of localColumns) {
          foreignKeys.push({
            field: localColumn,
            referencedTable: referencedTable || "DESCONHECIDA",
          });
        }
      }
    }

    return {
      table: tableName,
      columns,
      primaryKey: Array.from(new Set(primaryKey)),
      foreignKeys,
    };
  }

  getTableName(tableNode) {
    if (!tableNode) return "UNKNOWN_TABLE";
    if (typeof tableNode === "string") return tableNode;
    if (Array.isArray(tableNode) && tableNode[0]) {
      return tableNode[0].table || tableNode[0].tableName || "UNKNOWN_TABLE";
    }
    return tableNode.table || tableNode.tableName || "UNKNOWN_TABLE";
  }

  getColumnName(columnNode) {
    if (!columnNode) return "";
    if (typeof columnNode === "string") return columnNode;
    return columnNode.column || columnNode.name || "";
  }

  getColumnType(definitionNode) {
    if (!definitionNode) return "UNKNOWN";

    if (typeof definitionNode.dataType === "string") {
      const len = Array.isArray(definitionNode.length) && definitionNode.length.length > 0
        ? `(${definitionNode.length.map((x) => x.value || x).join(",")})`
        : "";
      return `${definitionNode.dataType}${len}`;
    }

    if (typeof definitionNode.dataType === "object" && definitionNode.dataType !== null) {
      return definitionNode.dataType.value || "UNKNOWN";
    }

    return definitionNode.type || "UNKNOWN";
  }

  extractConstraintColumns(definition) {
    const candidates = [];

    if (Array.isArray(definition.definition)) {
      candidates.push(...definition.definition);
    }
    if (Array.isArray(definition.columns)) {
      candidates.push(...definition.columns);
    }
    if (Array.isArray(definition.local_key)) {
      candidates.push(...definition.local_key);
    }

    return candidates
      .map((item) => {
        if (typeof item === "string") return item;
        return item.column || item.value || "";
      })
      .filter(Boolean);
  }

  getReferencedTable(referenceDefinition) {
    if (!referenceDefinition) return "";
    if (typeof referenceDefinition.table === "string") return referenceDefinition.table;
    if (Array.isArray(referenceDefinition.table) && referenceDefinition.table[0]) {
      return referenceDefinition.table[0].table || referenceDefinition.table[0].tableName || "";
    }
    if (referenceDefinition.table && typeof referenceDefinition.table === "object") {
      return referenceDefinition.table.table || referenceDefinition.table.tableName || "";
    }
    return "";
  }
}

module.exports = { SchemaParser };

