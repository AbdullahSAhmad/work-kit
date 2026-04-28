---
description: "Triage step: Classify the request and emit the workflow plan."
---

# Classify

**Role:** Intake Classifier
**Goal:** Pick the work class so the rest of the pipeline knows what phases and steps to run.

## Instructions

1. Read `## Description` from `.work-kit/state.md`.
2. Pick **exactly one** classification:

   | Class | When to pick it |
   |-------|-----------------|
   | `bug-fix` | A specific behavior is broken and needs to be restored. Scope is narrow, diagnosis-driven. |
   | `small-change` | Config tweak, copy change, single-file adjustment. The user already knows the precise change. |
   | `refactor` | Restructuring without behavior change — extracting, renaming, splitting, deduping. |
   | `feature` | New capability, small-to-medium scope, one bounded context. |
   | `large-feature` | New capability spanning multiple bounded contexts, significant data model changes, or cross-team concerns. |

3. If the description is genuinely ambiguous between two classes, ask the user **once** which class fits better. Do not pick silently for ambiguous cases.

4. Call the CLI to record the classification:
   ```bash
   work-kit complete triage/classify --classification <class>
   ```
   This writes `state.classification` into `tracker.json` and (for auto-kit) builds the workflow matrix.

5. Show the resolved workflow to the user:
   ```bash
   work-kit workflow
   ```
   The user can adjust before Plan starts: `work-kit workflow --add <phase/step>` or `--remove <phase/step>`.

## Output (append to state.md)

```markdown
### Triage: Classify

**Classification:** <class>
**Reasoning:** <one sentence — what about the request matches this class>

**Signals:**
- <thing in the description that pointed to this class>
- <another signal>

**Adjacent classes considered:**
- <class — why rejected — or "None">

**Notes for Plan:**
- <anything Plan/Understand should know up front — or "None">
```

Also append to `## Decisions` if the call was non-obvious:

```markdown
- **Classification**: chose <class> over <other> — <why>
```

## Rules

- **One class per work item.** "It's kind of a bug-fix and kind of a refactor" → ask the user.
- **Don't over-classify.** A small bug fix that incidentally renames a variable is still `bug-fix`, not `refactor`.
- **Don't tighten the ask here.** That's Plan/Understand's job. Triage's only job is: what kind of work is this.
- Triage runs in under a minute. If it's taking longer, you're doing Plan's job.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "This is a refactor *and* a feature, so I'll pick large-feature to cover both" | Refactor + feature in the same work item is two work items in a trench coat. Surface the conflict to the user — don't smuggle scope through classification. |
| "I'll classify based on what I think the implementation will look like" | Classify based on what the user is asking for, not what you'll write. The classification gates investigation; if it's wrong, you waste Plan's time. |
| "The description is fuzzy, I'll guess and let Plan sort it out" | Plan/Understand will refine framing — but it can't change the workflow shape. If you guess `small-change` and it's actually `large-feature`, the workflow runs without Define-style spec rigor. Ask the user when uncertain. |
