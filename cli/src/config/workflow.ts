import {
  PhaseName,
  PHASE_NAMES,
  STEPS_BY_PHASE,
  Classification,
  WorkflowStep,
} from "../state/schema.js";
import { SKILL_DIR_PREFIX } from "./constants.js";

// ── Phase Order ─────────────────────────────────────────────────────

export const PHASE_ORDER: PhaseName[] = [...PHASE_NAMES];

// ── Prerequisites ───────────────────────────────────────────────────

export const PHASE_PREREQUISITES: Record<PhaseName, PhaseName | null> = {
  define: null,
  plan: "define", // when define is fully skipped, validators treat the skipped phase as satisfied
  build: "plan",
  test: "build",
  review: "test",
  deploy: "review",
  "wrap-up": "review", // or deploy if deploy was included
};

// ── Skill File Paths ────────────────────────────────────────────────

export function skillFilePath(phase: PhaseName, step?: string): string {
  const dir = `${SKILL_DIR_PREFIX}${phase}`;
  if (!step) return `.claude/skills/${dir}/SKILL.md`;
  return `.claude/skills/${dir}/steps/${step}.md`;
}

// ── Auto-kit Default Workflows ──────────────────────────────────────

type InclusionRule = "YES" | "skip" | "if UI" | "if DB" | "optional";

const WORKFLOW_MATRIX: Record<Classification, Record<string, InclusionRule>> = {
  "bug-fix": {
    "define/refine": "skip", "define/spec": "skip",
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "skip", "plan/scope": "skip",
    "plan/ux-flow": "skip", "plan/architecture": "skip", "plan/blueprint": "skip", "plan/audit": "skip",
    "build/setup": "skip", "build/migration": "skip", "build/red": "YES", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "skip", "build/integration": "skip", "build/commit": "YES",
    "test/verify": "YES", "test/browser": "skip", "test/e2e": "skip", "test/validate": "YES",
    "review/self-review": "YES", "review/security": "skip", "review/performance": "skip",
    "review/compliance": "skip", "review/handoff": "YES",
    "deploy/merge": "YES", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/summary": "YES", "wrap-up/knowledge": "skip",
  },
  "small-change": {
    "define/refine": "skip", "define/spec": "skip",
    "plan/clarify": "YES", "plan/investigate": "skip", "plan/sketch": "skip", "plan/scope": "skip",
    "plan/ux-flow": "skip", "plan/architecture": "skip", "plan/blueprint": "skip", "plan/audit": "skip",
    "build/setup": "skip", "build/migration": "skip", "build/red": "skip", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "skip", "build/integration": "skip", "build/commit": "YES",
    "test/verify": "YES", "test/browser": "skip", "test/e2e": "skip", "test/validate": "skip",
    "review/self-review": "YES", "review/security": "skip", "review/performance": "skip",
    "review/compliance": "skip", "review/handoff": "YES",
    "deploy/merge": "YES", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/summary": "YES", "wrap-up/knowledge": "skip",
  },
  refactor: {
    "define/refine": "skip", "define/spec": "skip",
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "skip", "plan/scope": "skip",
    "plan/ux-flow": "skip", "plan/architecture": "skip", "plan/blueprint": "skip", "plan/audit": "skip",
    "build/setup": "skip", "build/migration": "skip", "build/red": "skip", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "YES", "build/integration": "skip", "build/commit": "YES",
    "test/verify": "YES", "test/browser": "skip", "test/e2e": "skip", "test/validate": "skip",
    "review/self-review": "YES", "review/security": "skip", "review/performance": "YES",
    "review/compliance": "skip", "review/handoff": "YES",
    "deploy/merge": "YES", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/summary": "YES", "wrap-up/knowledge": "YES",
  },
  feature: {
    "define/refine": "YES", "define/spec": "YES",
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "YES", "plan/scope": "YES",
    "plan/ux-flow": "if UI", "plan/architecture": "YES", "plan/blueprint": "YES", "plan/audit": "skip",
    "build/setup": "YES", "build/migration": "if DB", "build/red": "YES", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "skip", "build/integration": "YES", "build/commit": "YES",
    "test/verify": "YES", "test/browser": "if UI", "test/e2e": "if UI", "test/validate": "YES",
    "review/self-review": "YES", "review/security": "YES", "review/performance": "skip",
    "review/compliance": "YES", "review/handoff": "YES",
    "deploy/merge": "YES", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/summary": "YES", "wrap-up/knowledge": "YES",
  },
  "large-feature": {
    "define/refine": "YES", "define/spec": "YES",
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "YES", "plan/scope": "YES",
    "plan/ux-flow": "if UI", "plan/architecture": "YES", "plan/blueprint": "YES", "plan/audit": "YES",
    "build/setup": "YES", "build/migration": "if DB", "build/red": "YES", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "YES", "build/integration": "YES", "build/commit": "YES",
    "test/verify": "YES", "test/browser": "if UI", "test/e2e": "YES", "test/validate": "YES",
    "review/self-review": "YES", "review/security": "YES", "review/performance": "YES",
    "review/compliance": "YES", "review/handoff": "YES",
    "deploy/merge": "YES", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/summary": "YES", "wrap-up/knowledge": "YES",
  },
};

export function buildDefaultWorkflow(
  classification: Classification,
  overrides?: { include?: string[]; exclude?: string[] }
): WorkflowStep[] {
  const matrix = WORKFLOW_MATRIX[classification];
  const steps: WorkflowStep[] = [];

  const forceInclude = new Set(overrides?.include ?? []);
  const forceExclude = new Set(overrides?.exclude ?? []);

  for (const [key, rule] of Object.entries(matrix)) {
    const [phase, step] = key.split("/") as [PhaseName, string];
    let included = rule === "YES" || rule === "if UI" || rule === "if DB";
    if (forceInclude.has(key)) included = true;
    if (forceExclude.has(key)) included = false;
    // "skip" excluded by default, but project config may force-include
    if (rule === "skip" && !forceInclude.has(key)) continue;
    steps.push({ phase, step, included });
  }

  // Add any force-included steps not in the matrix
  for (const ref of forceInclude) {
    const [phase, step] = ref.split("/") as [PhaseName, string];
    if (!steps.some(s => s.phase === phase && s.step === step)) {
      steps.push({ phase, step, included: true });
    }
  }

  return steps;
}

export function buildFullWorkflow(): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  for (const phase of PHASE_ORDER) {
    for (const step of STEPS_BY_PHASE[phase]) {
      steps.push({ phase, step, included: true });
    }
  }
  return steps;
}
