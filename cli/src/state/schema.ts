// ── Phase & Step Types ──────────────────────────────────────────────

export const PHASE_NAMES = ["triage", "plan", "build", "test", "review", "deploy", "wrap-up"] as const;
export type PhaseName = (typeof PHASE_NAMES)[number];

export const TRIAGE_STEPS = ["classify"] as const;
export const PLAN_STEPS = ["understand", "design", "audit"] as const;
export const BUILD_STEPS = ["setup", "implement", "commit"] as const;
export const TEST_STEPS = ["exercise", "validate"] as const;
export const REVIEW_STEPS = ["scope", "review", "resolve"] as const;
export const DEPLOY_STEPS = ["ship"] as const;
export const WRAPUP_STEPS = ["finalize"] as const;

export type TriageStep = (typeof TRIAGE_STEPS)[number];
export type PlanStep = (typeof PLAN_STEPS)[number];
export type BuildStep = (typeof BUILD_STEPS)[number];
export type TestStep = (typeof TEST_STEPS)[number];
export type ReviewStep = (typeof REVIEW_STEPS)[number];
export type DeployStep = (typeof DEPLOY_STEPS)[number];
export type WrapUpStep = (typeof WRAPUP_STEPS)[number];

export type StepName = TriageStep | PlanStep | BuildStep | TestStep | ReviewStep | DeployStep | WrapUpStep;

export const STEPS_BY_PHASE: Record<PhaseName, readonly string[]> = {
  triage: TRIAGE_STEPS,
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

export const CLASSIFICATIONS = ["bug-fix", "small-change", "refactor", "feature", "large-feature"] as const;
export type Classification = (typeof CLASSIFICATIONS)[number];

export function isClassification(value: string): value is Classification {
  return (CLASSIFICATIONS as readonly string[]).includes(value);
}

// ── Model Routing ───────────────────────────────────────────────────

/**
 * Concrete model tier a phase/step can be routed to.
 * "inherit" is not a tier — see ModelPolicy for that.
 */
export const MODEL_TIERS = ["haiku", "sonnet", "opus"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export function isModelTier(value: string): value is ModelTier {
  return (MODEL_TIERS as readonly string[]).includes(value);
}

/**
 * Session-wide model policy set once at init time.
 *
 * - "auto"     — use work-kit's step-level routing (BY_STEP + BY_PHASE + classification)
 * - "opus" | "sonnet" | "haiku" — force that tier for every agent, no exceptions
 * - "inherit"  — emit no model field; let Claude Code's default pick (pre-change behavior)
 *
 * Per-step workspace/user JSON overrides still win over the policy.
 */
export const MODEL_POLICIES = ["auto", "opus", "sonnet", "haiku", "inherit"] as const;
export type ModelPolicy = (typeof MODEL_POLICIES)[number];

export function isModelPolicy(value: string): value is ModelPolicy {
  return (MODEL_POLICIES as readonly string[]).includes(value);
}

// ── Step Outcomes ───────────────────────────────────────────────────

/**
 * Closed set of outcomes a step can report when completing.
 * Outcomes drive loop-back routing (see config/loopback-routes.ts).
 */
export const STEP_OUTCOMES = [
  "done", // generic success
  "ok", // alias for done
  "proceed", // explicit "no loopback, advance"
  "approved", // review/resolve cleared for deploy
  "revise", // audit / review found gaps; loop back to fix
  "broken", // refactor or change broke something downstream
  "changes_requested", // review resolve requested changes
  "fix_needed", // deploy/ship blocked or fix-forward needed; loop back to build/implement
  "needs_debug", // step hit an error it can't resolve — invoke wk-debug, then return
  "blocked", // step cannot proceed without external input
  "skipped", // step intentionally skipped at runtime
] as const;
export type StepOutcome = (typeof STEP_OUTCOMES)[number];

export function isStepOutcome(value: string): value is StepOutcome {
  return (STEP_OUTCOMES as readonly string[]).includes(value);
}

// ── Phase & Step State ──────────────────────────────────────────────

export type PhaseStatus = "pending" | "in-progress" | "completed" | "skipped";
export type StepStatus = "pending" | "in-progress" | "completed" | "skipped" | "waiting";

export interface StepState {
  status: StepStatus;
  outcome?: StepOutcome;
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
  /** "debug" loopbacks are virtual: the agent spawns wk-debug then retries the same step. */
  kind?: "standard" | "debug";
}

// ── Workflow (auto-kit) ─────────────────────────────────────────────

export interface WorkflowStep {
  phase: PhaseName;
  step: string;
  included: boolean;
}

// ── Work Status ─────────────────────────────────────────────────────

export type WorkStatus = "in-progress" | "paused" | "completed" | "failed";

// ── Main State ──────────────────────────────────────────────────────

export interface WorkKitState {
  version: 4;
  slug: string;
  branch: string;
  started: string;
  mode: typeof MODE_FULL | typeof MODE_AUTO;
  gated?: boolean;
  classification?: Classification;
  status: WorkStatus;
  /** Session-wide model policy, set once at init. Defaults to "auto". */
  modelPolicy?: ModelPolicy;
  /** ISO timestamp the work was paused; cleared on resume. */
  pausedAt?: string;
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
  /** Resolved model tier for this agent. Omitted when policy is "inherit". */
  model?: ModelTier;
  /** Path the agent must write its structured receipt JSON to before reporting done. */
  receiptPath?: string;
}

export type Action =
  | {
      action: "spawn_agent";
      phase: PhaseName;
      step: string;
      skillFile: string;
      agentPrompt: string;
      onComplete: string;
      model?: ModelTier;
      receiptPath?: string;
    }
  | { action: "spawn_parallel_agents"; agents: AgentSpec[]; thenSequential?: AgentSpec; onComplete: string }
  | {
      action: "spawn_debug_agent";
      origin: Location;
      iteration: number;
      skillFile: string;
      agentPrompt: string;
      onComplete: string;
      model?: ModelTier;
    }
  | { action: "wait_for_user"; message: string }
  | { action: "loopback"; from: Location; to: Location; reason: string }
  | { action: "complete"; message: string }
  | { action: "paused"; message: string }
  | { action: "resumed"; message: string; phase: PhaseName | null; step: string | null; worktreeRoot?: string }
  | { action: "select_session"; message: string; sessions: ResumableSessionSummary[] }
  | { action: "error"; message: string; suggestion?: string };

export interface ResumableSessionSummary {
  slug: string;
  branch: string;
  worktreeRoot: string;
  status: Extract<WorkStatus, "paused" | "in-progress">;
  pausedAt?: string;
  currentPhase: string | null;
  currentStep: string | null;
  // Snapshot of how long ago tracker.json was last written, captured at
  // CLI invocation. Lets the agent surface "closed by mistake" sessions.
  lastUpdatedAgoMs: number;
}
