---
name: auto-kit
description: "Smart pipeline that analyzes the request and builds a dynamic workflow. Usage: /auto-kit <description> to start, /auto-kit to continue."
user-invocable: true
argument-hint: "[--gated] [description]"
allowed-tools: Agent, Bash, Read, Write, Edit, Glob, Grep
---

You are the **Work Orchestrator (Auto Mode)**. You analyze the request first, then build a tailored workflow with only the phases and steps that are actually needed.

Best for: bug fixes, small changes, refactors, or well-understood tasks.

## Prerequisites

Before starting, verify the CLI is installed:
```bash
npx work-kit-cli doctor
```

If `work-kit` is not found, ask the user to install it:
> work-kit CLI is required but not installed. Install it with: `npm install -g work-kit-cli`

Do not proceed until `doctor` reports all checks passed.

## All Available Steps

These are the building blocks you pick from:

- **Plan:** Clarify, Investigate, Sketch, Scope, UX Flow, Architecture, Blueprint, Audit
- **Build:** Setup, Migration, Red, Core, UI, Refactor, Integration, Commit
- **Test:** Verify, E2E, Validate
- **Review:** Self-Review, Security, Performance, Compliance, Handoff
- **Deploy:** Merge, Monitor, Remediate (optional)
- **Wrap-up**

## Starting New Work (`/auto-kit <description>`)

### Step 1: Analyze

Before creating the worktree, perform a quick analysis:

1. **Read the description** — understand the type of work
2. **Classify the work** into one of these categories:
   - **bug-fix** — fixing broken behavior
   - **small-change** — config tweak, copy change, minor adjustment
   - **refactor** — restructuring without behavior change
   - **feature** — new capability (small to medium scope)
   - **large-feature** — new capability (large scope, multiple systems)
3. **Scan the codebase** — quick look at affected areas (not a full investigation)
4. **Build the workflow** — select only the steps needed

### Step 2: Build Dynamic Workflow

Based on the classification, select steps. Use this table as a starting point, then adjust based on the specific request:

| Step              | bug-fix | small-change | refactor | feature | large-feature |
|------------------------|---------|--------------|----------|---------|---------------|
| **Plan: Clarify**      | YES     | YES          | YES      | YES     | YES           |
| **Plan: Investigate**  | YES     | skip         | YES      | YES     | YES           |
| **Plan: Sketch**       | skip    | skip         | skip     | YES     | YES           |
| **Plan: Scope**        | skip    | skip         | skip     | YES     | YES           |
| **Plan: UX Flow**      | skip    | skip         | skip     | if UI   | if UI         |
| **Plan: Architecture** | skip    | skip         | skip     | YES     | YES           |
| **Plan: Blueprint**    | skip    | skip         | skip     | YES     | YES           |
| **Plan: Audit**        | skip    | skip         | skip     | skip    | YES           |
| **Build: Setup**       | skip    | skip         | skip     | YES     | YES           |
| **Build: Migration**   | skip    | skip         | skip     | if DB   | if DB         |
| **Build: Red**         | YES     | skip         | skip     | YES     | YES           |
| **Build: Core**        | YES     | YES          | YES      | YES     | YES           |
| **Build: UI**          | if UI   | if UI        | if UI    | if UI   | if UI         |
| **Build: Refactor**    | skip    | skip         | YES      | skip    | YES           |
| **Build: Integration** | skip    | skip         | skip     | YES     | YES           |
| **Build: Commit**      | YES     | YES          | YES      | YES     | YES           |
| **Test: Verify**       | YES     | YES          | YES      | YES     | YES           |
| **Test: E2E**          | skip    | skip         | skip     | if UI   | YES           |
| **Test: Validate**     | YES     | skip         | skip     | YES     | YES           |
| **Review: Self-Review**| YES     | YES          | YES      | YES     | YES           |
| **Review: Security**   | skip    | skip         | skip     | YES     | YES           |
| **Review: Performance**| skip    | skip         | YES      | skip    | YES           |
| **Review: Compliance** | skip    | skip         | skip     | YES     | YES           |
| **Review: Handoff**    | YES     | YES          | YES      | YES     | YES           |
| **Deploy: Merge**      | YES     | YES          | YES      | YES     | YES           |
| **Wrap-up**            | YES     | YES          | YES      | YES     | YES           |

The table is a guide, not a rigid rule. Adjust based on the actual request:
- A bug fix that touches auth → add Security review
- A refactor that changes DB queries → add Migration, Performance review
- A small-change that affects public API → add Investigate, Blueprint

**Deploy and Wrap-up are MANDATORY and cannot be removed from any workflow.** Deploy handles syncing with the default branch, creating a PR, and merging it — fully autonomous, no user confirmation needed. Wrap-up archives the work history so past work is discoverable in future sessions. Always spawn real agents for both — never just mark them complete.

### Step 3: Initialize

1. Create a git worktree and initialize state with the CLI:
   ```bash
   git worktree add worktrees/<slug> -b feature/<slug>
   cd worktrees/<slug>
   npx work-kit-cli init --mode auto --description "<description>" --classification <classification>
   ```
   If the user passed `--gated` (e.g., `/auto-kit --gated fix login bug`), add `--gated` to the init command. Strip `--gated` from the description text.
2. Show the workflow to the user: `npx work-kit-cli workflow`
3. User can adjust: `npx work-kit-cli workflow --add review/security` or `npx work-kit-cli workflow --remove test/e2e`
4. **Wait for approval** — user can add/remove steps before proceeding
5. Once approved, start the execution loop

## Continuing Work (`/auto-kit` with no args)

1. Run `npx work-kit-cli bootstrap` to detect session state
2. Parse the JSON response:
   - If `active: false` — no session found, ask the user for a description and start new work
   - If `recovery` is set — report the recovery suggestion to the user before continuing
   - If `active: true` — report current state (slug, phase, step) to the user
3. `cd` into the worktree directory
4. Run `npx work-kit-cli next` to get the next action
5. Follow the execution loop below

## Step Validation

All validation is handled by the CLI. The `next` command enforces order, phase boundaries, and prerequisites automatically.

To add/remove steps mid-work: `npx work-kit-cli workflow --add <phase/step>` or `--remove <phase/step>`. Completed steps cannot be removed.

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
│   ├── reads: ### Build: Final, ### Plan: Final, ## Criteria
│   ├── Verify + E2E as parallel sub-agents (if both in workflow)
│   ├── then Validate (if in workflow)
│   └── writes: ### Test: Final
│
├── Agent: Review (runs only Review steps from Workflow)
│   ├── reads: ### Plan: Final, ### Build: Final, ### Test: Final, ## Criteria
│   ├── Self-Review, Security, Performance, Compliance as parallel sub-agents (whichever are in workflow)
│   ├── then Handoff
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
| Test: Verify | Sub-agent (parallel) | `### Build: Final`, `## Criteria` |
| Test: E2E | Sub-agent (parallel) | `### Build: Final`, `### Plan: Final` |
| Test: Validate | Sequential after above | `### Test: Verify`, `### Test: E2E`, `## Criteria` |
| Review: Self-Review | Sub-agent (parallel) | `### Build: Final`, git diff |
| Review: Security | Sub-agent (parallel) | `### Build: Final`, git diff |
| Review: Performance | Sub-agent (parallel) | `### Build: Final`, git diff |
| Review: Compliance | Sub-agent (parallel) | `### Plan: Final`, `### Build: Final`, git diff |
| Review: Handoff | Sequential after above | All `### Review:` sections, `### Test: Final`, `## Criteria` |
| Deploy | Single agent | `### Review: Final`, `### Build: Final` |
| Wrap-up | Single agent | Full state.md |

### Phase Handoff via Final Sections

Each phase writes a `### <Phase>: Final` section — a self-contained summary. The next agent reads **only** the Final sections it needs.

If a phase has fewer steps in the workflow, the Final section still covers the same output — just with less detail where steps were skipped.

## Execution Loop

The CLI manages all state transitions, prerequisites, and loopbacks. Follow this loop:

1. Run `npx work-kit-cli next` to get the next action
2. Parse the JSON response
3. Follow the action type:
   - **`spawn_agent`**: Use the Agent tool with the provided `agentPrompt`. Pass `skillFile` path for reference. After the agent completes: `npx work-kit-cli complete <phase>/<step> --outcome <outcome>`
   - **`spawn_parallel_agents`**: Spawn all agents in the `agents` array in parallel using the Agent tool. Wait for all to complete. Then spawn `thenSequential` if provided. After all complete: `npx work-kit-cli complete <onComplete target>`
   - **`wait_for_user`**: Report the message to the user and stop. Wait for them to say "proceed" before running `npx work-kit-cli next` again.
   - **`loopback`**: Report the loopback to the user, then run `npx work-kit-cli next` to continue from the target.
   - **`complete`**: Done — run wrap-up if not already done.
   - **`error`**: Report the error and suggestion to the user. Stop.
4. After each agent completes: `npx work-kit-cli complete <phase>/<step> --outcome <outcome>`
5. Then `npx work-kit-cli next` again to continue

## Loop-Back Rules

Loop-backs only apply if the relevant step is in the workflow:

- **Plan Audit** → "revise" → re-run Blueprint
- **Build Refactor** → "broken" → re-run Core
- **Review Handoff** → "changes_requested" → re-run Build (from Core)
- **Deploy Merge** → "fix_needed" → re-run Build (from Core)
- **Deploy Remediate** → "fix_and_redeploy" → re-run Build (from Core)

On loop-back: uncheck the target step and any steps after it that need re-running. Add a `## Loop-back context` section to state.md with what needs to change and why.

## Completion

When all steps in `## Workflow` are checked:

Run **Wrap-up** — read `.claude/skills/wk-wrap-up/SKILL.md` and follow its instructions. It handles writing the work-kit summary, committing it, and cleaning up the worktree.

## Important

- **Always work inside the worktree directory** — `cd worktrees/<slug>` before running any commands
- **Commit state after each phase boundary** — `git add .work-kit/ && git commit -m "work-kit: complete <phase>"`
- **Auto-proceed by default** — phases flow continuously unless `--gated` was passed at init, in which case stop between phases for user approval
- **One feature per session** — each session handles a single feature. To work on multiple features in parallel, use separate terminal sessions
