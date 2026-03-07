type PrimitiveMetadata = Record<string, string | number | boolean>;

type BaseMetadataInput = {
  category: string;
  title: string;
  source: string;
  system?: string;
  module?: string;
  fileName?: string;
  chunk?: number;
  totalChunks?: number;
  text?: string;
  tableName?: string;
  relatedTables?: string[];
  tags?: string[];
  section?: string;
  documentType?: string;
};

const SECTION_PATTERNS = [
  /^#+\s+(.+)$/m,
  /^(Problema|Sintomas|Causa|Solucao|Tabelas Relacionadas|Tags)\s*:/im,
  /^(Contexto|Evidencias|Acao|Encaminhamento)\s*:/im,
];

export function buildRagMetadata(input: BaseMetadataInput): PrimitiveMetadata {
  const title = String(input.title || "").trim();
  const source = String(input.source || "").trim();
  const category = String(input.category || "general").trim();
  const system = String(input.system || "Nao informado").trim();
  const module = String(input.module || "Nao informado").trim();
  const fileName = String(input.fileName || source || title).trim();
  const text = String(input.text || "").trim();
  const explicitTableName = String(input.tableName || "").trim().toUpperCase();
  const extractedTableName = explicitTableName || extractPrimaryTableName([title, source, fileName, text].join("\n"));
  const section = String(input.section || inferSection(text) || "").trim();
  const documentType = String(input.documentType || inferDocumentType({ category, title, source, module, text })).trim();
  const relatedTables = normalizeTableList(input.relatedTables);
  const tags = normalizeStringList(input.tags);

  const metadata: PrimitiveMetadata = {
    source,
    title,
    category,
    system,
    module,
    file_name: fileName,
    document_type: documentType,
  };

  if (typeof input.chunk === "number") metadata.chunk = input.chunk;
  if (typeof input.totalChunks === "number") metadata.total_chunks = input.totalChunks;
  if (section) metadata.section = section;
  if (extractedTableName) metadata.table_name = extractedTableName;

  const tableSuffix = extractTableSuffix(extractedTableName);
  if (tableSuffix) metadata.table_suffix = tableSuffix;

  if (relatedTables.length) metadata.related_tables_csv = relatedTables.join(",");
  if (tags.length) metadata.tags_csv = tags.join(",");

  return metadata;
}

export function extractPrimaryTableName(text: string): string {
  const normalized = String(text || "").toUpperCase();
  const matches = normalized.match(/\b([A-Z][A-Z0-9_]*_\d{2,4})\b/g) || [];
  return matches[0] || "";
}

export function extractTableSuffix(tableName: string): string {
  const match = String(tableName || "").match(/_(\d{2,4})$/);
  return match ? match[1] : "";
}

export function inferSection(text: string): string {
  const source = String(text || "");
  for (const pattern of SECTION_PATTERNS) {
    const match = source.match(pattern);
    if (match?.[1]) return String(match[1]).trim();
    if (match?.[0]) return String(match[0]).replace(/[:#]/g, "").trim();
  }
  return "";
}

function inferDocumentType(input: { category: string; title: string; source: string; module: string; text: string }): string {
  const haystack = [input.category, input.title, input.source, input.module, input.text]
    .join("\n")
    .toLowerCase();

  if (input.category === "schema" || haystack.includes("estrutura da tabela")) return "schema_table";
  if (haystack.includes("check constraint") || haystack.includes("foreign key")) return "schema_constraints";
  if (input.category === "manual_pdf") return "manual_pdf";
  if (input.category === "manual" || haystack.includes("manual")) return "manual";
  if (input.category === "ticket" || haystack.includes("mantis")) return "ticket";
  if (input.category === "audio_case") return "audio_case";
  return "knowledge_item";
}

function normalizeTableList(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || "").trim().toUpperCase()).filter(Boolean)));
}

function normalizeStringList(values?: string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}
