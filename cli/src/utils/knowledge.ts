import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { KNOWLEDGE_DIR, KNOWLEDGE_LOCK } from "../config/constants.js";
import { atomicWriteFile } from "./fs.js";

// Re-exported so existing call sites that import from here keep working.
export { KNOWLEDGE_DIR, KNOWLEDGE_LOCK };

// ── Constants ───────────────────────────────────────────────────────

export const AUTO_BLOCK_START = "<!-- work-kit:auto:start -->";
export const AUTO_BLOCK_END = "<!-- work-kit:auto:end -->";
export const MANUAL_HEADER = "## Manual";

export const KNOWLEDGE_TYPES = ["lesson", "convention", "risk", "workflow", "decision"] as const;
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export function isKnowledgeType(value: string): value is KnowledgeType {
  return (KNOWLEDGE_TYPES as readonly string[]).includes(value);
}

const TYPE_TO_FILE: Record<KnowledgeType, string> = {
  lesson: "findings.md",
  convention: "findings.md",
  risk: "findings.md",
  decision: "findings.md",
  workflow: "workflow.md",
};

const FILE_TO_TITLE: Record<string, string> = {
  "findings.md": "Project Findings",
  "workflow.md": "Workflow Feedback",
};

const FILE_TO_BLURB: Record<string, string> = {
  "findings.md":
    "Project-specific knowledge captured during work-kit sessions: lessons learned, conventions this codebase follows, known fragile areas (risks), and architectural decisions (what was chosen, what was rejected, why). Tagged with [lesson|convention|risk|decision] in the entry text.",
  "workflow.md":
    "Feedback about the work-kit workflow itself as observed in this project — skill quality, step skips, loopbacks, failure modes. Mined manually to improve work-kit upstream.",
};

// ── Path Resolvers ──────────────────────────────────────────────────

export function knowledgeDir(mainRepoRoot: string): string {
  return path.join(mainRepoRoot, KNOWLEDGE_DIR);
}

export function knowledgePath(mainRepoRoot: string, file: string): string {
  return path.join(knowledgeDir(mainRepoRoot), file);
}

export function fileForType(type: KnowledgeType): string {
  return TYPE_TO_FILE[type];
}

// ── Lock ────────────────────────────────────────────────────────────

const LOCK_TIMEOUT_MS = 5000;
const LOCK_POLL_MS = 50;

// Reused across sleep calls — Atomics.wait needs an Int32Array view but the
// contents don't matter, so we allocate it once per process.
const SLEEP_BUF = new Int32Array(new SharedArrayBuffer(4));
function sleepSync(ms: number): void {
  Atomics.wait(SLEEP_BUF, 0, 0, ms);
}

/**
 * Polling file-lock around `<knowledge>/.lock`. Uses fs.openSync(... 'wx')
 * for atomic create-or-fail. Held only during the read-modify-write of a
 * single .md file. Two parallel worktrees calling `learn` simultaneously
 * are serialized — both succeed.
 */
export function withKnowledgeLock<T>(mainRepoRoot: string, fn: () => T): T {
  const dir = knowledgeDir(mainRepoRoot);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const lockPath = path.join(dir, KNOWLEDGE_LOCK);
  const start = Date.now();

  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx");
      try {
        return fn();
      } finally {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore
        }
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // ignore
        }
      }
    } catch (err: any) {
      if (err?.code !== "EEXIST") throw err;
      if (Date.now() - start > LOCK_TIMEOUT_MS) {
        throw new Error(
          `Could not acquire knowledge lock at ${lockPath} within ${LOCK_TIMEOUT_MS}ms. Another work-kit process may be stuck — remove the .lock file if no work-kit process is running.`,
        );
      }
      sleepSync(LOCK_POLL_MS);
    }
  }
}

// ── Redaction ───────────────────────────────────────────────────────

const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "openai-style", re: /sk-[A-Za-z0-9]{20,}/g },
  { name: "anthropic", re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: "github-pat", re: /github_pat_[A-Za-z0-9_]{82}/g },
  { name: "github-token", re: /ghp_[A-Za-z0-9]{36}/g },
  { name: "github-oauth", re: /gho_[A-Za-z0-9]{36}/g },
  { name: "aws-access-key", re: /AKIA[0-9A-Z]{16}/g },
  // Generic 40-char hex token (matches API keys, hashes, etc.)
  { name: "hex-40", re: /\b[a-fA-F0-9]{40}\b/g },
];

export interface RedactionResult {
  text: string;
  redacted: boolean;
  matches: string[];
}

export function redact(input: string): RedactionResult {
  let text = input;
  const matches: string[] = [];
  for (const { name, re } of SECRET_PATTERNS) {
    text = text.replace(re, () => {
      matches.push(name);
      return "[REDACTED]";
    });
  }
  return { text, redacted: matches.length > 0, matches };
}

// ── Stub File Scaffolding ───────────────────────────────────────────

function stubContent(file: string): string {
  const title = FILE_TO_TITLE[file] ?? file;
  const blurb = FILE_TO_BLURB[file] ?? "";
  return [
    `# ${title}`,
    "",
    blurb,
    "",
    AUTO_BLOCK_START,
    "## Auto-captured",
    "",
    "<!-- Tooling appends new entries inside this block. Do not edit by hand. -->",
    "",
    AUTO_BLOCK_END,
    "",
    MANUAL_HEADER,
    "",
    "<!-- Curated by humans. Tooling never edits below this line. -->",
    "",
  ].join("\n");
}

const README_CONTENT = `# .work-kit-knowledge

This directory holds project knowledge that work-kit captures and reads
across sessions. It is **committed to your repo** so the whole team
benefits.

## Files

- **findings.md** — project-specific knowledge: lessons learned, conventions,
  known fragile areas (risks), and architectural decisions. Tagged with
  [lesson|convention|risk|decision] inside each entry.
- **workflow.md** — feedback about the work-kit workflow itself as observed
  in this project. Mined manually across projects to improve work-kit.

Each file has two sections:

- **Auto-captured** — appended by work-kit during \`wrap-up/finalize\` and
  by \`work-kit learn\`. Inside \`<!-- work-kit:auto:start -->\` markers.
  **Do not edit by hand.**
- **Manual** — for humans only. Tooling never touches it. Add curated rules
  here.

## Privacy warning

Files in this directory are committed to your repo. **Don't write secrets
here.** Work-kit redacts known secret shapes (API keys, tokens) at write
time, but the regex sweep is best-effort. Treat these files like any other
source you commit.

## How is this populated?

- During a session, agents append typed bullets to \`## Observations\` in
  \`.work-kit/state.md\`.
- At \`wrap-up/finalize\`, the kit parses Observations + Decisions +
  tracker.json loopbacks and routes them to the two files.
- Agents may also call \`work-kit learn --type X --text "..."\` mid-session.

## Reading

\`work-kit bootstrap\` injects \`findings.md\` into every new session's
opening context. \`workflow.md\` is **not** injected — it's a write-only
artifact for human review.
`;

// Roots whose knowledge dir we've already verified this process. Lets
// repeated calls (one per `learn`/`extract` invocation) skip the 6 stat
// calls after the first hit per process.
const ensuredRoots = new Set<string>();

export function ensureKnowledgeDir(mainRepoRoot: string): { created: string[] } {
  if (ensuredRoots.has(mainRepoRoot)) {
    return { created: [] };
  }

  const dir = knowledgeDir(mainRepoRoot);
  const created: string[] = [];

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const readmePath = path.join(dir, "README.md");
  if (!fs.existsSync(readmePath)) {
    fs.writeFileSync(readmePath, README_CONTENT, "utf-8");
    created.push("README.md");
  }

  for (const file of new Set(Object.values(TYPE_TO_FILE))) {
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, stubContent(file), "utf-8");
      created.push(file);
    }
  }

  ensuredRoots.add(mainRepoRoot);
  return { created };
}

// ── Append / Read ───────────────────────────────────────────────────

export interface KnowledgeEntry {
  /** ISO timestamp */
  ts: string;
  sessionSlug?: string;
  phase?: string;
  step?: string;
  skillPath?: string;
  gitSha?: string;
  /** "auto-state-md" | "auto-tracker" | "explicit-cli" */
  source: string;
  /** Free-form text. Will be redacted at write time. */
  text: string;
  /** Optional path glob for future filtering. Stored, not yet used. */
  scope?: string;
}

/** Format an entry as a single markdown bullet inside the auto block. */
function formatEntry(entry: KnowledgeEntry): string {
  const date = entry.ts.slice(0, 10);
  const ctx: string[] = [];
  if (entry.sessionSlug) ctx.push(`\`${entry.sessionSlug}\``);
  if (entry.phase && entry.step) ctx.push(`(${entry.phase}/${entry.step})`);
  else if (entry.phase) ctx.push(`(${entry.phase})`);
  const ctxStr = ctx.length > 0 ? ` ${ctx.join(" ")}` : "";
  const scopeStr = entry.scope ? ` _scope: \`${entry.scope}\`_` : "";
  return `- **${date}**${ctxStr}: ${entry.text}${scopeStr}`;
}

/** Stable hash of an entry's identifying content (for idempotent dedup). */
function entryHash(entry: KnowledgeEntry): string {
  const key = JSON.stringify({
    text: entry.text,
    phase: entry.phase ?? null,
    step: entry.step ?? null,
    source: entry.source,
  });
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 12);
}

/**
 * Read a knowledge file. Returns null if it doesn't exist. If markers are
 * missing or corrupted, the raw content is returned and append rebuilds them.
 */
function readKnowledgeFileRaw(mainRepoRoot: string, file: string): string | null {
  const p = knowledgePath(mainRepoRoot, file);
  try {
    return fs.readFileSync(p, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Read a knowledge file capped at `capLines` lines for bootstrap injection.
 * Strategy: include the entire `## Manual` section + the most recent N
 * entries from the auto-captured block until the cap is hit. If still over,
 * append a "(N more entries)" tail.
 */
export function readKnowledgeFile(mainRepoRoot: string, file: string, capLines: number = 200): string | null {
  const raw = readKnowledgeFileRaw(mainRepoRoot, file);
  if (raw === null) return null;

  const lines = raw.split("\n");
  if (lines.length <= capLines) return raw;

  // Find the auto block and manual section markers.
  const autoStart = lines.findIndex((l) => l.includes(AUTO_BLOCK_START));
  const autoEnd = lines.findIndex((l) => l.includes(AUTO_BLOCK_END));
  const manualIdx = lines.findIndex((l) => l.trim() === MANUAL_HEADER);

  if (autoStart === -1 || autoEnd === -1) {
    // Markers missing — just truncate from the top.
    return lines
      .slice(0, capLines)
      .concat([`... (${lines.length - capLines} more lines)`])
      .join("\n");
  }

  const headerLines = lines.slice(0, autoStart + 1);
  const autoBodyLines = lines.slice(autoStart + 1, autoEnd);
  const autoCloseLine = lines[autoEnd];
  const manualLines = manualIdx !== -1 ? lines.slice(manualIdx) : [];

  // Reserve budget for header + manual + auto markers + safety
  const reserved = headerLines.length + manualLines.length + 2;
  const autoBudget = Math.max(5, capLines - reserved);

  let truncatedAuto = autoBodyLines;
  let omitted = 0;
  if (autoBodyLines.length > autoBudget) {
    truncatedAuto = autoBodyLines.slice(autoBodyLines.length - autoBudget);
    omitted = autoBodyLines.length - autoBudget;
  }

  const out = [
    ...headerLines,
    ...(omitted > 0 ? [`<!-- ... ${omitted} older auto entries truncated for context budget ... -->`] : []),
    ...truncatedAuto,
    autoCloseLine,
    ...manualLines,
  ];
  return out.join("\n");
}

/**
 * Read a knowledge file's current content (or a fresh stub) and ensure the
 * auto-block markers are present. If markers were missing, existing content
 * is rebased under the new stub.
 */
function loadOrStub(mainRepoRoot: string, file: string): string {
  let content = readKnowledgeFileRaw(mainRepoRoot, file) ?? stubContent(file);

  if (!content.includes(AUTO_BLOCK_START) || !content.includes(AUTO_BLOCK_END)) {
    const existing = content.trim();
    content = stubContent(file);
    if (existing.length > 0 && !existing.startsWith(`# ${FILE_TO_TITLE[file]}`)) {
      content = content.trimEnd() + "\n" + existing + "\n";
    }
  }
  return content;
}

/**
 * Insert a new entry into `content` just before the auto-block close marker.
 * Returns the new content, or null if the entry's hash is already present
 * (idempotent skip).
 */
function insertEntry(content: string, entry: KnowledgeEntry): string | null {
  const hashMarker = `<!-- hash:${entryHash(entry)} -->`;
  const startIdx = content.indexOf(AUTO_BLOCK_START);
  const endIdx = content.indexOf(AUTO_BLOCK_END);

  if (startIdx !== -1 && endIdx !== -1) {
    if (content.indexOf(hashMarker, startIdx) > -1 && content.indexOf(hashMarker, startIdx) < endIdx) {
      return null;
    }
  }

  const formatted = formatEntry(entry) + ` ${hashMarker}`;
  const before = content.slice(0, endIdx);
  const after = content.slice(endIdx);
  // Ensure newline before the close marker so bullets don't fuse onto its line
  const sep = before.endsWith("\n") ? "" : "\n";
  return before + sep + formatted + "\n" + after;
}

/**
 * Append an entry to a knowledge file's auto-captured block. Read-modify-write
 * inside the lock. Idempotent: if an identical entry (by hash) already exists
 * in the auto block, the write is skipped.
 *
 * Returns true if a new entry was appended, false if it was a duplicate.
 *
 * For multiple entries to the same file, prefer `appendAutoEntries` to do
 * a single read-modify-write per file.
 */
export function appendAutoEntry(mainRepoRoot: string, file: string, entry: KnowledgeEntry): boolean {
  return withKnowledgeLock(mainRepoRoot, () => {
    const content = loadOrStub(mainRepoRoot, file);
    const next = insertEntry(content, entry);
    if (next === null) return false;
    atomicWriteFile(knowledgePath(mainRepoRoot, file), next);
    return true;
  });
}

export interface AppendBatchResult {
  written: number;
  duplicates: number;
  /** Per-file counts so callers can map back to whatever taxonomy they care about. */
  perFile: Map<string, { written: number; duplicates: number }>;
}

/**
 * Batched version of `appendAutoEntry`. Groups entries by file and does one
 * read-modify-write per file under a single lock acquisition.
 */
export function appendAutoEntries(
  mainRepoRoot: string,
  entriesByFile: Map<string, KnowledgeEntry[]>,
): AppendBatchResult {
  return withKnowledgeLock(mainRepoRoot, () => {
    const perFile = new Map<string, { written: number; duplicates: number }>();
    let written = 0;
    let duplicates = 0;

    for (const [file, entries] of entriesByFile) {
      let content = loadOrStub(mainRepoRoot, file);
      let fileWritten = 0;
      let fileDuplicates = 0;

      for (const entry of entries) {
        const next = insertEntry(content, entry);
        if (next === null) {
          fileDuplicates++;
        } else {
          content = next;
          fileWritten++;
        }
      }

      if (fileWritten > 0) {
        atomicWriteFile(knowledgePath(mainRepoRoot, file), content);
      }

      perFile.set(file, { written: fileWritten, duplicates: fileDuplicates });
      written += fileWritten;
      duplicates += fileDuplicates;
    }

    return { written, duplicates, perFile };
  });
}
