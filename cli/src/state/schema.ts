// ── Phase & Sub-stage Types ──────────────────────────────────────────

export const PHASE_NAMES = ["plan", "build", "test", "review", "deploy", "wrap-up"] as const;
export type PhaseName = (typeof PHASE_NAMES)[number];

export const PLAN_SUBSTAGES = ["clarify", "investigate", "sketch", "scope", "ux-flow", "architecture", "blueprint", "audit"] as const;
export const BUILD_SUBSTAGES = ["setup", "migration", "red", "core", "ui", "refactor", "integration", "commit"] as const;
export const TEST_SUBSTAGES = ["verify", "e2e", "validate"] as const;
export const REVIEW_SUBSTAGES = ["self-review", "security", "performance", "compliance", "handoff"] as const;
export const DEPLOY_SUBSTAGES = ["merge", "monitor", "remediate"] as const;
export const WRAPUP_SUBSTAGES = ["wrap-up"] as const;

export type PlanSubStage = (typeof PLAN_SUBSTAGES)[number];
export type BuildSubStage = (typeof BUILD_SUBSTAGES)[number];
export type TestSubStage = (typeof TEST_SUBSTAGES)[number];
export type ReviewSubStage = (typeof REVIEW_SUBSTAGES)[number];
export type DeploySubStage = (typeof DEPLOY_SUBSTAGES)[number];
export type WrapUpSubStage = (typeof WRAPUP_SUBSTAGES)[number];

export type SubStageName = PlanSubStage | BuildSubStage | TestSubStage | ReviewSubStage | DeploySubStage | WrapUpSubStage;

export const SUBSTAGES_BY_PHASE: Record<PhaseName, readonly string[]> = {
  plan: PLAN_SUBSTAGES,
  build: BUILD_SUBSTAGES,
  test: TEST_SUBSTAGES,
  review: REVIEW_SUBSTAGES,
  deploy: DEPLOY_SUBSTAGES,
  "wrap-up": WRAPUP_SUBSTAGES,
};

// ── Classification ───────────────────────────────────────────────────

export type Classification = "bug-fix" | "small-change" | "refactor" | "feature" | "large-feature";

// ── Phase & Sub-stage State ──────────────────────────────────────────

export type PhaseStatus = "pending" | "in-progress" | "completed" | "skipped";
export type SubStageStatus = "pending" | "in-progress" | "completed" | "skipped";

export interface SubStageState {
  status: SubStageStatus;
  outcome?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface PhaseState {
  status: PhaseStatus;
  subStages: Record<string, SubStageState>;
  startedAt?: string;
  completedAt?: string;
}

// ── Loopback ─────────────────────────────────────────────────────────

export interface Location {
  phase: PhaseName;
  subStage: string;
}

export interface LoopbackRecord {
  from: Location;
  to: Location;
  reason: string;
  timestamp: string;
}

// ── Workflow (auto-kit) ──────────────────────────────────────────────

export interface WorkflowStep {
  phase: PhaseName;
  subStage: string;
  included: boolean;
}

// ── Main State ───────────────────────────────────────────────────────

export interface WorkKitState {
  version: 1;
  slug: string;
  branch: string;
  started: string;
  mode: "full-kit" | "auto-kit";
  gated?: boolean;
  classification?: Classification;
  status: "in-progress" | "paused" | "completed" | "failed";
  currentPhase: PhaseName | null;
  currentSubStage: string | null;
  phases: Record<PhaseName, PhaseState>;
  workflow?: WorkflowStep[];
  loopbacks: LoopbackRecord[];
  metadata: {
    worktreeRoot: string;
    mainRepoRoot: string;
  };
}

// ── Actions (CLI → Claude) ───────────────────────────────────────────

export interface AgentSpec {
  phase: PhaseName;
  subStage: string;
  skillFile: string;
  agentPrompt: string;
  outputFile?: string; // for parallel agents writing to separate files
}

export type Action =
  | { action: "spawn_agent"; phase: PhaseName; subStage: string; skillFile: string; agentPrompt: string; onComplete: string }
  | { action: "spawn_parallel_agents"; agents: AgentSpec[]; thenSequential?: AgentSpec; onComplete: string }
  | { action: "wait_for_user"; message: string }
  | { action: "loopback"; from: Location; to: Location; reason: string }
  | { action: "complete"; message: string }
  | { action: "error"; message: string; suggestion?: string };
