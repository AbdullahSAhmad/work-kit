---
description: "Define step: Turn the tightened problem statement into a minimal PRD."
---

# Spec

**Role:** Mini-PRD Author
**Goal:** Convert the tightened problem statement from Refine into a minimal spec the Plan phase can clarify against. Five sections, no more.

## Instructions

1. **Read** `### Define: Refine` from `.work-kit/state.md`. The "Tightened Problem Statement" is your starting point.

2. **Write the spec.** Five sections, each as short as possible while still being concrete:

   - **Goal** — one sentence. What does success look like? Should be observable.
   - **Non-goals** — bullets. What are we *explicitly not* doing? This is where you put framings that came close in Refine but lost.
   - **Users** — who is this for? Be specific. "Users" is not specific. "Logged-in admins viewing the team settings page" is.
   - **Success signal** — how do we know it worked? Ideally measurable. If you can't measure it, describe what an observer would see.
   - **Constraints** — bullets. Hard limits: deadlines, dependencies, must-not-touch areas, budget, compatibility.

3. **Audit your spec.** Read it back and ask:
   - Is the Goal a single sentence? (If not, you have multiple goals — pick one or escalate.)
   - Are non-goals concrete things, not platitudes? ("Not over-engineering" is not a non-goal.)
   - Could you build the wrong thing if you only read this spec? If yes, sharpen it.
   - Did Refine leave any ambiguity that resurfaced here? If so, report `revise` and loop back.

4. **Decide outcome:**
   - `done` — spec is solid, Plan can take it from here
   - `revise` — Refine missed something, loop back

## Output (append to state.md)

```markdown
### Define: Spec

**Goal:** <one observable sentence>

**Non-goals:**
- <thing we are explicitly not doing>
- <another thing we are explicitly not doing>

**Users:** <specific actor in a specific context>

**Success signal:** <what an observer would see, ideally measurable>

**Constraints:**
- <hard limit 1>
- <hard limit 2>

**Open Questions for Plan:**
- <ambiguity that survived Define and should be picked up in Plan/Clarify — empty if none>
```

## Rules

- Each section is **at most 3 lines**. If you can't fit it, you're designing, not specifying.
- The spec is for the Plan phase, not the user. The user already approved the framing in Refine.
- Do NOT propose architecture, file paths, libraries, or APIs. None of that.
- Do NOT add acceptance criteria here — Plan/Clarify owns those.
- If you find yourself needing more than 5 sections, you're building a PRD instead of a spec. Stop.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "I should add an Architecture section to be helpful" | Plan does architecture. Adding it here pollutes the boundary and means Plan re-litigates a decision Define wasn't equipped to make. |
| "Non-goals feel like nitpicks, I'll skip them" | Non-goals are the most valuable section. They prevent scope creep in Build by stating up front what we're *not* doing. |
| "The success signal is 'it works'" | "It works" is not a signal. If you can't describe what an observer would see, you don't know what success means yet — go back to Refine. |
| "Constraints can be discovered during Plan" | Some can. The hard ones (deadlines, must-not-touch areas, regulatory) need to be locked in Define so Plan doesn't waste effort on impossible designs. |
