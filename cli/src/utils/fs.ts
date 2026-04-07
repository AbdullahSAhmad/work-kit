import * as fs from "node:fs";
import { randomUUID } from "node:crypto";

/**
 * Crash-safe write: write to a temp file in the same directory, then rename.
 * The rename is atomic on POSIX, so a partial file never appears at `target`.
 * Used for any file that may be read concurrently or that must survive a crash.
 */
export function atomicWriteFile(target: string, content: string): void {
  const tmp = target + "." + randomUUID().slice(0, 8) + ".tmp";
  fs.writeFileSync(tmp, content, "utf-8");
  fs.renameSync(tmp, target);
}
