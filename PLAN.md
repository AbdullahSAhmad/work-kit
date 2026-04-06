# Plan: TypeScript Orchestrator for work-kit

## Context

The work-kit workflow is currently 100% prompt-based — markdown skill files that Claude reads and follows on good faith. Nothing enforces phase prerequisites, validates transitions, manages structured state, or coordinates parallel agents. This leads to fragile orchestration where Claude can skip steps, lose context, or spawn agents incorrectly.

The goal is to add a **TypeScript CLI** that acts as the state machine controller, while keeping the existing .md skill files as instructions for each agent.

## Architecture

**Script handles:** State machine, validation, context extraction, agent instruction generation
**Claude handles:** Spawning agents, running skill instructions, writing code, user interaction

### Interaction Model

Claude calls the CLI via Bash. The CLI returns JSON telling Claude exactly what to do next.

```
Claude: npx work-kit-cli init --mode full --description "add user avatar"
  → { action: "spawn_agent", phase: "plan", skillFile: "...", agentPrompt: "..." }

Claude: (spawns Plan agent using Agent tool)

Claude: npx work-kit-cli complete plan --outcome done
  → { action: "wait_for_user", message: "Plan complete. Proceed?" }

Claude: npx work-kit-cli next
  → { action: "spawn_agent", phase: "build", ... }
```

### CLI Commands

| Command | Purpose |
|---------|---------|
| `work-kit init --mode <full\|auto> --description "<text>"` | Create worktree, initialize state |
| `work-kit next` | Get the next action (spawn agent, wait, loopback, complete) |
| `work-kit complete <phase>/<step> [--outcome <value>]` | Mark step done, validate transition |
| `work-kit status` | Current state summary |
| `work-kit context <phase>` | Extract Final sections needed for a phase's agent |
| `work-kit loopback --from <src> --to <target> --reason "<text>"` | Register loop-back |
| `work-kit validate <phase>` | Check prerequisites |
| `work-kit workflow [--add/--remove]` | auto-kit: manage dynamic checklist |

### Dual State: JSON + Markdown

- **`.work-kit/tracker.json`** — source of truth for the state machine (phases, transitions, outcomes)
- **`.work-kit/state.md`** — source of truth for content (Final sections, working notes, criteria)

JSON enforces rules. Markdown carries the knowledge. Both live in the worktree.

### Parallel Agent Coordination

Test and Review phases spawn parallel sub-agents that could race on writing to state.md. Solution: each parallel sub-agent writes to its own file:
- `.work-kit/test-verify.md`, `.work-kit/test-e2e.md`
- `.work-kit/review-self.md`, `.work-kit/review-security.md`, etc.

The sequential follow-up agent (Validate, Handoff) or the `complete` command merges them into state.md.

## File Structure

```
work-kit/
  src/
    index.ts                    # CLI entry (commander)
    commands/
      init.ts                   # Create worktree + state
      next.ts                   # Core state machine step
      complete.ts               # Mark done, check loopbacks
      status.ts                 # Print current state
      context.ts                # Extract Final sections
      loopback.ts               # Register loop-back
      validate.ts               # Check prerequisites
      workflow.ts               # auto-kit dynamic checklist
    state/
      schema.ts                 # All TypeScript interfaces
      store.ts                  # Read/write tracker.json, find worktree
      validators.ts             # Prerequisite checks
    engine/
      phases.ts                 # Phase definitions + step ordering
      transitions.ts            # State machine transition logic
      loopbacks.ts              # Loop-back route definitions
      agent-specs.ts            # Per-phase agent spawn specs
      parallel.ts               # Parallel sub-agent coordination
    context/
      extractor.ts              # Parse ### Final sections from state.md
      prompt-builder.ts         # Build agent prompts from skill files + context
    config/
      phases.ts                 # Static: phase order, steps, prerequisites
      loopback-routes.ts        # Static: trigger→target map
      agent-map.ts              # Static: which agent reads which sections
  package.json
  tsconfig.json
  .claude/skills/               # Existing, updated minimally
    full-kit.md                 # Updated to call CLI
    auto-kit.md                 # Updated to call CLI
    ...                         # Step files stay mostly the same
```

## Key Types

```typescript
// State
interface WorkKitState {
  version: 1;
  slug: string;
  branch: string;
  started: string;
  mode: "full-kit" | "auto-kit";
  classification?: "bug-fix" | "small-change" | "refactor" | "feature" | "large-feature";
  status: "in-progress" | "paused" | "completed" | "failed";
  currentPhase: PhaseName | null;
  currentStep: string | null;
  phases: Record<PhaseName, PhaseState>;
  workflow?: WorkflowStep[];      // auto-kit only
  loopbacks: LoopbackRecord[];
  metadata: { worktreeRoot: string; mainRepoRoot: string };
}

type PhaseName = "plan" | "build" | "test" | "review" | "deploy" | "wrap-up";

interface PhaseState {
  status: "pending" | "in-progress" | "complete" | "skipped";
  startedAt?: string;
  completedAt?: string;
  steps: Record<string, StepState>;
}

interface StepState {
  status: "pending" | "in-progress" | "complete" | "skipped";
  startedAt?: string;
  completedAt?: string;
  agentType: "single" | "parallel-sub" | "sequential-after-parallel";
  outcome?: string;
}

interface WorkflowStep {
  phase: PhaseName;
  step: string;
  included: boolean;
  completed: boolean;
}

interface LoopbackRecord {
  timestamp: string;
  from: { phase: PhaseName; step: string };
  to: { phase: PhaseName; step: string };
  reason: string;
  iteration: number;
}

// Actions returned by CLI
type Action =
  | { action: "spawn_agent"; phase: string; step: string; skillFile: string; agentPrompt: string; onComplete: string }
  | { action: "spawn_parallel_agents"; agents: AgentSpec[]; thenSequential?: AgentSpec; onComplete: string }
  | { action: "wait_for_user"; message: string }
  | { action: "loopback"; from: Location; to: Location; reason: string }
  | { action: "complete"; message: string }
  | { action: "error"; message: string; suggestion?: string }
```

## Static Configuration

### Phase Prerequisites

```typescript
const PHASE_PREREQUISITES: Record<PhaseName, PhaseName[]> = {
  "plan": [],
  "build": ["plan"],
  "test": ["build"],
  "review": ["test"],
  "deploy": ["review"],       // + handoff.outcome === "approved"
  "wrap-up": ["review"],      // OR ["deploy"] if deploy was included
};
```

### Step Order Per Phase

```typescript
const PHASE_STEPS: Record<PhaseName, string[]> = {
  "plan": ["clarify", "investigate", "sketch", "scope", "ux-flow", "architecture", "blueprint", "audit"],
  "build": ["setup", "migration", "red", "core", "ui", "refactor", "integration", "commit"],
  "test": ["verify", "e2e", "validate"],
  "review": ["self-review", "security", "performance", "compliance", "handoff"],
  "deploy": ["merge", "monitor", "remediate"],
  "wrap-up": [],
};
```

### Loop-back Routes

```typescript
const LOOPBACK_ROUTES = [
  { trigger: { phase: "plan", step: "audit", outcome: "revise" },
    target: { phase: "plan", step: "blueprint" }, maxIterations: 2 },
  { trigger: { phase: "build", step: "refactor", outcome: "broken" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
  { trigger: { phase: "review", step: "handoff", outcome: "changes_requested" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
  { trigger: { phase: "deploy", step: "merge", outcome: "fix_needed" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
  { trigger: { phase: "deploy", step: "remediate", outcome: "fix_and_redeploy" },
    target: { phase: "build", step: "core" }, maxIterations: 2 },
];
```

### Agent Context Map (what each phase agent reads from state.md)

```typescript
const AGENT_CONTEXT: Record<PhaseName, { sections: string[]; additional?: string }> = {
  "plan": { sections: ["## Description", "## Criteria"] },
  "build": { sections: ["### Plan: Final", "## Criteria"] },
  "test": { sections: ["### Build: Final", "### Plan: Final", "## Criteria"] },
  "review": { sections: ["### Plan: Final", "### Build: Final", "### Test: Final", "## Criteria"], additional: "git diff main...HEAD" },
  "deploy": { sections: ["### Review: Final", "### Build: Final"] },
  "wrap-up": { sections: ["*"] },  // reads full state.md
};
```

### Parallel Sub-agent Groups

```typescript
const PARALLEL_GROUPS = {
  "test": {
    parallel: ["verify", "e2e"],
    thenSequential: "validate",
    outputFiles: { "verify": ".work-kit/test-verify.md", "e2e": ".work-kit/test-e2e.md" },
  },
  "review": {
    parallel: ["self-review", "security", "performance", "compliance"],
    thenSequential: "handoff",
    outputFiles: {
      "self-review": ".work-kit/review-self.md",
      "security": ".work-kit/review-security.md",
      "performance": ".work-kit/review-perf.md",
      "compliance": ".work-kit/review-compliance.md",
    },
  },
};
```

## Implementation Phases

### Phase 1: Foundation
- `package.json`, `tsconfig.json` (tsx runner, no build step)
- `src/state/schema.ts` — all types
- `src/config/phases.ts` — static phase definitions
- `src/state/store.ts` — find worktree, read/write tracker.json
- `src/commands/init.ts` — create worktree + tracker.json + state.md
- `src/commands/status.ts` — read and print state

### Phase 2: Core State Machine
- `src/state/validators.ts` — prerequisite checks
- `src/engine/transitions.ts` — transition logic
- `src/commands/next.ts` — the core loop
- `src/commands/complete.ts` — mark done, detect loopbacks
- `src/commands/validate.ts`

### Phase 3: Context & Prompts
- `src/context/extractor.ts` — parse state.md for ### sections
- `src/context/prompt-builder.ts` — compose agent prompts
- `src/engine/agent-specs.ts` — what each agent needs
- `src/commands/context.ts`

### Phase 4: Parallel Agents
- `src/engine/parallel.ts` — parallel group definitions
- Update `next.ts` to return `spawn_parallel_agents`
- Parallel output file merging in `complete.ts`

### Phase 5: Loop-backs & Auto-kit
- `src/config/loopback-routes.ts`
- `src/engine/loopbacks.ts`
- `src/commands/loopback.ts`
- `src/commands/workflow.ts`

### Phase 6: Skill File Updates
- Update `full-kit.md` and `auto-kit.md` to use CLI
- Add outcome reporting to step files
- End-to-end testing

## Skill File Changes

The orchestrator skills (`full-kit.md`, `auto-kit.md`) get updated to call the CLI:

```markdown
## How to Execute

1. Run `npx work-kit-cli next` to get the next action
2. Parse the JSON response
3. Follow the action type:
   - "spawn_agent": Use the Agent tool with the provided agentPrompt
   - "spawn_parallel_agents": Spawn all agents in parallel, wait, then spawn thenSequential
   - "wait_for_user": Report message and stop
   - "loopback": Report to user, then run `npx work-kit-cli next`
   - "complete": Done — run wrap-up
   - "error": Report and stop
4. After each agent completes: `npx work-kit-cli complete <phase>/<step> --outcome <outcome>`
5. Then `npx work-kit-cli next` again
```

Step .md files stay the same, with one addition: each ends with "Report your outcome" instruction.

## Verification

1. `npx work-kit-cli init --mode full --description "test feature"` → creates worktree + tracker.json
2. `npx work-kit-cli next` → returns spawn_agent for plan/clarify
3. `npx work-kit-cli complete plan/clarify` → advances to plan/investigate
4. `npx work-kit-cli validate build` → returns error (plan not complete)
5. Complete all plan steps → `npx work-kit-cli next` returns wait_for_user
6. `npx work-kit-cli next` → returns spawn_agent for build/setup
7. Test parallel: complete build → test phase returns spawn_parallel_agents with verify+e2e
8. Test loopback: `work-kit complete review/handoff --outcome changes_requested` → returns loopback action

## Dependencies

- `commander` — CLI argument parsing
- `tsx` — run TypeScript directly without build step
- `typescript` — type checking
- `@types/node` — Node.js type definitions

No other runtime dependencies. Uses only Node built-ins for file I/O, path resolution, and child process execution.
