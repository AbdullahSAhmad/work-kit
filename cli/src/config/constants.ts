// ── Archive Paths ───────────────────────────────────────────────────

export const TRACKER_DIR = ".work-kit-tracker";
export const ARCHIVE_DIR = "archive";
export const INDEX_FILE = "index.md";
export const SUMMARY_FILE = "summary.md";

// ── Git ─────────────────────────────────────────────────────────────

export const BRANCH_PREFIX = "feature/";

// ── Skills ──────────────────────────────────────────────────────────

export const SKILL_DIR_PREFIX = "wk-";

// ── CLI ─────────────────────────────────────────────────────────────

/**
 * Binary used in onComplete actions emitted to the orchestrator.
 * Resolves on PATH after `npm install -g work-kit-cli`.
 */
export const CLI_BINARY = "work-kit";

/**
 * Fallback / install messaging form. Used in error and setup output.
 */
export const CLI_NPX_BINARY = "npx work-kit-cli";

// ── Project Config ──────────────────────────────────────────────────

/**
 * Optional project-level config file. Lives at the main repo root and
 * lets a project override workflow defaults, parallel groups, etc.
 */
export const PROJECT_CONFIG_FILE = ".work-kit-config.json";

// ── Limits ──────────────────────────────────────────────────────────

export const MAX_LOOPBACKS_PER_ROUTE = 2;

// ── Staleness ───────────────────────────────────────────────────────

/** Threshold (ms) after which an in-progress state is considered stale. */
export const STALE_THRESHOLD_MS = 60 * 60 * 1000;
