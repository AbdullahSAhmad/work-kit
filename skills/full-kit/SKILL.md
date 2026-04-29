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

1. **Triage** (1 step) — Classify the request (bug-fix / small-change / refactor / feature / large-feature)
2. **Plan** (3 steps) — Understand (refine + spec for features, then criteria + investigation) → Design → Audit
3. **Build** (3 steps) — Setup → Implement → Commit
4. **Test** (2 steps) — Exercise (fans out 3 parallel lens sub-agents internally: Verify, E2E, Browser) → Validate (criteria mapping + verdict)
5. **Review** (3 steps) — Scope (classify diff, select lenses) → Review (4 parallel reviewer sub-agents: Quality, Efficiency, Security, Compliance) → Resolve (fix + ship decision)
6. **Deploy** (3 steps) — Merge → Monitor → Remediate
7. **Wrap-up** — Synthesize work-kit summary, clean up worktree

**Browser lens of `test/exercise`** uses the Chrome DevTools MCP server. If it isn't installed, `work-kit doctor` warns but does not block — the browser lens skips itself gracefully and the rest of Exercise still runs.

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

3. Continue with the execution loop below.

## Continuing Work (`/full-kit` with no args)

1. Run `work-kit bootstrap` to detect session state
2. Parse the JSON response:
   - If `active: false` — no session found, ask the user for a description and start new work
   - If `recovery` is set — report the recovery suggestion to the user before continuing
   - If `active: true` — report current state (slug, phase, step) to the user
3. `cd` into the worktree directory
4. Follow the execution loop below

## Execution Loop

The CLI is the source of truth for what runs next. You don't pick outcomes, parse classifications, or compute loopbacks — the CLI does. You just spawn the agent it asks for and run the bash it tells you to run.

```bash
work-kit run
```

Inspect the `action` field of the JSON response:

| `action`                | What you do |
|-------------------------|-------------|
| `spawn_agent`           | Use the Agent tool with `skillFile`, `agentPrompt`, and (if present) `model`. The agent writes a structured receipt to `receiptPath`. When the agent returns, run the bash in `after`. |
| `spawn_parallel_agents` | Spawn every agent in `agents[]` in a single message (so they run in parallel). Wait for all to finish. If `thenSequential` is present, spawn it next. Run `after`. |
| `spawn_debug_agent`     | A previous step reported `needs_debug`. Use the Agent tool with the wk-debug skill from `skillFile`. When it returns, run `after` — the originating step retries automatically. |
| `wait_for_user`         | Report `message` and stop. When the user says proceed, run `after`. (Gated mode only — non-gated sessions auto-proceed past phase boundaries.) |
| `loopback`              | Report `message` to the user. The CLI already routed; the next `work-kit run` will start at the loopback target. |
| `complete`              | Done. Spawn the wrap-up skill if it hasn't run yet. |
| `error`                 | Report `message` and `suggestion`. Stop. |

You never call `work-kit complete --outcome <X>`. The agent writes a structured receipt JSON; the CLI validates it and derives the outcome. You also never call `work-kit next` — `work-kit run` wraps both.

## Phase Prerequisites

Prerequisites are enforced by the CLI (`work-kit validate <phase>`). You don't need to check manually — the `next` command handles it.

| Phase    | Requires                          |
|----------|-----------------------------------|
| Triage   | — (first phase, always allowed)   |
| Plan     | Triage (complete)                 |
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
├── Agent: Triage (single agent, 1 step)
│   ├── reads: ## Description
│   ├── runs: Classify
│   └── writes: ### Triage: Final (classification, workflow plan)
│
├── Agent: Plan (single agent, all 3 steps)
│   ├── reads: ## Description, ### Triage: Final, ## Criteria, codebase
│   ├── runs: Understand → Design → Audit
│   └── writes: ### Plan: Final (Blueprint, Architecture, Scope, Constraints)
│
├── Agent: Build (single agent, all 3 steps)
│   ├── reads: ### Plan: Final, ## Criteria
│   ├── runs: Setup → Implement → Commit
│   └── writes: ### Build: Final (PR, files changed, test status, deviations)
│
├── Agent: Test (Exercise → Validate)
│   ├── reads: ### Build: Final, ### Plan: Final, ### Triage: Final, ## Criteria
│   ├── Exercise (sequential step that fans out up to 3 parallel lens sub-agents
│   │   via Agent tool, mirroring `simplify`'s pattern):
│   │     Sub-agent: Verify   ──┐ (always)
│   │     Sub-agent: E2E*     ──┤ (* if Playwright installed + classification opts in)
│   │     Sub-agent: Browser* ──┘ (* if Chrome DevTools MCP available + UI surface)
│   ├── then: Validate (aggregates lens outputs, maps criteria to evidence, writes verdict)
│   └── writes: ### Test: Final (results, criteria status, confidence)
│
├── Agent: Review (Scope → Review → Resolve)
│   ├── reads: ### Plan: Final, ### Build: Final, ### Test: Final, ## Criteria
│   ├── Scope (sequential — classifies diff, selects lenses, extracts scope boundaries)
│   ├── Review (sequential step that fans out 4 parallel reviewer sub-agents
│   │   via Agent tool, mirroring `simplify`'s pattern):
│   │     Sub-agent: Quality     ──┐ (always)
│   │     Sub-agent: Efficiency*  ──┤ (* = if Scope selected)
│   │     Sub-agent: Security*    ──┤
│   │     Sub-agent: Compliance*  ──┘
│   ├── then: Resolve (aggregates findings, fixes aggressively, makes ship/no-ship decision)
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
| Triage | Single agent | `haiku` | `## Description` |
| Plan | Single agent | `auto` | `## Description`, `### Triage: Final`, `## Criteria`, codebase |
| Build | Single agent | `auto` | `### Plan: Final`, `## Criteria` |
| Test: Exercise | Sequential (fans out up to 3 parallel sub-agents internally) | `auto` | `### Build: Final`, `### Plan: Final`, `### Plan: UX Flow`, `## Criteria` |
| Test: Validate | Sequential | `auto` | `### Test: Roundup`, all lens outputs (`Verify`, `E2E`, `Browser`), `## Criteria` |
| Review: Scope | Sequential | `haiku` | `### Plan: Final`, `### Build: Final`, git diff --stat |
| Review: Review | Sequential (fans out 4 parallel sub-agents internally) | `auto` | `### Plan: Final`, `### Build: Final`, `### Review: Scope`, `## Criteria`, git diff |
| Review: Resolve | Sequential | `auto` | `### Review: Scope`, `### Review: Roundup`, all lens outputs (`Quality`, `Efficiency`, `Security`, `Compliance`), `### Test: Final`, `## Criteria`, git diff |
| Deploy | Single agent | `auto` | `### Review: Final`, `### Build: Final` |
| Wrap-up | Single agent | `auto` | Full state.md |

### Phase Handoff via Final Sections

Each phase writes a `### <Phase>: Final` section — a self-contained summary of that phase's output. The next phase's agent reads **only** the Final sections it needs, not the step working notes.

```
state.md grows like this:
  ### Plan: Clarify        ← working notes (Understand step)
  ### Plan: Investigate    ← working notes (Understand step)
  ...
  ### Plan: Final          ← ★ Build agent reads this
  ### Build: Setup         ← working notes (Build agent internal)
  ### Build: Red           ← working notes (inside Implement step)
  ### Build: Core          ← working notes (inside Implement step)
  ...
  ### Build: Final         ← ★ Test agent reads this
  ### Test: Verify         ← working notes (Exercise lens)
  ### Test: E2E            ← working notes (Exercise lens)
  ### Test: Browser        ← working notes (Exercise lens)
  ### Test: Roundup        ← Exercise summary
  ### Test: Validate       ← working notes
  ### Test: Final          ← ★ Review agent reads this
  ...
```

## Phase Execution

For each phase:
1. **Check prerequisites** — verify the required prior phase is marked complete in state.md
2. **Spawn a fresh agent** for the phase — pass it the phase skill file and the relevant Final sections from state.md
3. The agent reads each step file when directed (e.g., `.claude/skills/wk-plan/steps/understand.md`)
4. The agent updates `.work-kit/state.md` after each step completes
5. The agent writes the `### <Phase>: Final` section before exiting
6. After the agent completes, summarize results to the user and wait for confirmation

## Loop-Back Rules

Some steps can route backwards based on their outcome:

- **Plan Audit** → "revise" → re-run Design
- **Review Handoff** → "changes_requested" → re-run Build (from Implement)
- **Deploy Merge** → "fix_needed" → re-run Build (from Implement)
- **Deploy Remediate** → "fix_and_redeploy" → re-run Build (from Implement)
*(Build's internal Red/Core/Refactor cycle self-recovers inside Implement — no phase-level loopback)*

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
