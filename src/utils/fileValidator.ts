// src/utils/fileValidator.ts
import path from "path";

export interface FileValidationConfig {
  allowedMimeTypes?: string[];
  maxSizeBytes?: number;
  allowedExtensions?: string[];
}

const DEFAULT_CONFIG: FileValidationConfig = {
  allowedMimeTypes: [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  maxSizeBytes: 50 * 1024 * 1024, // 50MB
  allowedExtensions: [".pdf", ".txt", ".md", ".doc", ".docx"],
};

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

export function validateFile(
  file: Express.Multer.File,
  config: FileValidationConfig = DEFAULT_CONFIG,
): boolean {
  // Validar MIME type
  if (config.allowedMimeTypes) {
    const mime = file.mimetype || "";
    const ext = path.extname(file.originalname).toLowerCase();
    const mimePermitido =
      config.allowedMimeTypes.includes(mime) ||
      (mime === "application/octet-stream" &&
        config.allowedExtensions?.includes(ext));

    if (!mimePermitido) {
      throw new FileValidationError(
        `Tipo de arquivo não permitido: ${mime}. ` +
          `Permitidos: ${config.allowedMimeTypes.join(", ")}`,
      );
    }
  }

  // Validar tamanho
  if (config.maxSizeBytes && file.size > config.maxSizeBytes) {
    const maxMb = (config.maxSizeBytes / 1024 / 1024).toFixed(1);
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    throw new FileValidationError(
      `Arquivo muito grande: ${sizeMb}MB > ${maxMb}MB permitido`,
    );
  }

  // Validar extensão
  if (config.allowedExtensions) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!config.allowedExtensions.includes(ext)) {
      throw new FileValidationError(
        `Extensão não permitida: ${ext}. ` +
          `Permitidas: ${config.allowedExtensions.join(", ")}`,
      );
    }
  }

  return true;
}

export function validateFiles(
  files: Express.Multer.File[],
  config: FileValidationConfig = DEFAULT_CONFIG,
): {
  valid: Express.Multer.File[];
  invalid: Array<{ file: Express.Multer.File; error: string }>;
} {
  const valid: Express.Multer.File[] = [];
  const invalid: Array<{ file: Express.Multer.File; error: string }> = [];

  for (const file of files) {
    try {
      validateFile(file, config);
      valid.push(file);
    } catch (error) {
      invalid.push({
        file,
        error: (error as Error).message,
      });
    }
  }

  return { valid, invalid };
}
