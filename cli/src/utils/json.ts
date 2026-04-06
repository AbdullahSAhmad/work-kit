import * as fs from "node:fs";

/**
 * Read and parse a JSON file. Returns null when the file is missing,
 * unreadable, or contains invalid JSON. Use only when null is a meaningful
 * "no config" answer; use direct fs/JSON for hard-required files.
 */
export function readJsonFile<T>(filePath: string): T | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
