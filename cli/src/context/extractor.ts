import { readStateMd } from "../state/store.js";

/**
 * Extract a specific ### section from state.md by heading.
 * Returns the content between the heading and the next ### heading (or end of file).
 */
export function extractSection(stateMd: string, heading: string): string | null {
  // Normalize heading — ensure it starts with ###
  const prefix = heading.startsWith("###") ? heading : `### ${heading}`;
  const lines = stateMd.split("\n");
  let capturing = false;
  const captured: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith(prefix)) {
      capturing = true;
      captured.push(line);
      continue;
    }
    if (capturing && line.trim().startsWith("### ")) {
      break; // Hit next section
    }
    if (capturing) {
      captured.push(line);
    }
  }

  return captured.length > 0 ? captured.join("\n").trim() : null;
}

/**
 * Extract a ## section (top-level section like Description, Criteria).
 */
export function extractTopSection(stateMd: string, heading: string): string | null {
  const prefix = heading.startsWith("##") ? heading : `## ${heading}`;
  const lines = stateMd.split("\n");
  let capturing = false;
  const captured: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith(prefix) && !line.trim().startsWith("### ")) {
      capturing = true;
      captured.push(line);
      continue;
    }
    if (capturing && line.trim().startsWith("## ") && !line.trim().startsWith("### ")) {
      break;
    }
    if (capturing) {
      captured.push(line);
    }
  }

  return captured.length > 0 ? captured.join("\n").trim() : null;
}

/**
 * Extract multiple sections from state.md.
 */
export function extractSections(worktreeRoot: string, sectionNames: string[]): Record<string, string | null> {
  const stateMd = readStateMd(worktreeRoot);
  if (!stateMd) return {};

  const result: Record<string, string | null> = {};
  for (const name of sectionNames) {
    if (name.startsWith("### ") || !name.startsWith("## ")) {
      result[name] = extractSection(stateMd, name);
    } else {
      result[name] = extractTopSection(stateMd, name);
    }
  }
  return result;
}
