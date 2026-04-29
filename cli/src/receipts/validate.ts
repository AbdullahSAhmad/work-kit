/**
 * Hand-rolled receipt validator. No runtime deps. Returns a typed receipt
 * on success, a list of human-readable errors on failure.
 *
 * Each validator is intentionally narrow: it checks the fields needed to
 * derive an outcome and ignores the rest. Agents are free to add extra
 * fields for their own bookkeeping; the validator won't trip on them.
 */

import { CLASSIFICATIONS, isClassification } from "../state/schema.js";
import type { PhaseName } from "../state/schema.js";
import {
  RECEIPT_VERSION,
  RECEIPT_STEP_KEYS,
  isReceiptStepKey,
  type Receipt,
  type ReceiptStepKey,
} from "./schemas.js";

export type ValidationResult =
  | { ok: true; receipt: Receipt }
  | { ok: false; errors: string[] };

// ── Type guards ─────────────────────────────────────────────────────

function isString(v: unknown): v is string { return typeof v === "string"; }
function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }
function isNumber(v: unknown): v is number { return typeof v === "number" && !Number.isNaN(v); }
function isArray(v: unknown): v is unknown[] { return Array.isArray(v); }
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isOneOf<T extends string>(v: unknown, choices: readonly T[]): v is T {
  return isString(v) && (choices as readonly string[]).includes(v);
}

// ── Base validation (shared across all steps) ───────────────────────

function validateBase(raw: Record<string, unknown>, expectedStep: string): string[] {
  const errors: string[] = [];
  if (raw.version !== RECEIPT_VERSION) {
    errors.push(`version must be ${RECEIPT_VERSION}, got ${JSON.stringify(raw.version)}`);
  }
  if (raw.step !== expectedStep) {
    errors.push(`step must be "${expectedStep}", got ${JSON.stringify(raw.step)}`);
  }
  if (!isString(raw.timestamp)) {
    errors.push(`timestamp must be a string`);
  }
  if (raw.notes !== undefined && !isString(raw.notes)) {
    errors.push(`notes must be a string when present`);
  }
  if (raw.error !== undefined) {
    if (!isObject(raw.error)) {
      errors.push(`error must be an object when present`);
    } else {
      if (!isString(raw.error.kind)) errors.push(`error.kind must be a string`);
      if (!isString(raw.error.message)) errors.push(`error.message must be a string`);
    }
  }
  return errors;
}

// ── Per-step validators ─────────────────────────────────────────────

type StepValidator = (raw: Record<string, unknown>) => string[];

function checkArrayOfObjects(
  raw: Record<string, unknown>,
  field: string,
  required: string[]
): string[] {
  const errors: string[] = [];
  const arr = raw[field];
  if (!isArray(arr)) {
    errors.push(`${field} must be an array`);
    return errors;
  }
  arr.forEach((item, i) => {
    if (!isObject(item)) {
      errors.push(`${field}[${i}] must be an object`);
      return;
    }
    for (const key of required) {
      if (!isString(item[key])) {
        errors.push(`${field}[${i}].${key} must be a string`);
      }
    }
  });
  return errors;
}

const VALIDATORS: Record<ReceiptStepKey, StepValidator> = {
  "triage/classify": (raw) => {
    const errors: string[] = [];
    if (!isString(raw.classification) || !isClassification(raw.classification)) {
      errors.push(`classification must be one of: ${CLASSIFICATIONS.join(", ")}`);
    }
    if (!isObject(raw.signals)) {
      errors.push(`signals must be an object`);
    }
    return errors;
  },

  "plan/understand": (raw) => checkArrayOfObjects(raw, "criteria", ["id", "description"]),

  "plan/design": (raw) => {
    const errors: string[] = [];
    if (!isString(raw.blueprint_section)) errors.push(`blueprint_section must be a string`);
    return errors;
  },

  "plan/audit": (raw) => {
    const errors: string[] = [];
    errors.push(...checkArrayOfObjects(raw, "gaps", ["id", "where", "description"]));
    return errors;
  },

  "build/setup": () => [],

  "build/implement": (raw) => {
    const errors: string[] = [];
    if (!isBool(raw.tests_passing)) errors.push(`tests_passing must be a boolean`);
    if (!isString(raw.test_command)) errors.push(`test_command must be a string`);
    return errors;
  },

  "build/commit": (raw) => {
    const errors: string[] = [];
    if (!isArray(raw.commits) || !raw.commits.every(isString)) {
      errors.push(`commits must be an array of strings`);
    }
    return errors;
  },

  "test/exercise": (raw) => {
    const errors: string[] = [];
    if (!isArray(raw.lenses_run) || !raw.lenses_run.every((l) => isOneOf(l, ["verify", "e2e", "browser"] as const))) {
      errors.push(`lenses_run must be an array of "verify" | "e2e" | "browser"`);
    }
    return errors;
  },

  "test/validate": (raw) => {
    const errors: string[] = [];
    const arr = raw.criteria;
    if (!isArray(arr)) {
      errors.push(`criteria must be an array`);
    } else {
      arr.forEach((item, i) => {
        if (!isObject(item)) {
          errors.push(`criteria[${i}] must be an object`);
          return;
        }
        if (!isString(item.id)) errors.push(`criteria[${i}].id must be a string`);
        if (!isOneOf(item.status, ["pass", "fail", "untested"] as const)) {
          errors.push(`criteria[${i}].status must be "pass" | "fail" | "untested"`);
        }
      });
    }
    if (!isOneOf(raw.verdict, ["pass", "fail", "partial"] as const)) {
      errors.push(`verdict must be "pass" | "fail" | "partial"`);
    }
    return errors;
  },

  "review/scope": (raw) => {
    const errors: string[] = [];
    if (!isObject(raw.diff_classification)) errors.push(`diff_classification must be an object`);
    if (!isArray(raw.lenses_to_run) || !raw.lenses_to_run.every((l) => isOneOf(l, ["quality", "efficiency", "security", "compliance"] as const))) {
      errors.push(`lenses_to_run must be an array of "quality" | "efficiency" | "security" | "compliance"`);
    }
    return errors;
  },

  "review/review": (raw) => {
    const errors: string[] = [];
    if (!isArray(raw.lenses_run) || !raw.lenses_run.every(isString)) {
      errors.push(`lenses_run must be an array of strings`);
    }
    return errors;
  },

  "review/resolve": (raw) => {
    const errors: string[] = [];
    if (!isOneOf(raw.ship_decision, ["approved", "changes_requested"] as const)) {
      errors.push(`ship_decision must be "approved" | "changes_requested"`);
    }
    return errors;
  },

  "deploy/ship": (raw) => {
    const errors: string[] = [];
    if (!isBool(raw.merged)) errors.push(`merged must be a boolean`);
    if (!isOneOf(raw.monitor_status, ["green", "yellow", "red", "skipped"] as const)) {
      errors.push(`monitor_status must be "green" | "yellow" | "red" | "skipped"`);
    }
    return errors;
  },

  "wrap-up/summary": () => [],

  "wrap-up/knowledge": (raw) => {
    const errors: string[] = [];
    if (raw.extracted !== undefined) {
      if (!isObject(raw.extracted)) {
        errors.push(`extracted must be an object when present`);
      } else {
        for (const k of ["lessons", "conventions", "risks", "decisions", "workflow"]) {
          if (raw.extracted[k] !== undefined && !isNumber(raw.extracted[k])) {
            errors.push(`extracted.${k} must be a number when present`);
          }
        }
      }
    }
    return errors;
  },
};

// ── Public entry ────────────────────────────────────────────────────

/**
 * Validate a raw JSON receipt against the expected step's schema.
 * Returns the typed receipt on success, a flat list of human-readable
 * errors on failure.
 */
export function validateReceipt(
  raw: unknown,
  phase: PhaseName,
  step: string
): ValidationResult {
  if (!isObject(raw)) {
    return { ok: false, errors: [`receipt is not a JSON object`] };
  }
  const stepKey = `${phase}/${step}`;
  if (!isReceiptStepKey(stepKey)) {
    return {
      ok: false,
      errors: [`no receipt schema is defined for ${stepKey}. Known steps: ${RECEIPT_STEP_KEYS.join(", ")}`],
    };
  }

  const errors = validateBase(raw, stepKey);
  errors.push(...VALIDATORS[stepKey](raw));

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, receipt: raw as unknown as Receipt };
}
