import {
  PhaseName,
  SUBSTAGES_BY_PHASE,
  Classification,
  WorkflowStep,
} from "../state/schema.js";

// ── Phase Order ──────────────────────────────────────────────────────

export const PHASE_ORDER: PhaseName[] = ["plan", "build", "test", "review", "deploy", "wrap-up"];

// ── Prerequisites ────────────────────────────────────────────────────

export const PHASE_PREREQUISITES: Record<PhaseName, PhaseName | null> = {
  plan: null,
  build: "plan",
  test: "build",
  review: "test",
  deploy: "review",
  "wrap-up": "review", // or deploy if deploy was included
};

// ── Skill File Paths ─────────────────────────────────────────────────

export function skillFilePath(phase: PhaseName, subStage?: string): string {
  if (phase === "wrap-up") return ".claude/skills/wrap-up.md";
  if (!subStage) return `.claude/skills/${phase}.md`;
  return `.claude/skills/${phase}/${subStage}.md`;
}

// ── Auto-kit Default Workflows ───────────────────────────────────────

type InclusionRule = "YES" | "skip" | "if UI" | "if DB" | "optional";

const WORKFLOW_MATRIX: Record<Classification, Record<string, InclusionRule>> = {
  "bug-fix": {
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "skip", "plan/scope": "skip",
    "plan/ux-flow": "skip", "plan/architecture": "skip", "plan/blueprint": "skip", "plan/audit": "skip",
    "build/setup": "skip", "build/migration": "skip", "build/red": "YES", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "skip", "build/integration": "skip", "build/commit": "YES",
    "test/verify": "YES", "test/e2e": "skip", "test/validate": "YES",
    "review/self-review": "YES", "review/security": "skip", "review/performance": "skip",
    "review/compliance": "skip", "review/handoff": "YES",
    "deploy/merge": "optional", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/wrap-up": "YES",
  },
  "small-change": {
    "plan/clarify": "YES", "plan/investigate": "skip", "plan/sketch": "skip", "plan/scope": "skip",
    "plan/ux-flow": "skip", "plan/architecture": "skip", "plan/blueprint": "skip", "plan/audit": "skip",
    "build/setup": "skip", "build/migration": "skip", "build/red": "skip", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "skip", "build/integration": "skip", "build/commit": "YES",
    "test/verify": "YES", "test/e2e": "skip", "test/validate": "skip",
    "review/self-review": "YES", "review/security": "skip", "review/performance": "skip",
    "review/compliance": "skip", "review/handoff": "YES",
    "deploy/merge": "optional", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/wrap-up": "YES",
  },
  refactor: {
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "skip", "plan/scope": "skip",
    "plan/ux-flow": "skip", "plan/architecture": "skip", "plan/blueprint": "skip", "plan/audit": "skip",
    "build/setup": "skip", "build/migration": "skip", "build/red": "skip", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "YES", "build/integration": "skip", "build/commit": "YES",
    "test/verify": "YES", "test/e2e": "skip", "test/validate": "skip",
    "review/self-review": "YES", "review/security": "skip", "review/performance": "YES",
    "review/compliance": "skip", "review/handoff": "YES",
    "deploy/merge": "optional", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/wrap-up": "YES",
  },
  feature: {
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "YES", "plan/scope": "YES",
    "plan/ux-flow": "if UI", "plan/architecture": "YES", "plan/blueprint": "YES", "plan/audit": "skip",
    "build/setup": "YES", "build/migration": "if DB", "build/red": "YES", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "skip", "build/integration": "YES", "build/commit": "YES",
    "test/verify": "YES", "test/e2e": "if UI", "test/validate": "YES",
    "review/self-review": "YES", "review/security": "YES", "review/performance": "skip",
    "review/compliance": "YES", "review/handoff": "YES",
    "deploy/merge": "optional", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/wrap-up": "YES",
  },
  "large-feature": {
    "plan/clarify": "YES", "plan/investigate": "YES", "plan/sketch": "YES", "plan/scope": "YES",
    "plan/ux-flow": "if UI", "plan/architecture": "YES", "plan/blueprint": "YES", "plan/audit": "YES",
    "build/setup": "YES", "build/migration": "if DB", "build/red": "YES", "build/core": "YES",
    "build/ui": "if UI", "build/refactor": "YES", "build/integration": "YES", "build/commit": "YES",
    "test/verify": "YES", "test/e2e": "YES", "test/validate": "YES",
    "review/self-review": "YES", "review/security": "YES", "review/performance": "YES",
    "review/compliance": "YES", "review/handoff": "YES",
    "deploy/merge": "optional", "deploy/monitor": "optional", "deploy/remediate": "optional",
    "wrap-up/wrap-up": "YES",
  },
};

export function buildDefaultWorkflow(classification: Classification): WorkflowStep[] {
  const matrix = WORKFLOW_MATRIX[classification];
  const steps: WorkflowStep[] = [];

  for (const [key, rule] of Object.entries(matrix)) {
    const [phase, subStage] = key.split("/") as [PhaseName, string];
    // "YES" always included, "skip" excluded, conditional ones included by default (user can remove)
    const included = rule === "YES" || rule === "if UI" || rule === "if DB";
    if (rule !== "skip") {
      steps.push({ phase, subStage, included });
    }
  }

  return steps;
}

export function buildFullWorkflow(): WorkflowStep[] {
  const steps: WorkflowStep[] = [];
  for (const phase of PHASE_ORDER) {
    for (const subStage of SUBSTAGES_BY_PHASE[phase]) {
      // Deploy is optional by default
      const included = phase !== "deploy";
      steps.push({ phase, subStage, included });
    }
  }
  return steps;
}
