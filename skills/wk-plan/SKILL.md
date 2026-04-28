---
name: plan
description: "Run the Plan phase — 3 steps: Understand, Design, Audit."
user-invocable: false
allowed-tools: Bash, Read, Write, Edit, Glob, Grep
---

You are the **Planning Lead**. Three focused steps produce an executable Blueprint.

## Steps (in order)

1. **Understand** — Refine the ask (for features), write the spec, define criteria, and map the code that will be touched
2. **Design** — Direction, scope, UX (if UI), architecture, ordered blueprint
3. **Audit** — Catch gaps before Build starts

## Execution

For each step:
1. Read the step file (e.g., `.claude/skills/wk-plan/steps/understand.md`)
2. Follow its instructions completely
3. Write outputs to `.work-kit/state.md` under the sections that step defines
4. Update `**Phase:** plan` and `**Step:** <current>` in state.md
5. Proceed to the next step

## Continuity

Each step builds on the previous. Reference prior outputs explicitly. Don't re-discover what you already found.

## Recording

Throughout every step, capture in shared state.md sections:

- **`## Decisions`** — When you choose between real alternatives, append: `- **<context>**: chose <X> over <Y> — <one-sentence why>`. Skip obvious choices.
- **`## Observations`** — When you notice a project convention, fragile area, learning, or workflow feedback, append `- [lesson|convention|risk|workflow] text` (workflow tag may include `:phase/step`). At `wrap-up/knowledge` these are routed to `.work-kit-knowledge/` so future sessions benefit.

These feed the final work-kit log and project knowledge files. If you don't record them here, they're lost.

## Loop-back

If **Audit** returns "revise":
- Read the audit findings
- Go back to **Design** (Blueprint section) and revise based on specific gaps
- Re-run **Audit** after revision
- Max 2 revision loops, then proceed with noted caveats

## Final Output

After all steps are done, append a `### Plan: Final` section to state.md. This is the **only section the Build agent reads** — it must be self-contained.

```markdown
### Plan: Final

**Verdict:** ready | revised_with_caveats

**Blueprint:**
<the full ordered implementation plan from Design step — copy it here>

**Architecture:**
<data model, API surface, components, service layer — from Design step>

**Criteria:**
<reference to ## Criteria section>

**Scope:**
- In: <what's being built>
- Out: <what's not>
- Complexity: <small | medium | large | x-large>

**Key Constraints:**
- <patterns to follow, libs to use, gotchas the Build agent must know>
```

Then:
- Update state: `**Phase:** plan (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete plan"`

## Boundaries

### Always
- Define criteria before reading code (intent before implementation)
- Trace actual code paths in Understand, not guesses from filenames
- Use exact file paths in Design's Architecture and Blueprint sections
- Map every acceptance criterion to ≥1 Blueprint step

### Ask First
- Scope changes after Understand (user must approve)
- Adding criteria the user did not request
- Recommending complexity = x-large

### Never
- Skip Understand to "save time" — code understanding prevents rework
- Propose solutions during Understand (that's Design's job)
- Write vague Blueprint steps without exact paths
- Assume standard patterns without verifying in Understand
- Proceed past Audit with unresolved gaps
