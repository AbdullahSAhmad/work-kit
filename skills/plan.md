---
description: "Run the Plan phase — 8 sub-stages from Clarify to Audit."
---

You are the **Planning Lead**. Work through 8 focused sub-stages to produce a complete, executable Blueprint.

## Sub-stages (in order)

1. **Clarify** — Understand the request, define acceptance criteria, clarify requirements
2. **Investigate** — Read codebase, trace paths, map blast radius
3. **Sketch** — Rough directional plan
4. **Scope** — Define in/out scope, complexity, criteria
5. **UX Flow** — User-facing flows, screens, interactions
6. **Architecture** — Technical design: data model, API, components
7. **Blueprint** — Full ordered implementation plan
8. **Audit** — Check blueprint for gaps and contradictions

## Execution

For each sub-stage:
1. Read the sub-stage file (e.g., `.claude/skills/plan/clarify.md`)
2. Follow its instructions completely
3. Write outputs to `.work-kit/state.md` under a section for that sub-stage
4. Update `**Phase:** plan` and `**Sub-stage:** <current>` in state.md
5. Proceed to the next sub-stage

## Continuity

Maintain context across all sub-stages — each builds on the previous. Reference prior outputs explicitly. Don't re-discover what you already found.

## Recording

Throughout every sub-stage, capture two things in the shared state.md sections:

- **`## Decisions`** — Whenever you choose between real alternatives, append: `**<context>**: chose <X> over <Y> — <why>`. Skip obvious choices.

These feed into the final work-kit log summary. If you don't record decisions here, they're lost.

## Loop-back

If **Audit** returns "revise":
- Read the audit findings
- Go back to **Blueprint** and revise based on specific gaps identified
- Re-run **Audit** after revision
- Max 2 revision loops, then proceed with noted caveats

## Final Output

After all sub-stages are done, append a `### Plan: Final` section to state.md. This is the **only section the Build agent reads** — it must be self-contained.

```markdown
### Plan: Final

**Blueprint:**
<the full ordered implementation plan from Blueprint sub-stage — copy it here>

**Architecture:**
<data model, API surface, components, service layer — from Architecture sub-stage>

**Criteria:**
<reference to ## Criteria section>

**Scope:**
- In: <what's being built>
- Out: <what's not>
- Complexity: <small | medium | large | x-large>

**Key Constraints:**
- <anything the Build agent must know — patterns to follow, libs to use, gotchas>
```

Then:
- Update state: `**Phase:** plan (complete)`
- Commit state: `git add .work-kit/ && git commit -m "work-kit: complete plan"`
