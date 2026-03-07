import * as fs from "fs";
import * as path from "path";

const promptCache = new Map<string, string>();
const promptsDirectory = __dirname;

/**
 * Loads a prompt from the file system and caches it in memory.
 * The path is constructed relative to the compiled 'dist' directory.
 * Assumes that the 'prompts' directory is copied to the root of 'dist'.
 *
 * @param name The name of the prompt file (e.g., 'base.prompt.md').
 * @returns The content of the prompt file as a string.
 */
export function loadPrompt(name: string): string {
  if (promptCache.has(name)) {
    return promptCache.get(name)!;
  }

  try {
    const filePath = path.join(promptsDirectory, name);
    const content = fs.readFileSync(filePath, "utf-8");
    promptCache.set(name, content);
    return content;
  } catch (error) {
    console.error(`Failed to load prompt: ${name}`, error);
    // In case of an error (e.g., file not found), return an empty string
    // or handle it as needed. Returning a descriptive error might be better.
    return `[SYSTEM ERROR: Prompt '${name}' not found]`;
  }
}
