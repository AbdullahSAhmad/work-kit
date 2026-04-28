---
name: auto-kit
description: "Smart pipeline that analyzes the request and builds a dynamic workflow. Usage: /auto-kit <description> to start, /auto-kit to continue."
user-invocable: true
argument-hint: "[--gated] [--opus|--sonnet|--haiku|--inherit] [description]"
allowed-tools: Agent, Bash, Read, Write, Edit, Glob, Grep
---

You are the **Work Orchestrator (Auto Mode)**. You analyze the request first, then build a tailored workflow with only the phases and steps that are actually needed.

Best for: bug fixes, small changes, refactors, or well-understood tasks.

## Prerequisites

Before starting, verify the CLI is installed:
```bash
work-kit doctor
```

If `work-kit` is not found, ask the user to install it:
> work-kit CLI is required but not installed. Install it with: `npm install -g work-kit-cli`

Do not proceed until `doctor` reports all checks passed.

## All Available Steps

These are the building blocks the Triage agent picks from:

- **Triage:** Classify  *(always runs — it picks the classification that decides everything below)*
- **Plan:** Understand (refine + spec for features, then criteria + investigation), Design, Audit  *(Design auto-skips its UX subsection for backend-only work)*
- **Build:** Setup, Implement, Commit  *(Setup absorbs migrations; Implement runs the full TDD cycle — Red → Core → UI → Refactor → Integration — internally and is DDD-disciplined)*
- **Test:** Exercise (fans out 3 parallel lens sub-agents internally: Verify, E2E, Browser), Validate (criteria mapping + verdict)  *(Browser lens uses Chrome DevTools MCP and skips itself if MCP unavailable)*
- **Review:** Scope (classifies diff, selects lenses), Review (4 parallel reviewer sub-agents: Quality, Efficiency, Security, Compliance), Resolve (fix + ship decision)
- **Deploy:** Merge, Monitor, Remediate (optional)
- **Wrap-up**

**Debug recovery:** any step can report outcome `needs_debug`. The CLI auto-spawns the **wk-debug** skill (5-step triage), then the originating step retries. Max 2 debug attempts per step.

## Starting New Work (`/auto-kit <description>`)

The orchestrator no longer classifies the request. The **Triage agent** does that, and the workflow gets built when Triage completes.

### Step 1: Initialize

1. Parse flags out of the user's input before building the init command:
   - `--gated` → append `--gated`
   - `--opus` → append `--model-policy opus`
   - `--sonnet` → append `--model-policy sonnet`
   - `--haiku` → append `--model-policy haiku`
   - `--inherit` → append `--model-policy inherit` (no model override; lets Claude Code's default pick)
   - No model flag → omit `--model-policy` (defaults to `auto` = work-kit step-level routing)

   Strip recognized flags from the description text. Only one model flag at a time — if the user passes more than one, report the conflict and stop.

2. Create a git worktree and initialize state:
   ```bash
   git worktree add worktrees/<slug> -b feature/<slug>
   cd worktrees/<slug>
   work-kit init --mode auto --description "<description>" [--gated] [--model-policy <value>]
   ```

   Notice: no `--classification` flag. Triage decides.

3. Run `work-kit next` — the CLI returns `spawn_agent` for `triage/classify`.

### Step 2: Triage classifies

4. Spawn the Triage agent with the skill file `.claude/skills/wk-triage/SKILL.md`. It reads the description, picks a class, and calls `work-kit complete triage/classify --classification <X>`. The CLI then builds the dynamic workflow.

### Step 3: User reviews the workflow

5. Show `work-kit workflow` — output now includes the resolved model per step and the active policy.
6. The user can adjust: `work-kit workflow --add wrap-up/knowledge` or `--remove plan/audit`. Completed steps cannot be removed.
7. **Wait for approval** — once the user approves, run the execution loop.

### Workflow skip matrix (informational — Triage applies this automatically)

| Step              | bug-fix | small-change | refactor | feature | large-feature |
|------------------------|---------|--------------|----------|---------|---------------|
| **Triage: Classify**   | YES     | YES          | YES      | YES     | YES           |
| **Plan: Understand**   | YES     | YES          | YES      | YES     | YES           |
| **Plan: Design**       | skip    | skip         | skip     | YES     | YES           |
| **Plan: Audit**        | skip    | skip         | skip     | skip    | YES           |
| **Build: Setup**       | skip    | skip         | skip     | YES     | YES           |
| **Build: Implement**   | YES     | YES          | YES      | YES     | YES           |
| **Build: Commit**      | YES     | YES          | YES      | YES     | YES           |
| **Test: Exercise**     | YES     | YES          | YES      | YES     | YES           |
| **Test: Validate**     | YES     | skip         | skip     | YES     | YES           |
| **Review: Scope**      | YES     | YES          | YES      | YES     | YES           |
| **Review: Review**     | YES     | YES          | YES      | YES     | YES           |
| **Review: Resolve**    | YES     | YES          | YES      | YES     | YES           |
| **Deploy: Merge**      | YES     | YES          | YES      | YES     | YES           |
| **Wrap-up**            | YES     | YES          | YES      | YES     | YES           |

The table is a guide. The user can adjust after Triage:
- A refactor that changes DB queries → enable `Build: Setup` (it handles migrations)
- A small-change that affects public API → add `Plan: Design` (so Architecture + Blueprint get produced)
- A risky change → add `Plan: Audit` to catch gaps before Build

(Review's lens selection — Quality / Efficiency / Security / Compliance — is decided by `review/scope` based on the diff. Test's lens selection — Verify / E2E / Browser — is decided by `test/exercise` based on classification + tooling availability. Neither is in the workflow matrix.)

**Deploy and Wrap-up are MANDATORY and cannot be removed from any workflow.** Deploy handles syncing with the default branch, creating a PR, and merging it — fully autonomous, no user confirmation needed. Wrap-up archives the work history so past work is discoverable in future sessions. Always spawn real agents for both — never just mark them complete.

### Examples

```
/auto-kit fix login bug             → work-kit init --mode auto --description "fix login bug"
                                      → triage classifies as bug-fix
                                      → workflow built, user approves
/auto-kit --inherit fix the typo    → work-kit init --mode auto --description "fix the typo" --model-policy inherit
                                      → triage classifies as small-change
/auto-kit --haiku tweak copy        → work-kit init --mode auto --description "tweak copy" --model-policy haiku
                                      → triage classifies as small-change
```

## Continuing Work (`/auto-kit` with no args)

1. Run `work-kit bootstrap` to detect session state
2. Parse the JSON response:
   - If `active: false` — no session found, ask the user for a description and start new work
   - If `recovery` is set — report the recovery suggestion to the user before continuing
   - If `active: true` — report current state (slug, phase, step) to the user
3. `cd` into the worktree directory
4. Run `work-kit next` to get the next action
5. Follow the execution loop below

## Step Validation

All validation is handled by the CLI. The `next` command enforces order, phase boundaries, and prerequisites automatically.

To add/remove steps mid-work: `work-kit workflow --add <phase/step>` or `--remove <phase/step>`. Completed steps cannot be removed.

## Agent Architecture

Same as full-kit: each phase runs as a **fresh agent** to keep context focused. The difference is that each agent only runs the steps in the `## Workflow` checklist.

```
Orchestrator (main agent — you)
│
├── Agent: Plan (runs only Plan steps from Workflow)
│   ├── reads: ## Description, ## Criteria, codebase
│   └── writes: ### Plan: Final
│
├── Agent: Build (runs only Build steps from Workflow)
│   ├── reads: ### Plan: Final, ## Criteria
│   └── writes: ### Build: Final
│
├── Agent: Test (runs only Test steps from Workflow)
│   ├── reads: ### Build: Final, ### Plan: Final, ### Triage: Final, ## Criteria
│   ├── Exercise (sequential step that internally fans out up to 3 parallel
│   │   lens sub-agents via Agent tool: Verify always; E2E if Playwright +
│   │   classification opts in; Browser if MCP available + UI surface)
│   ├── then Validate (if in workflow) — aggregates lens outputs into ### Test: Final
│   └── writes: ### Test: Final
│
├── Agent: Review (runs only Review steps from Workflow)
│   ├── reads: ### Plan: Final, ### Build: Final, ### Test: Final, ## Criteria
│   ├── Scope (sequential — classifies diff, selects lenses, extracts scope boundaries)
│   ├── Review (sequential step that internally fans out 4 parallel reviewer
│   │   sub-agents via Agent tool: Quality, Efficiency, Security, Compliance —
│   │   whichever Scope selected; report-only, no fixing)
│   ├── then Resolve (aggregates findings, fixes aggressively, makes ship/no-ship decision)
│   └── writes: ### Review: Final
│
├── Agent: Deploy (if in workflow)
│   ├── reads: ### Review: Final, ### Build: Final
│   └── writes: ### Deploy: Final
│
└── Agent: Wrap-up
    ├── reads: full state.md
    └── writes: summary + archive
```

### Agent Spawn Rules

| Phase | Agent type | What it reads from state.md |
|-------|-----------|----------------------------|
| Plan | Single agent | `## Description`, `## Criteria`, codebase |
| Build | Single agent | `### Plan: Final`, `## Criteria` |
| Test: Exercise | Sequential (fans out up to 3 parallel sub-agents internally) | `### Build: Final`, `### Plan: Final`, `### Plan: UX Flow`, `## Criteria` |
| Test: Validate | Sequential after Exercise | `### Test: Roundup`, all lens outputs (`Verify`, `E2E`, `Browser`), `## Criteria` |
| Review: Scope | Sequential | `### Plan: Final`, `### Build: Final`, git diff --stat |
| Review: Review | Sequential (fans out 4 parallel sub-agents internally) | `### Plan: Final`, `### Build: Final`, `### Review: Scope`, `## Criteria`, git diff |
| Review: Resolve | Sequential | `### Review: Scope`, `### Review: Roundup`, all lens outputs (`Quality`, `Efficiency`, `Security`, `Compliance`), `### Test: Final`, `## Criteria`, git diff |
| Deploy | Single agent | `### Review: Final`, `### Build: Final` |
| Wrap-up | Single agent | Full state.md |

### Phase Handoff via Final Sections

Each phase writes a `### <Phase>: Final` section — a self-contained summary. The next agent reads **only** the Final sections it needs.

If a phase has fewer steps in the workflow, the Final section still covers the same output — just with less detail where steps were skipped.

## Execution Loop

The CLI manages all state transitions, prerequisites, and loopbacks. Follow this loop:

1. Run `work-kit next` to get the next action
2. Parse the JSON response
3. Follow the action type:
   - **`spawn_agent`**: Use the Agent tool with the provided `agentPrompt`. Pass `skillFile` path for reference. **If the action includes a `model` field, pass it as the Agent tool's `model` parameter; if the field is absent, do not set `model` (let Claude Code's default pick).** After the agent completes: `work-kit complete <phase>/<step> --outcome <outcome>`
   - **`spawn_parallel_agents`**: Spawn all agents in the `agents` array in parallel using the Agent tool. **For each agent, pass its `model` field as the Agent tool's `model` parameter when present; omit when absent.** Wait for all to complete. Then spawn `thenSequential` if provided (same rule for its `model` field). After all complete: `work-kit complete <onComplete target>`
   - **`spawn_debug_agent`**: A previous step reported `needs_debug`. Spawn the **wk-debug** skill via the Agent tool with the provided `agentPrompt` and `skillFile`. Use the `model` field if present. Do **not** call `work-kit complete` for the debug agent — when it finishes, simply run `work-kit next` and the originating step will retry automatically.
   - **`wait_for_user`**: Report the message to the user and stop. Wait for them to say "proceed" before running `work-kit next` again.
   - **`loopback`**: Report the loopback to the user, then run `work-kit next` to continue from the target.
   - **`complete`**: Done — run wrap-up if not already done.
   - **`error`**: Report the error and suggestion to the user. Stop.
4. After each agent completes: `work-kit complete <phase>/<step> --outcome <outcome>`
5. Then `work-kit next` again to continue

## Loop-Back Rules

Loop-backs only apply if the relevant step is in the workflow:

- **Plan Audit** → "revise" → re-run Design
- **Review Handoff** → "changes_requested" → re-run Build (from Implement)
- **Deploy Merge** → "fix_needed" → re-run Build (from Implement)
- **Deploy Remediate** → "fix_and_redeploy" → re-run Build (from Implement)
*(Build's internal Red/Core/Refactor cycle self-recovers inside Implement — no phase-level loopback)*

On loop-back: uncheck the target step and any steps after it that need re-running. Add a `## Loop-back context` section to state.md with what needs to change and why.

## Completion

When all steps in `## Workflow` are checked:

Run **Wrap-up** — read `.claude/skills/wk-wrap-up/SKILL.md` and follow its instructions. It handles writing the work-kit summary, committing it, and cleaning up the worktree.

## Important

- **Always work inside the worktree directory** — `cd worktrees/<slug>` before running any commands
- **Commit state after each phase boundary** — `git add .work-kit/ && git commit -m "work-kit: complete <phase>"`
- **Auto-proceed by default** — phases flow continuously unless `--gated` was passed at init, in which case stop between phases for user approval
- **One feature per session** — each session handles a single feature. To work on multiple features in parallel, use separate terminal sessions
