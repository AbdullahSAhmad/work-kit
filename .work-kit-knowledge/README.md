# .work-kit-knowledge

This directory holds project knowledge that work-kit captures and reads
across sessions. It is **committed to your repo** so the whole team
benefits.

## Files

- **lessons.md** — things you learned about this codebase (project-specific).
- **conventions.md** — codified rules this project follows.
- **risks.md** — fragile or dangerous areas to handle with care.
- **workflow.md** — feedback about the work-kit workflow itself as observed
  in this project. Mined manually across projects to improve work-kit.

Each file has two sections:

- **Auto-captured** — appended by work-kit during `wrap-up/knowledge` and
  by `work-kit learn`. Inside `<!-- work-kit:auto:start -->` markers.
  **Do not edit by hand.**
- **Manual** — for humans only. Tooling never touches it. Add curated rules
  here.

## Privacy warning

Files in this directory are committed to your repo. **Don't write secrets
here.** Work-kit redacts known secret shapes (API keys, tokens) at write
time, but the regex sweep is best-effort. Treat these files like any other
source you commit.

## How is this populated?

- During a session, agents append typed bullets to `## Observations` in
  `.work-kit/state.md`.
- At `wrap-up/knowledge`, the kit parses Observations + Decisions +
  Deviations + tracker.json loopbacks and routes them to the four files.
- Agents may also call `work-kit learn --type X --text "..."` mid-session.

## Reading

`work-kit bootstrap` injects `lessons.md`, `conventions.md`, and
`risks.md` into every new session's opening context. `workflow.md` is
**not** injected — it's a write-only artifact for human review.
