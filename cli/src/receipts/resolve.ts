/**
 * One-shot helper that turns a step's receipt file into a derived outcome
 * (and a classification, when triage/classify writes one).
 *
 * Wraps read → validate → derive so callers don't need to know about
 * those internals — they just ask "what should this step's outcome be?"
 * and get either `{ ok: true, outcome, classification? }` or an Action
 * shaped error they can return verbatim.
 */

import { CLI_BINARY } from "../config/constants.js";
import type { Action, Classification, PhaseName, StepOutcome } from "../state/schema.js";
import { errorMessage } from "../utils/errors.js";
import { deriveOutcome } from "./derive.js";
import { readReceiptRaw, relativeReceiptPath } from "./store.js";
import { validateReceipt } from "./validate.js";

export type ReceiptResolution =
  | { ok: true; outcome: StepOutcome; classification?: Classification }
  | { ok: false; action: Extract<Action, { action: "error" }> };

export function resolveReceiptOutcome(worktreeRoot: string, phase: PhaseName, step: string): ReceiptResolution {
  const rPath = relativeReceiptPath(phase, step);
  const stepKey = `${phase}/${step}`;

  let raw: unknown;
  try {
    raw = readReceiptRaw(worktreeRoot, phase, step);
  } catch (e) {
    return { ok: false, action: { action: "error", message: errorMessage(e) } };
  }

  if (raw === null) {
    return {
      ok: false,
      action: {
        action: "error",
        message: `${stepKey} requires a receipt at ${rPath} before completing.`,
        suggestion: `Have the agent write the structured receipt JSON to that path, then re-run \`${CLI_BINARY} complete ${stepKey}\`.`,
      },
    };
  }

  const result = validateReceipt(raw, phase, step);
  if (!result.ok) {
    return {
      ok: false,
      action: {
        action: "error",
        message: `Receipt for ${stepKey} failed validation:\n  - ${result.errors.join("\n  - ")}`,
        suggestion: `Fix the receipt at ${rPath} and re-run.`,
      },
    };
  }

  return {
    ok: true,
    outcome: deriveOutcome(result.receipt),
    ...(result.receipt.step === "triage/classify" && { classification: result.receipt.classification }),
  };
}
