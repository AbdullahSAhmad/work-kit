# Step: Knowledge

**Phase:** Wrap-up
**Role:** Knowledge Harvester
**Goal:** Route this session's learnings into the project's `.work-kit-knowledge/` files so the next session — and the next developer — starts smarter.

## When this step runs

After `wrap-up/summary`. By now you've just re-read the full `state.md` and distilled it into a summary, so your working memory of this session is at its peak. This is the right moment to capture observations the parser would miss.

## Workflow

1. **Run mechanical extraction:**
   ```bash
   work-kit extract
   ```
   This parses `.work-kit/state.md` and `.work-kit/tracker.json` and routes entries to `.work-kit-knowledge/{lessons,conventions,risks,workflow}.md`. It pulls from:
   - `## Observations` typed bullets (`- [lesson|convention|risk|workflow] text`)
   - `## Decisions` → conventions
   - `## Deviations` → workflow feedback
   - `tracker.json.loopbacks[]` → workflow feedback
   - Skipped/failed steps → workflow feedback

   The output JSON tells you how many entries were `written` vs `duplicates`. Re-running is idempotent.

2. **Read your `.work-kit/summary.md`** (the one you just wrote). For each non-obvious thing in it that the parser would NOT have captured automatically, call `work-kit learn`:

   ```bash
   work-kit learn --type lesson --text "Discovered that the test fixtures must be reset between Playwright suites, otherwise auth state leaks."
   work-kit learn --type risk --text "src/payment/webhook.ts has no integration test coverage for retries."
   work-kit learn --type convention --text "All new API endpoints must register a Zod schema in src/schemas/."
   work-kit learn --type workflow --text "The wk-test/e2e step doesn't tell agents to start the dev server before running Playwright."
   ```

   Each call appends one entry to the appropriate `.md` file under a lockfile, with secret redaction applied automatically.

3. **Mark the step complete:**
   ```bash
   work-kit complete wrap-up/knowledge --outcome done
   ```

## What goes where

| Type | File | What belongs here |
|---|---|---|
| `lesson` | lessons.md | Project-specific learnings — facts about *this* codebase. |
| `convention` | conventions.md | Codified rules this project follows. Future sessions should respect these. |
| `risk` | risks.md | Fragile or dangerous areas. Touch with care. |
| `workflow` | workflow.md | Feedback about the work-kit kit itself — skill quality, step skips, loopbacks, failure modes. **Mined manually across projects to improve work-kit upstream.** |

## Boundaries

### Always
- Run `work-kit extract` first, then add manual `learn` calls.
- Keep `learn --text` entries to one sentence — they're for humans skimming a list.
- Use `workflow` type only for feedback about the work-kit *itself*, not for project facts.

### Never
- Edit the `## Manual` section of any knowledge file. That's human-curated and tooling never touches it.
- Use `workflow.md` for project-specific facts. Use `lessons.md` instead.
- Paste large code blocks, file contents, or stack traces into `--text`. Distill into one sentence.
- Skip extraction. Even if you have nothing to add manually, `work-kit extract` still routes loopbacks and deviations.

### Failure mode
- Non-fatal. If extract or learn fails, the summary step has already succeeded — the session isn't lost. Report the error to the user; they can retry manually or run `work-kit complete wrap-up/knowledge --outcome done` anyway.

## Output

No file output for this step — entries land in `.work-kit-knowledge/*.md`. Optionally append a one-line note to `.work-kit/state.md` describing what you captured, e.g.:

```markdown
### Wrap-up: Knowledge

**Extracted:** 4 entries (2 conventions, 1 risk, 1 workflow)
**Manual additions:** 2 lessons, 1 workflow feedback
```
