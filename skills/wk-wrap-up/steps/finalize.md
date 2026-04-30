# Step: Finalize

**Phase:** Wrap-up
**Role:** Work Historian
**Goal:** Distill state.md into a durable summary, extract session learnings, commit the archive, and remove the worktree.

## Workflow

### 1. Read state

Read the full `.work-kit/state.md` — every phase output from Plan through the last completed phase. Also read `.work-kit/tracker.json` for timing and loopback data.

### 2. Write summary

Write `.work-kit/summary.md`:

```markdown
---
slug: <slug>
branch: feature/<slug>
pr: <#number or n/a>
started: <YYYY-MM-DD>
completed: <YYYY-MM-DD>
status: <completed | partial | rolled-back>
---

## Summary
<2-3 sentences: what was built, why it was needed, and the end state>

## Criteria
<copy the final criteria checklist from state.md — checked and unchecked>

## Key Decisions
<only the non-obvious ones — decisions where the alternative was reasonable>
- <decision>: <what was chosen> — <why, in one line>

## Deviations from Plan
<anything that changed between Blueprint and final implementation — skip if none>
- <what changed and why>
```

**Include:** decisions where you chose between real alternatives; deviations from the Blueprint (and why); anything a future developer needs to understand the "why"; criteria status — met and unmet.

**Exclude:** artifact lists (derivable from git); routine implementation details; full phase outputs (distill, don't dump); internal process notes; anything derivable from the diff or PR.

### 3. Extract knowledge

Run mechanical extraction:

```bash
work-kit extract
```

This parses `.work-kit/state.md` and `.work-kit/tracker.json` and routes entries to `.work-kit-knowledge/{lessons,conventions,risks,decisions,workflow}.md`. It pulls from:
- `## Observations` typed bullets (`- [lesson|convention|risk|workflow|decision] text`) — auto-harvested
- `## Decisions` bullets matching `**<context>**: chose X over Y — <why>` — auto-harvested into `findings.md`
- `tracker.json.loopbacks[]` → workflow feedback
- Skipped/failed steps → workflow feedback

Free-form bullets under `## Decisions` and everything under `## Deviations` are not auto-harvested (they're scratch space). If something there is worth preserving, restate it as a typed bullet under `## Observations` or use `work-kit learn` directly.

### 4. Add manual learnings

Read the summary you just wrote. For each non-obvious thing the parser would NOT have captured, call `work-kit learn`:

```bash
work-kit learn --type lesson --text "Discovered that the test fixtures must be reset between Playwright suites, otherwise auth state leaks."
work-kit learn --type risk --text "src/payment/webhook.ts has no integration test coverage for retries."
work-kit learn --type convention --text "All new API endpoints must register a Zod schema in src/schemas/."
work-kit learn --type decision --text "**Browser driver**: chose Chrome DevTools MCP over Playwright — agentic, no spec files to maintain."
work-kit learn --type workflow --text "The wk-test/exercise step's E2E lens doesn't tell agents to start the dev server before running Playwright."
```

Keep `--text` to one sentence. Types `lesson`, `convention`, `risk`, `decision` all write to `findings.md`. Type `workflow` writes to `workflow.md`.

### 5. Write receipt

Write JSON to the `receiptPath` the orchestrator gave you (`.work-kit/receipts/wrap-up-finalize.json`):

```json
{
  "version": 1,
  "step": "wrap-up/finalize",
  "timestamp": "<ISO 8601>",
  "summary_path": ".work-kit/summary.md",
  "extracted": {
    "findings": 4,
    "workflow": 1
  }
}
```

`extracted` is optional but recommended (zeros are fine). `"error": { ... }` maps to `needs_debug`.

### 6. Commit the archive

The CLI archives `state.md`, `tracker.json`, and `summary.md` into `.work-kit-tracker/archive/<slug>-<date>/` automatically when the orchestrator runs `work-kit complete wrap-up/finalize`. It also appends a row to `.work-kit-tracker/index.md`.

After the orchestrator completes the step, commit the archive to main:

```bash
git add .work-kit-tracker/
git commit -m "work-kit: <slug>"
```

### 7. Remove worktree

Ask the user if they want the worktree and feature branch removed, then:

```bash
git worktree remove worktrees/<slug> --force
git branch -d feature/<slug> 2>/dev/null || true
```

Report: summary written, knowledge extracted, archive committed, worktree removed.

## Knowledge type reference

| Type | File | What belongs here |
|---|---|---|
| `lesson` | findings.md | Project-specific facts about *this* codebase |
| `convention` | findings.md | Codified rules future sessions should respect |
| `risk` | findings.md | Fragile or dangerous areas — touch with care |
| `decision` | findings.md | What was picked, what was rejected, why |
| `workflow` | workflow.md | Feedback about work-kit itself — mined upstream |

## Boundaries

### Always
- Read the full state.md before writing the summary
- Run `work-kit extract` before adding manual `learn` calls
- Include every non-obvious decision in Key Decisions
- Include every deviation from the Blueprint in Deviations
- Write the archive commit to main, not the worktree branch

### Ask First
- Deleting the worktree and feature branch

### Never
- Copy-paste full phase outputs into the summary (distill, don't dump)
- Skip the criteria checklist
- Edit the `## Manual` section of any knowledge file (human-curated, tooling never touches it)
- Paste large code blocks or stack traces into `--text` — distill into one sentence
- Skip extraction — even if nothing to add manually, `work-kit extract` still routes loopbacks

### Failure mode
- Knowledge extraction is non-fatal. If `extract` or `learn` fails, the summary has already succeeded — the session isn't lost. Report the error; the user can retry manually. Write the receipt with `extracted` zeroed out — the orchestrator still closes the step.
