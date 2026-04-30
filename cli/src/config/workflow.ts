import { Classification, PHASE_NAMES, PhaseName, STEPS_BY_PHASE, WorkflowStep } from "../state/schema.js";
import { SKILL_DIR_PREFIX } from "./constants.js";

// ── Phase Order ─────────────────────────────────────────────────────

export const PHASE_ORDER: PhaseName[] = [...PHASE_NAMES];

// ── Prerequisites ───────────────────────────────────────────────────

export const PHASE_PREREQUISITES: Record<PhaseName, PhaseName | null> = {
  triage: null,
  plan: "triage",
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
    "triage/classify": "YES",
    "plan/understand": "YES",
    "plan/design": "skip",
    "plan/audit": "skip",
    "build/setup": "skip",
    "build/implement": "YES",
    "build/commit": "YES",
    "test/exercise": "YES",
    "test/validate": "YES",
    "review/scope": "YES",
    "review/review": "YES",
    "review/resolve": "YES",
    "deploy/ship": "YES",
    "wrap-up/finalize": "YES",
  },
  "small-change": {
    "triage/classify": "YES",
    "plan/understand": "YES",
    "plan/design": "skip",
    "plan/audit": "skip",
    "build/setup": "skip",
    "build/implement": "YES",
    "build/commit": "YES",
    "test/exercise": "YES",
    "test/validate": "skip",
    "review/scope": "YES",
    "review/review": "YES",
    "review/resolve": "YES",
    "deploy/ship": "YES",
    "wrap-up/finalize": "YES",
  },
  refactor: {
    "triage/classify": "YES",
    "plan/understand": "YES",
    "plan/design": "skip",
    "plan/audit": "skip",
    "build/setup": "skip",
    "build/implement": "YES",
    "build/commit": "YES",
    "test/exercise": "YES",
    "test/validate": "skip",
    "review/scope": "YES",
    "review/review": "YES",
    "review/resolve": "YES",
    "deploy/ship": "YES",
    "wrap-up/finalize": "YES",
  },
  feature: {
    "triage/classify": "YES",
    "plan/understand": "YES",
    "plan/design": "YES",
    "plan/audit": "skip",
    "build/setup": "YES",
    "build/implement": "YES",
    "build/commit": "YES",
    "test/exercise": "YES",
    "test/validate": "YES",
    "review/scope": "YES",
    "review/review": "YES",
    "review/resolve": "YES",
    "deploy/ship": "YES",
    "wrap-up/finalize": "YES",
  },
  "large-feature": {
    "triage/classify": "YES",
    "plan/understand": "YES",
    "plan/design": "YES",
    "plan/audit": "YES",
    "build/setup": "YES",
    "build/implement": "YES",
    "build/commit": "YES",
    "test/exercise": "YES",
    "test/validate": "YES",
    "review/scope": "YES",
    "review/review": "YES",
    "review/resolve": "YES",
    "deploy/ship": "YES",
    "wrap-up/finalize": "YES",
  },
};

export function buildDefaultWorkflow(
  classification: Classification,
  overrides?: { include?: string[]; exclude?: string[] },
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
    if (!steps.some((s) => s.phase === phase && s.step === step)) {
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
