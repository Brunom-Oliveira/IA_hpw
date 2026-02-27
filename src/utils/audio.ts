import path from "path";
import { promises as fs } from "fs";

export const removeFileIfExists = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore cleanup errors for non-existent temp files.
  }
};

export const buildWhisperOutputPrefix = (audioPath: string): string => {
  const dir = path.dirname(audioPath);
  const fileName = path.basename(audioPath, path.extname(audioPath));
  return path.join(dir, `${fileName}_transcript`);
};

