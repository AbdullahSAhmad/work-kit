/**
 * Receipt file storage. Receipts live under `.work-kit/receipts/`
 * alongside tracker.json and state.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { atomicWriteFile } from "../utils/fs.js";
import { STATE_DIR } from "../state/store.js";
import type { PhaseName } from "../state/schema.js";
import { isReceiptStepKey, type Receipt } from "./schemas.js";

export const RECEIPTS_DIR = "receipts";

export function receiptsDir(worktreeRoot: string): string {
  return path.join(worktreeRoot, STATE_DIR, RECEIPTS_DIR);
}

export function receiptPath(worktreeRoot: string, phase: PhaseName, step: string): string {
  return path.join(receiptsDir(worktreeRoot), `${phase}-${step}.json`);
}

/** Path emitted to agents in the action JSON. Always relative to the worktree. */
export function relativeReceiptPath(phase: PhaseName, step: string): string {
  return `${STATE_DIR}/${RECEIPTS_DIR}/${phase}-${step}.json`;
}

/**
 * Single source of truth for "does this step have a receipt schema, and if
 * so where does it live?" Used by every code path that emits a receiptPath
 * in an Action or agent prompt.
 */
export function receiptPathIfApplicable(phase: PhaseName, step: string): string | undefined {
  return isReceiptStepKey(`${phase}/${step}`) ? relativeReceiptPath(phase, step) : undefined;
}

export function ensureReceiptsDir(worktreeRoot: string): void {
  fs.mkdirSync(receiptsDir(worktreeRoot), { recursive: true });
}

export function receiptExists(worktreeRoot: string, phase: PhaseName, step: string): boolean {
  return fs.existsSync(receiptPath(worktreeRoot, phase, step));
}

/**
 * Read a receipt file. Returns null when the file is missing (ENOENT).
 * Throws on parse errors so the caller can surface the malformed JSON to
 * the user rather than treating "corrupted" the same as "not yet written".
 */
export function readReceiptRaw(worktreeRoot: string, phase: PhaseName, step: string): unknown | null {
  const p = receiptPath(worktreeRoot, phase, step);
  let raw: string;
  try {
    raw = fs.readFileSync(p, "utf-8");
  } catch (e: any) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Receipt at ${p} contains invalid JSON: ${(e as Error).message}`);
  }
}

export function writeReceipt(
  worktreeRoot: string,
  phase: PhaseName,
  step: string,
  receipt: Receipt
): void {
  ensureReceiptsDir(worktreeRoot);
  atomicWriteFile(receiptPath(worktreeRoot, phase, step), JSON.stringify(receipt, null, 2) + "\n");
}
