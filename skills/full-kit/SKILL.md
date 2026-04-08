---
name: full-kit
description: "Full pipeline for feature development. Runs all phases and steps in order. Usage: /full-kit <description> to start, /full-kit to continue."
user-invocable: true
argument-hint: "[--gated] [--opus|--sonnet|--haiku|--inherit] [description]"
allowed-tools: Agent, Bash, Read, Write, Edit, Glob, Grep
---

You are the **Work Orchestrator (Full Mode)**. You run the complete lifecycle of a feature through every phase and step. No shortcuts.

Best for: large features, new systems, or when you want maximum rigor.

## Prerequisites

Before starting, verify the CLI is installed:
```bash
work-kit doctor
```

If `work-kit` is not found, ask the user to install it:
> work-kit CLI is required but not installed. Install it with: `npm install -g work-kit-cli`

Do not proceed until `doctor` reports all checks passed.

## Phases

1. **Define** (2 steps) — Refine → Spec  *(catches vague asks before Plan investigates)*
2. **Plan** (8 steps) — Clarify → Investigate → Sketch → Scope → UX Flow → Architecture → Blueprint → Audit
3. **Build** (8 steps) — Setup → Migration → Red → Core → UI → Refactor → Integration → Commit
4. **Test** (4 steps) — Verify, E2E, Browser (parallel) → Validate
5. **Review** (5 steps) — Self-Review → Security → Performance → Compliance → Handoff
6. **Deploy** (3 steps) — Merge → Monitor → Remediate
7. **Wrap-up** — Synthesize work-kit summary, clean up worktree

**Browser test step** uses the Chrome DevTools MCP server. If it isn't installed, `work-kit doctor` warns but does not block — the browser step is skipped gracefully.

**Debug recovery:** any step can report outcome `needs_debug` when it hits an error it can't resolve. The CLI will automatically spawn the **wk-debug** skill (5-step triage), then the originating step retries. Max 2 debug attempts per step before surfacing to you.

## Starting New Work (`/full-kit <description>`)

1. Parse flags out of the user's input before building the init command:
   - `--gated` → append `--gated` to init
   - `--opus` → append `--model-policy opus`
   - `--sonnet` → append `--model-policy sonnet`
   - `--haiku` → append `--model-policy haiku`
   - `--inherit` → append `--model-policy inherit` (no model override; lets Claude Code's default pick)
   - No model flag → omit `--model-policy` (defaults to `auto` = work-kit step-level routing)

   Strip any recognized flags from the description text before passing it through. Only one model flag may be set at a time — if the user passes more than one, report the conflict and stop.

2. Create a git worktree and initialize state:
   ```bash
   git worktree add worktrees/<slug> -b feature/<slug>
   cd worktrees/<slug>
   work-kit init --mode full --description "<description>" [--gated] [--model-policy <value>]
   ```

   Examples:
   ```
   /full-kit add user avatar              → work-kit init --mode full --description "add user avatar"
   /full-kit --opus add user avatar       → work-kit init --mode full --description "add user avatar" --model-policy opus
   /full-kit --gated --inherit fix login  → work-kit init --mode full --description "fix login" --gated --model-policy inherit
   ```

3. Parse the JSON response and follow the action
4. Continue with the execution loop below

## Continuing Work (`/full-kit` with no args)

1. Run `work-kit bootstrap` to detect session state
2. Parse the JSON response:
   - If `active: false` — no session found, ask the user for a description and start new work
   - If `recovery` is set — report the recovery suggestion to the user before continuing
   - If `active: true` — report current state (slug, phase, step) to the user
3. `cd` into the worktree directory
4. Run `work-kit next` to get the next action
5. Follow the execution loop below

## Execution Loop

The CLI manages all state transitions, prerequisites, and loopbacks. Follow this loop:

1. Run `work-kit next` to get the next action
2. Parse the JSON response
3. Follow the action type:
   - **`spawn_agent`**: Use the Agent tool with the provided `agentPrompt`. Pass `skillFile` path for reference. **If the action includes a `model` field, pass it as the Agent tool's `model` parameter; if the field is absent, do not set `model` (let Claude Code's default pick).** After the agent completes: `work-kit complete <phase>/<step> --outcome <outcome>`
   - **`spawn_parallel_agents`**: Spawn all agents in the `agents` array in parallel using the Agent tool. **For each agent, pass its `model` field as the Agent tool's `model` parameter when present; omit when absent.** Wait for all to complete. Then spawn `thenSequential` if provided (same rule for its `model` field). After all complete: `work-kit complete <onComplete target>`
   - **`spawn_debug_agent`**: A previous step reported `needs_debug`. Spawn the **wk-debug** skill via the Agent tool with the provided `agentPrompt` and `skillFile`. Use the `model` field if present. Do **not** call `work-kit complete` for the debug agent — when it finishes writing its `.work-kit/debug-*.md` file, simply run `work-kit next` and the originating step will retry automatically.
   - **`wait_for_user`**: Report the message to the user and stop. Wait for them to say "proceed" before running `work-kit next` again. (Only appears in `--gated` mode.)
   - **`loopback`**: Report the loopback to the user, then run `work-kit next` to continue from the target.
   - **`complete`**: Done — run wrap-up if not already done.
   - **`error`**: Report the error and suggestion to the user. Stop.
4. After each agent completes: `work-kit complete <phase>/<step> --outcome <outcome>`
5. Then `work-kit next` again to continue

## Phase Prerequisites

Prerequisites are enforced by the CLI (`work-kit validate <phase>`). You don't need to check manually — the `next` command handles it.

| Phase    | Requires                          |
|----------|-----------------------------------|
| Define   | — (first phase, always allowed)   |
| Plan     | Define (complete or skipped)      |
| Build    | Plan (complete)                   |
| Test     | Build (complete)                  |
| Review   | Test (complete)                   |
| Deploy   | Review (complete), Handoff = approved |
| Wrap-up  | Review (complete) or Deploy (complete) |

## Agent Architecture

Each phase runs as a **fresh agent** (sub-agent spawned by the orchestrator). This keeps context focused — the Build agent doesn't carry Plan's investigation notes, the Review agent doesn't carry Build's implementation context.

```
Orchestrator (main agent — you)
│
├── Agent: Plan (single agent, all 8 steps)
│   ├── reads: ## Description, ## Criteria, codebase
│   ├── runs: Clarify → Investigate → ... → Audit
│   └── writes: ### Plan: Final (Blueprint, Architecture, Scope, Constraints)
│
├── Agent: Build (single agent, all 8 steps)
│   ├── reads: ### Plan: Final, ## Criteria
│   ├── runs: Setup → Migration → ... → Commit
│   └── writes: ### Build: Final (PR, files changed, test status, deviations)
│
├── Agent: Test (orchestrates 2 parallel + 1 sequential)
│   ├── reads: ### Build: Final, ### Plan: Final, ## Criteria
│   ├── Sub-agent: Verify  ──┐ (parallel)
│   ├── Sub-agent: E2E     ──┘
│   ├── then: Validate (after both complete)
│   └── writes: ### Test: Final (results, criteria status, confidence)
│
├── Agent: Review (orchestrates 4 parallel + 1 sequential)
│   ├── reads: ### Plan: Final, ### Build: Final, ### Test: Final, ## Criteria
│   ├── Sub-agent: Self-Review  ──┐
│   ├── Sub-agent: Security     ──┤ (all 4 parallel)
│   ├── Sub-agent: Performance  ──┤
│   ├── Sub-agent: Compliance   ──┘
│   ├── then: Handoff (reads all 4 results → ship decision)
│   └── writes: ### Review: Final (decision, issues, concerns)
│
├── Agent: Deploy (single agent, all 3 steps)
│   ├── reads: ### Review: Final, ### Build: Final
│   ├── runs: Merge → Monitor → Remediate
│   └── writes: ### Deploy: Final (merge/deploy status)
│
└── Agent: Wrap-up (single agent)
    ├── reads: full state.md
    └── writes: summary + archive
```

### Agent Spawn Rules

| Phase | Agent type | Mode | What it reads from state.md |
|-------|-----------|------|----------------------------|
| Plan | Single agent | `auto` | `## Description`, `## Criteria`, codebase |
| Build | Single agent | `auto` | `### Plan: Final`, `## Criteria` |
| Test: Verify | Sub-agent | `auto` | `### Build: Final`, `## Criteria` |
| Test: E2E | Sub-agent | `auto` | `### Build: Final`, `### Plan: Final` |
| Test: Validate | Single agent | `auto` | `### Test: Verify`, `### Test: E2E`, `## Criteria` |
| Review: Self-Review | Sub-agent | `auto` | `### Build: Final`, git diff |
| Review: Security | Sub-agent | `auto` | `### Build: Final`, git diff |
| Review: Performance | Sub-agent | `auto` | `### Build: Final`, git diff |
| Review: Compliance | Sub-agent | `auto` | `### Plan: Final`, `### Build: Final`, git diff |
| Review: Handoff | Single agent | `auto` | All `### Review:` sections, `### Test: Final`, `## Criteria` |
| Deploy | Single agent | `auto` | `### Review: Final`, `### Build: Final` |
| Wrap-up | Single agent | `auto` | Full state.md |

### Phase Handoff via Final Sections

Each phase writes a `### <Phase>: Final` section — a self-contained summary of that phase's output. The next phase's agent reads **only** the Final sections it needs, not the step working notes.

```
state.md grows like this:
  ### Plan: Clarify        ← working notes (Plan agent internal)
  ### Plan: Investigate    ← working notes (Plan agent internal)
  ...
  ### Plan: Final          ← ★ Build agent reads this
  ### Build: Setup         ← working notes (Build agent internal)
  ### Build: Core          ← working notes (Build agent internal)
  ...
  ### Build: Final         ← ★ Test agent reads this
  ### Test: Verify         ← working notes
  ### Test: E2E            ← working notes
  ### Test: Final          ← ★ Review agent reads this
  ...
```

## Phase Execution

For each phase:
1. **Check prerequisites** — verify the required prior phase is marked complete in state.md
2. **Spawn a fresh agent** for the phase — pass it the phase skill file and the relevant Final sections from state.md
3. The agent reads each step file when directed (e.g., `.claude/skills/wk-plan/steps/clarify.md`)
4. The agent updates `.work-kit/state.md` after each step completes
5. The agent writes the `### <Phase>: Final` section before exiting
6. After the agent completes, summarize results to the user and wait for confirmation

## Loop-Back Rules

Some steps can route backwards based on their outcome:

- **Plan Audit** → "revise" → re-run Blueprint
- **Build Refactor** → "broken" → re-run Core
- **Review Handoff** → "changes_requested" → re-run Build (from Core)
- **Deploy Merge** → "fix_needed" → re-run Build (from Core)
- **Deploy Remediate** → "fix_and_redeploy" → re-run Build (from Core)

On loop-back: add a `## Loop-back context` section to state.md with what needs to change and why, then resume at the target step.

## Completion

When all phases are done (or deploy is skipped):

Run **Wrap-up** — read `.claude/skills/wk-wrap-up/SKILL.md` and follow its instructions. It handles writing the work-kit summary, committing it, and cleaning up the worktree.

**Deploy and Wrap-up are MANDATORY.** Deploy handles syncing, PR creation, and merging — fully autonomous, no user confirmation needed. Wrap-up archives the work history so past work is discoverable in future sessions. Always spawn real agents for both — never just mark them complete or skip them.

## Important

- **Always work inside the worktree directory** — `cd worktrees/<slug>` before running any commands
- **Commit state after each phase** — `git add .work-kit/ && git commit -m "work-kit: complete <phase>"`
- **Don't skip phases** — even if a phase seems unnecessary, run it and let it determine "nothing to do"
- **Auto-proceed by default** — phases flow continuously unless `--gated` was passed at init, in which case stop between phases for user approval
- **One feature per session** — each session handles a single feature. To work on multiple features in parallel, use separate terminal sessions
