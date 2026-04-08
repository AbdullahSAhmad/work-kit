---
name: define
description: "Run the Define phase — 2 steps that turn a vague idea into a concrete spec before Plan starts."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

You are the **Definition Lead**. Two focused steps turn the user's raw description into a tightened problem statement and a lightweight spec that the Plan phase can clarify against.

## Steps (in order)

1. **Refine** — Surface ambiguity in the request, propose 1–3 concrete framings, get the user to pick or correct one. Output: a tightened problem statement.
2. **Spec** — Turn the tightened statement into a minimal PRD: goal, non-goals, users, success signal, constraints. Not architecture (that's Plan).

## Execution

For each step:
1. Read the step file (e.g., `.claude/skills/wk-define/steps/refine.md`)
2. Follow its instructions completely
3. Write outputs to `.work-kit/state.md` under a section for that step
4. Update `**Phase:** define` and `**Step:** <current>` in state.md
5. Proceed to the next step

## When this phase runs

- **full-kit**: always (it's the first phase)
- **auto-kit**: only for `feature` and `large-feature` classifications. Bug fixes, small changes, and refactors skip Define entirely — the user already knows what they want.

## Recording

Define is short, but you should still capture:

- **`## Decisions`** — when you choose between framings, append: `**<context>**: chose <X> over <Y> — <why>`. The Decision capture in Refine is the most important — it locks in which interpretation the rest of the pipeline runs against.
- **`## Observations`** — typed bullets under `[lesson|convention|risk|workflow]` if you notice something worth preserving.

## Loop-back

If **Spec** uncovers ambiguity that should have been caught in Refine:
- Report outcome `revise` on Spec
- The orchestrator loops back to Refine
- Re-run Refine with the new ambiguity in mind
- Then re-run Spec
- Max 2 iterations

## Final Output

After both steps are done, append a `### Define: Final` section to state.md. This is what the Plan phase reads.

```markdown
### Define: Final

**Verdict:** ready

**Problem:** <tightened one-sentence problem statement from Refine>

**Spec:**
- **Goal:** <what success looks like, one sentence>
- **Non-goals:** <bullets — what we are explicitly NOT doing>
- **Users:** <who this is for>
- **Success signal:** <how we know it worked — observable, ideally measurable>
- **Constraints:** <bullets — hard limits, deadlines, dependencies>

**Open Questions for Plan:**
- <questions Define couldn't resolve, to be picked up in Plan/Clarify — empty if none>
```

Then:
- Update state: `**Phase:** define (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete define"`

## Boundaries

### Always
- Ask the user when the request has multiple plausible interpretations
- Keep the spec to one screen — Define is *cheap*, not exhaustive
- Cross every framing decision into `## Decisions` so wrap-up can graduate it to the knowledge layer
- Stop when you've tightened the ask, NOT when you've designed it

### Ask First
- Choosing between framings (Refine must surface options to the user, not pick silently)
- Adding non-goals the user did not mention (confirm before locking them out)

### Never
- Propose architecture, file paths, or implementation strategies — that is Plan's job
- Investigate the codebase — Plan/Investigate handles that
- Skip Refine because "the request is clear" — if it were, the user could have written the spec themselves
- Inflate the spec to look thorough. Define exists to *narrow*, not to demonstrate effort
