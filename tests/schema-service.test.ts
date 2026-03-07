import { afterEach, describe, expect, it, vi } from "vitest";

const { axiosGetMock, axiosPutMock, readFileMock, parseDDLMock, transformDDLToDocumentsMock, indexSchemaDocumentsMock } = vi.hoisted(() => ({
  axiosGetMock: vi.fn(),
  axiosPutMock: vi.fn(),
  readFileMock: vi.fn(),
  parseDDLMock: vi.fn(),
  transformDDLToDocumentsMock: vi.fn(),
  indexSchemaDocumentsMock: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    get: axiosGetMock,
    put: axiosPutMock,
  },
}));

vi.mock("fs", () => ({
  promises: {
    readFile: readFileMock,
  },
}));

vi.mock("../src/sql/sqlParser", () => ({
  parseDDL: parseDDLMock,
}));

vi.mock("../src/sql/ddlTransformer", () => ({
  transformDDLToDocuments: transformDDLToDocumentsMock,
}));

vi.mock("../src/sql/schemaIndexer", () => ({
  indexSchemaDocuments: indexSchemaDocumentsMock,
}));

import { SchemaService } from "../src/services/schemaService";
import { SchemaParser } from "../src/schema/schemaParser";

describe("SchemaService", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ingere schema.sql e indexa tabelas com metadata de tabela", async () => {
    axiosGetMock.mockRejectedValueOnce({ response: { status: 404 } });
    axiosPutMock.mockResolvedValue({});
    readFileMock.mockResolvedValue("CREATE TABLE MERCADORIA_461 (...)");

    vi.spyOn(SchemaParser.prototype, "parseSql").mockReturnValue([
      {
        table: "MERCADORIA_461",
        columns: [{ name: "MERC_PK_461", type: "NUMBER(6)" }],
        primaryKey: ["MERC_PK_461"],
        foreignKeys: [{ field: "CLI_FK_461", referencedTable: "CLIENTE_001" }],
      },
    ]);

    const service = new SchemaService({
      embed: vi.fn(async () => [0.5, 0.4, 0.3]),
    } as any);

    const result = await service.ingestFromSqlFile();

    expect(result.indexed_tables).toEqual(["MERCADORIA_461"]);
    expect(result.total).toBe(1);
    expect(axiosPutMock).toHaveBeenCalledTimes(2);

    const pointPayload = axiosPutMock.mock.calls[1][1].points[0].payload;
    expect(pointPayload.table).toBe("MERCADORIA_461");
    expect(pointPayload.table_name).toBe("MERCADORIA_461");
    expect(pointPayload.table_suffix).toBe("461");
    expect(pointPayload.document_type).toBe("schema_table");
  });

  it("gera resumo de upload SQL a partir do pipeline DDL", async () => {
    parseDDLMock.mockReturnValue({
      tables: [
        {
          schema: "ESTALO_DBA",
          table_name: "MERCADORIA_461",
          columns: [{ name: "MERC_PK_461", type: "NUMBER(6)" }],
          primary_key: ["MERC_PK_461"],
          foreign_keys: [{ columns: ["CLI_FK_461"], references: { schema: "ESTALO_DBA", table_name: "CLIENTE_001" } }],
          indexes: [],
          triggers: [],
          check_constraints: [],
        },
      ],
    });
    transformDDLToDocumentsMock.mockReturnValue([
      { id: "doc-1", text: "Documento schema", metadata: { table_name: "MERCADORIA_461" } },
    ]);
    indexSchemaDocumentsMock.mockResolvedValue({
      indexed_points: 1,
    });

    const service = new SchemaService({
      embed: vi.fn(async () => [0.5]),
    } as any);

    const result = await service.uploadSql("CREATE TABLE MERCADORIA_461 (...)");

    expect(result.summary).toEqual({
      tables_found: 1,
      documents_generated: 1,
      indexed_points: 1,
    });
    expect(result.tables[0]).toMatchObject({
      schema: "ESTALO_DBA",
      table_name: "MERCADORIA_461",
      columns: 1,
      foreign_keys: 1,
    });
    expect(transformDDLToDocumentsMock).toHaveBeenCalledOnce();
    expect(indexSchemaDocumentsMock).toHaveBeenCalledOnce();
  });
});
