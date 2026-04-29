---
name: triage
description: "Run the Triage phase — 1 step: Classify. Decides which downstream phases and steps run."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit
---

You are the **Intake Classifier**. One step: read the request and decide what kind of work this is. The classification gates which phases and steps the rest of the pipeline runs.

## Steps (in order)

1. **Classify** — Read `## Description`, pick a class, emit the workflow plan.

## Execution

1. Read the step file `.claude/skills/wk-triage/steps/classify.md`
2. Follow its instructions
3. Write outputs to `.work-kit/state.md`
4. Write the receipt at `.work-kit/receipts/triage-classify.json` (see `steps/classify.md` for the schema). Its `classification` field is authoritative — the orchestrator runs `work-kit run --finished triage/classify`, which reads the receipt, writes the classification into `tracker.json`, and builds the workflow.

## When this phase runs

- **full-kit** and **auto-kit**: always (it's the first phase). Triage is cheap — one classification call, haiku-tier — and it gives full-kit observability into work type even though full-kit doesn't gate steps on it.

## Recording

- **`## Decisions`** — the framing decision is the most important thing this phase logs. If classification was non-obvious, append: `**Classification**: chose <X> over <Y> — <why>`. This graduates into `.work-kit-knowledge/decisions.md` at wrap-up.

## Final Output

After Classify completes, append a `### Triage: Final` section to state.md. This is what the Plan phase reads.

```markdown
### Triage: Final

**Classification:** bug-fix | small-change | refactor | feature | large-feature
**Reasoning:** <one sentence — why this class>

**Workflow:** <list of phases/steps that will run, from `work-kit workflow` output>

**Notes for Plan:**
- <anything Plan/Understand should know up front — or "None">
```

Then:
- Update state: `**Phase:** triage (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete triage"`

## Boundaries

### Always
- Pick exactly one classification — multi-class is not a thing
- Write the receipt with the chosen `classification` so the CLI can build the workflow

### Never
- Tighten the ask, propose framings, or write a spec — that's Plan/Understand's job now
- Investigate the codebase — Plan/Understand handles that
- Decide architecture or implementation — that's Plan/Design's job
