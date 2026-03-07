import { Parser } from "node-sql-parser";

export interface ParsedConstraintReference {
  schema: string;
  table_name: string;
  columns: string[];
}

export interface ParsedSchemaForeignKey {
  columns: string[];
  references: ParsedConstraintReference;
}

export interface ParsedSchemaColumn {
  name: string;
  type: string;
  default: string | null;
  not_null: boolean;
}

export interface ParsedSchemaCheckConstraint {
  name: string | null;
  expression: string;
}

export interface ParsedSchemaTrigger {
  name: string;
  timing: string;
  event: string;
  body: string;
}

export interface ParsedSchemaIndex {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface ParsedSchemaTable {
  schema: string;
  table_name: string;
  full_name: string;
  columns: ParsedSchemaColumn[];
  primary_key: string[];
  foreign_keys: ParsedSchemaForeignKey[];
  indexes: ParsedSchemaIndex[];
  triggers: ParsedSchemaTrigger[];
  check_constraints: ParsedSchemaCheckConstraint[];
  comments_on_columns: Record<string, string>;
}

type GenericNode = Record<string, any>;

export class SchemaParser {
  private readonly parser = new Parser();

  parseSql(sqlText: string): Array<{
    table: string;
    columns: Array<{ name: string; type: string }>;
    primaryKey: string[];
    foreignKeys: Array<{ field: string; referencedTable: string }>;
  }> {
    let ast: GenericNode | GenericNode[];
    try {
      ast = this.parser.astify(sqlText, { database: "MySQL" }) as GenericNode | GenericNode[];
    } catch (error: any) {
      console.error("[schema][parser] Falha ao fazer parse SQL:", error?.message);
      throw new Error("Arquivo SQL invalido para parser");
    }

    const statements = Array.isArray(ast) ? ast : [ast];
    const createTables = statements.filter((stmt) => this.isCreateTable(stmt));
    return createTables.map((stmt) => this.extractTable(stmt));
  }

  private isCreateTable(stmt: GenericNode): boolean {
    if (!stmt || stmt.type !== "create") return false;
    return String(stmt.keyword || "").toLowerCase() === "table";
  }

  private extractTable(stmt: GenericNode) {
    const tableName = this.getTableName(stmt.table);
    const defs = Array.isArray(stmt.create_definitions) ? stmt.create_definitions : [];

    const columns = defs
      .filter((def) => String(def.resource || "").toLowerCase() === "column")
      .map((def) => ({
        name: this.getColumnName(def.column),
        type: this.getColumnType(def.definition),
      }))
      .filter((col) => col.name);

    const primaryKey: string[] = [];
    const foreignKeys: Array<{ field: string; referencedTable: string }> = [];

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

  private getTableName(tableNode: any): string {
    if (!tableNode) return "UNKNOWN_TABLE";
    if (typeof tableNode === "string") return tableNode;
    if (Array.isArray(tableNode) && tableNode[0]) {
      return tableNode[0].table || tableNode[0].tableName || "UNKNOWN_TABLE";
    }
    return tableNode.table || tableNode.tableName || "UNKNOWN_TABLE";
  }

  private getColumnName(columnNode: any): string {
    if (!columnNode) return "";
    if (typeof columnNode === "string") return columnNode;
    return columnNode.column || columnNode.name || "";
  }

  private getColumnType(definitionNode: any): string {
    if (!definitionNode) return "UNKNOWN";

    if (typeof definitionNode.dataType === "string") {
      const len = Array.isArray(definitionNode.length) && definitionNode.length.length > 0
        ? `(${definitionNode.length.map((x: any) => x.value || x).join(",")})`
        : "";
      return `${definitionNode.dataType}${len}`;
    }

    if (typeof definitionNode.dataType === "object" && definitionNode.dataType !== null) {
      return definitionNode.dataType.value || "UNKNOWN";
    }

    return definitionNode.type || "UNKNOWN";
  }

  private extractConstraintColumns(definition: GenericNode): string[] {
    const candidates: any[] = [];

    if (Array.isArray(definition.definition)) candidates.push(...definition.definition);
    if (Array.isArray(definition.columns)) candidates.push(...definition.columns);
    if (Array.isArray(definition.local_key)) candidates.push(...definition.local_key);

    return candidates
      .map((item) => (typeof item === "string" ? item : item.column || item.value || ""))
      .filter(Boolean);
  }

  private getReferencedTable(referenceDefinition: GenericNode | undefined): string {
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
