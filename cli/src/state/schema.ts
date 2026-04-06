// ── Phase & Step Types ──────────────────────────────────────────────

export const PHASE_NAMES = ["plan", "build", "test", "review", "deploy", "wrap-up"] as const;
export type PhaseName = (typeof PHASE_NAMES)[number];

export const PLAN_STEPS = ["clarify", "investigate", "sketch", "scope", "ux-flow", "architecture", "blueprint", "audit"] as const;
export const BUILD_STEPS = ["setup", "migration", "red", "core", "ui", "refactor", "integration", "commit"] as const;
export const TEST_STEPS = ["verify", "e2e", "validate"] as const;
export const REVIEW_STEPS = ["self-review", "security", "performance", "compliance", "handoff"] as const;
export const DEPLOY_STEPS = ["merge", "monitor", "remediate"] as const;
export const WRAPUP_STEPS = ["wrap-up"] as const;

export type PlanStep = (typeof PLAN_STEPS)[number];
export type BuildStep = (typeof BUILD_STEPS)[number];
export type TestStep = (typeof TEST_STEPS)[number];
export type ReviewStep = (typeof REVIEW_STEPS)[number];
export type DeployStep = (typeof DEPLOY_STEPS)[number];
export type WrapUpStep = (typeof WRAPUP_STEPS)[number];

export type StepName = PlanStep | BuildStep | TestStep | ReviewStep | DeployStep | WrapUpStep;

export const STEPS_BY_PHASE: Record<PhaseName, readonly string[]> = {
  plan: PLAN_STEPS,
  build: BUILD_STEPS,
  test: TEST_STEPS,
  review: REVIEW_STEPS,
  deploy: DEPLOY_STEPS,
  "wrap-up": WRAPUP_STEPS,
};

// ── Mode Constants ──────────────────────────────────────────────────

export const MODE_FULL = "full-kit" as const;
export const MODE_AUTO = "auto-kit" as const;

// ── Classification ──────────────────────────────────────────────────

export type Classification = "bug-fix" | "small-change" | "refactor" | "feature" | "large-feature";

// ── Phase & Step State ──────────────────────────────────────────────

export type PhaseStatus = "pending" | "in-progress" | "completed" | "skipped";
export type StepStatus = "pending" | "in-progress" | "completed" | "skipped" | "waiting";

export interface StepState {
  status: StepStatus;
  outcome?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PhaseState {
  status: PhaseStatus;
  steps: Record<string, StepState>;
  startedAt?: string;
  completedAt?: string;
}

// ── Loopback ────────────────────────────────────────────────────────

export interface Location {
  phase: PhaseName;
  step: string;
}

export interface LoopbackRecord {
  from: Location;
  to: Location;
  reason: string;
  timestamp: string;
}

// ── Workflow (auto-kit) ─────────────────────────────────────────────

export interface WorkflowStep {
  phase: PhaseName;
  step: string;
  included: boolean;
}

// ── Main State ──────────────────────────────────────────────────────

export interface WorkKitState {
  version: 2;
  slug: string;
  branch: string;
  started: string;
  mode: "full-kit" | "auto-kit";
  gated?: boolean;
  classification?: Classification;
  status: "in-progress" | "paused" | "completed" | "failed";
  currentPhase: PhaseName | null;
  currentStep: string | null;
  phases: Record<PhaseName, PhaseState>;
  workflow?: WorkflowStep[];
  loopbacks: LoopbackRecord[];
  metadata: {
    worktreeRoot: string;
    mainRepoRoot: string;
  };
}

// ── Actions (CLI → Claude) ──────────────────────────────────────────

export interface AgentSpec {
  phase: PhaseName;
  step: string;
  skillFile: string;
  agentPrompt: string;
  outputFile?: string;
}

export type Action =
  | { action: "spawn_agent"; phase: PhaseName; step: string; skillFile: string; agentPrompt: string; onComplete: string }
  | { action: "spawn_parallel_agents"; agents: AgentSpec[]; thenSequential?: AgentSpec; onComplete: string }
  | { action: "wait_for_user"; message: string }
  | { action: "loopback"; from: Location; to: Location; reason: string }
  | { action: "complete"; message: string }
  | { action: "error"; message: string; suggestion?: string };
