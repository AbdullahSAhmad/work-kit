/**
 * Redact blocks between @wk-ignore-start and @wk-ignore-end markers.
 * Supports comment styles: //, #, --, <!-- -->
 * Replaces annotated blocks with a placeholder.
 */

const IGNORE_START = /@wk-ignore-start/;
const IGNORE_END = /@wk-ignore-end/;

export function redactIgnoredBlocks(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inBlock = false;
  let blockStart = -1;
  let blockLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!inBlock && IGNORE_START.test(lines[i])) {
      inBlock = true;
      blockStart = i;
      blockLineCount = 0;
    }

    if (inBlock) {
      blockLineCount++;
      if (IGNORE_END.test(lines[i]) || i === lines.length - 1) {
        // Emit placeholder
        const warning = IGNORE_END.test(lines[i]) ? "" : " (unclosed marker)";
        result.push(`// [redacted: ${blockLineCount} lines — @wk-ignore${warning}]`);
        inBlock = false;
      }
    } else {
      result.push(lines[i]);
    }
  }

  return result.join("\n");
}
