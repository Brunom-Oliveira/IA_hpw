import { describe, it, expect } from "vitest";
import {
  validateFile,
  validateFiles,
  FileValidationError,
} from "../../src/utils/fileValidator";

describe("File Upload Validation - SEC-003", () => {
  const createMockFile = (
    filename: string,
    mimetype: string,
    size: number = 1024,
  ): Express.Multer.File => ({
    fieldname: "files",
    originalname: filename,
    encoding: "7bit",
    mimetype,
    size,
    destination: "/tmp",
    filename: `${Date.now()}-${filename}`,
    path: `/tmp/${Date.now()}-${filename}`,
    buffer: Buffer.alloc(size),
  });

  describe("validateFile - Single File", () => {
    it("should accept valid PDF file", () => {
      const file = createMockFile(
        "document.pdf",
        "application/pdf",
        1024 * 100,
      );
      expect(() => validateFile(file)).not.toThrow();
    });

    it("should accept valid TXT file", () => {
      const file = createMockFile("document.txt", "text/plain", 1024 * 50);
      expect(() => validateFile(file)).not.toThrow();
    });

    it("should accept valid Markdown file", () => {
      const file = createMockFile("document.md", "text/markdown", 1024 * 50);
      expect(() => validateFile(file)).not.toThrow();
    });

    it("should accept valid DOCX file", () => {
      const file = createMockFile(
        "document.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        1024 * 100,
      );
      expect(() => validateFile(file)).not.toThrow();
    });

    it("should reject file with invalid MIME type", () => {
      const file = createMockFile(
        "malware.exe",
        "application/x-executable",
        1024,
      );
      expect(() => validateFile(file)).toThrow(FileValidationError);
      expect(() => validateFile(file)).toThrow("Tipo de arquivo não permitido");
    });

    it("should reject file with invalid extension", () => {
      const file = createMockFile("malware.exe", "application/pdf", 1024);
      expect(() => validateFile(file)).toThrow(FileValidationError);
      expect(() => validateFile(file)).toThrow("Extensão não permitida");
    });

    it("should reject file exceeding size limit", () => {
      const file = createMockFile(
        "large.pdf",
        "application/pdf",
        60 * 1024 * 1024, // 60MB > 50MB limit
      );
      expect(() => validateFile(file)).toThrow(FileValidationError);
      expect(() => validateFile(file)).toThrow("muito grande");
    });

    it("should accept file at exact size limit", () => {
      const file = createMockFile(
        "document.pdf",
        "application/pdf",
        50 * 1024 * 1024, // Exactly 50MB
      );
      expect(() => validateFile(file)).not.toThrow();
    });

    it("should include filename in error messages for invalid extensions", () => {
      const file = createMockFile("dangerous.sh", "text/plain", 1024);
      try {
        validateFile(file);
        fail("Should have thrown");
      } catch (error) {
        expect((error as Error).message).toContain(".sh");
      }
    });
  });

  describe("validateFiles - Multiple Files", () => {
    it("should separate valid and invalid files", () => {
      const files = [
        createMockFile("document.pdf", "application/pdf", 1024 * 100),
        createMockFile("malware.exe", "application/x-executable", 1024),
        createMockFile("readme.txt", "text/plain", 1024 * 50),
      ];

      const { valid, invalid } = validateFiles(files);

      expect(valid).toHaveLength(2);
      expect(invalid).toHaveLength(1);
      expect(valid[0].originalname).toBe("document.pdf");
      expect(valid[1].originalname).toBe("readme.txt");
      expect(invalid[0].file.originalname).toBe("malware.exe");
    });

    it("should include error details for invalid files", () => {
      const files = [
        createMockFile("large.pdf", "application/pdf", 60 * 1024 * 1024),
        createMockFile("invalid.exe", "application/x-executable", 1024),
      ];

      const { invalid } = validateFiles(files);

      expect(invalid).toHaveLength(2);
      expect(invalid[0].error).toContain("muito grande");
      expect(invalid[1].error).toContain("não permitido");
    });

    it("should handle all valid files", () => {
      const files = [
        createMockFile("doc1.pdf", "application/pdf", 1024 * 100),
        createMockFile("doc2.txt", "text/plain", 1024 * 50),
        createMockFile("doc3.md", "text/markdown", 1024 * 50),
      ];

      const { valid, invalid } = validateFiles(files);

      expect(valid).toHaveLength(3);
      expect(invalid).toHaveLength(0);
    });

    it("should handle all invalid files", () => {
      const files = [
        createMockFile("malware1.exe", "application/x-executable", 1024),
        createMockFile("malware2.bat", "application/x-bat", 1024),
      ];

      const { valid, invalid } = validateFiles(files);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(2);
    });

    it("should handle empty file array", () => {
      const { valid, invalid } = validateFiles([]);

      expect(valid).toHaveLength(0);
      expect(invalid).toHaveLength(0);
    });
  });

  describe("FileValidationError", () => {
    it("should be an instance of Error", () => {
      const error = new FileValidationError("Test error");
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe("FileValidationError");
    });

    it("should contain proper error message", () => {
      const message = "Invalid file type";
      const error = new FileValidationError(message);
      expect(error.message).toBe(message);
    });
  });
});
