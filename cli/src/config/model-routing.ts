import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  ModelTier,
  PhaseName,
  WorkKitState,
  Classification,
  isModelTier,
} from "../state/schema.js";
import { STATE_DIR } from "../state/store.js";

/**
 * Per-phase/step model routing.
 *
 * Resolution order (highest precedence first):
 *   1. Workspace override    .work-kit/model-config.json        (per-session, per-step map)
 *   2. User global override  ~/.claude/work-kit/models.json     (per-user, all projects)
 *   3. Session model policy  state.modelPolicy                  (set at init via skill flag)
 *   4. Classification        BY_CLASSIFICATION (auto-kit only)
 *   5. Step default          BY_STEP
 *   6. Phase default         BY_PHASE
 *   7. Hard default          "sonnet"
 *
 * When state.modelPolicy is "inherit" (or layered overrides have not set a
 * value), resolveModel() returns `undefined` so the orchestrator skill omits
 * the `model` parameter on the Agent tool — identical to pre-routing behavior.
 */

const HARD_DEFAULT: ModelTier = "sonnet";

// ── Phase defaults ──────────────────────────────────────────────────

export const BY_PHASE: Record<PhaseName, ModelTier> = {
  triage: "haiku",
  plan: "sonnet",
  build: "sonnet",
  test: "sonnet",
  review: "sonnet",
  deploy: "haiku",
  "wrap-up": "sonnet",
};

// ── Step-level overrides (phase/step keys) ──────────────────────────

export const BY_STEP: Record<string, ModelTier> = {
  // Triage — single classification call, cheap
  "triage/classify": "haiku",

  // Plan — research/design-heavy steps benefit from opus (Understand now also handles Refine + Spec for features)
  "plan/understand": "opus",
  "plan/design": "opus",
  "plan/audit": "opus",

  // Build — setup/commit are mechanical (haiku); implement is the TDD cycle (sonnet)
  "build/setup": "haiku",
  "build/implement": "sonnet",
  "build/commit": "haiku",

  // Test — verify is mechanical, browser/e2e/validate need judgment
  "test/verify": "haiku",
  "test/browser": "sonnet",
  "test/e2e": "sonnet",
  "test/validate": "sonnet",

  // Review — scope (diff classification) is cheap (haiku); security & compliance get opus; fix needs sonnet; rest sonnet
  "review/scope": "haiku",
  "review/self-review": "sonnet",
  "review/security": "opus",
  "review/performance": "sonnet",
  "review/compliance": "opus",
  "review/fix": "sonnet",
  "review/handoff": "sonnet",

  // Deploy — mostly mechanical
  "deploy/merge": "haiku",
  "deploy/monitor": "haiku",
  "deploy/remediate": "sonnet",

  // Wrap-up — synthesis
  "wrap-up/summary": "sonnet",
};

// ── Classification overrides (auto-kit only) ────────────────────────

export const BY_CLASSIFICATION: Record<Classification, Partial<Record<string, ModelTier>>> = {
  "small-change": {
    // Trivial work: knock plan and reviews down a tier
    "plan/understand": "haiku",
    "plan/design": "haiku",
    "plan/audit": "haiku",
    "review/security": "sonnet",
    "review/compliance": "sonnet",
  },
  "bug-fix": {
    // Bug fixes still need opus for understand (investigation-heavy); design/audit can relax
    "plan/design": "sonnet",
    "plan/audit": "sonnet",
  },
  refactor: {
    // Perf review matters most for refactors — promote it
    "review/performance": "opus",
  },
  feature: {},
  "large-feature": {},
};

// ── JSON override loading ───────────────────────────────────────────

type OverrideMap = Partial<Record<string, ModelTier>>;

interface LoadedOverrides {
  workspace: OverrideMap;
  userGlobal: OverrideMap;
}

/**
 * Read+validate the optional JSON override files. Silently returns empty
 * maps on any read/parse/validation error — overrides are strictly opt-in
 * and must never block the workflow.
 */
export function loadOverrides(worktreeRoot: string): LoadedOverrides {
  return {
    workspace: readJsonMap(path.join(worktreeRoot, STATE_DIR, "model-config.json")),
    userGlobal: readJsonMap(path.join(os.homedir(), ".claude", "work-kit", "models.json")),
  };
}

function readJsonMap(filePath: string): OverrideMap {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: OverrideMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && isModelTier(value)) {
        out[key] = value;
      }
    }
    return out;
  } catch {
    return {};
  }
}

// ── Resolution ──────────────────────────────────────────────────────

/**
 * Resolve the model tier for a given phase/step in a given session.
 *
 * Returns `undefined` when the session policy is "inherit" (or when an
 * override file explicitly maps to inherit via a missing entry — this does
 * not happen today but stays consistent with "no opinion" semantics).
 *
 * Callers treat `undefined` as "do not pass a model parameter to the Agent
 * tool" — identical to pre-routing behavior.
 */
export function resolveModel(
  state: Pick<WorkKitState, "modelPolicy" | "classification" | "mode"> & { metadata: { worktreeRoot: string } },
  phase: PhaseName,
  step: string
): ModelTier | undefined {
  const key = `${phase}/${step}`;
  const policy = state.modelPolicy ?? "auto";

  // Policy "inherit" short-circuits everything: no model override at all.
  if (policy === "inherit") {
    return undefined;
  }

  // Layers 1 & 2: JSON overrides win over everything else.
  const overrides = loadOverrides(state.metadata.worktreeRoot);
  if (overrides.workspace[key]) return overrides.workspace[key];
  if (overrides.userGlobal[key]) return overrides.userGlobal[key];

  // Layer 3: Forced policy (opus/sonnet/haiku) beats all routing.
  if (policy !== "auto") {
    return policy;
  }

  // Layer 4: Classification override (auto-kit only).
  if (state.mode === "auto-kit" && state.classification) {
    const classOverride = BY_CLASSIFICATION[state.classification][key];
    if (classOverride) return classOverride;
  }

  // Layer 5: Step default.
  if (BY_STEP[key]) return BY_STEP[key];

  // Layer 6: Phase default.
  if (BY_PHASE[phase]) return BY_PHASE[phase];

  // Layer 7: Hard default.
  return HARD_DEFAULT;
}
