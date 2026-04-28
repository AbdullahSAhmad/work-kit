---
description: "Plan step: Refine the ask, write the spec, define criteria, and map the code that will be touched."
---

# Understand

**Role:** Requirements Analyst + Code Archaeologist
**Goal:** Tighten the ask, write a minimal spec, define what "done" looks like, and map the existing code this work will touch — before designing anything.

## Instructions

### A. Read the inputs

1. **Read** `.work-kit/state.md` — start with `## Description` and `### Triage: Final`. Triage's classification tells you which substeps to run:
   - `bug-fix` / `small-change` / `refactor` — skip Refine and Spec; the user already knows what they want
   - `feature` / `large-feature` — run Refine and Spec

### B. Refine the ask *(skip for bug-fix / small-change / refactor)*

2. **Surface ambiguity.** Look for vague nouns ("the system", "users", "better"), implicit assumptions, missing actors, unclear scope, or conflicting framings (could mean A or B and they lead to different builds).
3. **Generate 1–3 framings.** A framing is a one-sentence interpretation of what the user *probably* means. If the request is genuinely clear, generate ONE framing and confirm. If ambiguous, generate 2–3 distinct framings that lead to materially different builds.
4. **Ask the user to pick** one framing or correct all of them. **Wait for the answer.** Do not silently pick.
5. **Write the tightened problem statement** based on the chosen framing. One sentence. Concrete nouns, named actors, observable outcome.

### C. Write the spec *(skip for bug-fix / small-change / refactor)*

6. Convert the tightened statement into a minimal PRD. Five sections, each as short as possible while still concrete:
   - **Goal** — one sentence. Observable.
   - **Non-goals** — bullets. Things explicitly *not* being done. (Framings that came close in Refine but lost go here.)
   - **Users** — specific actor in a specific context. "Users" is not specific.
   - **Success signal** — how do we know it worked? Ideally measurable; otherwise describe what an observer would see.
   - **Constraints** — bullets. Hard limits: deadlines, dependencies, must-not-touch areas, budget, compatibility.
7. Each section is **at most 3 lines**. If you can't fit it, you're designing instead of specifying.

### D. Title and criteria *(always)*

8. **Generate a clear title** — descriptive, not generic. Update the `# Title` in state.md.
9. **Define acceptance criteria** — concrete, testable conditions for "done":
   ```markdown
   ## Criteria
   - [ ] User can upload an avatar image
   - [ ] Fallback to initials when no avatar
   - [ ] Avatar displays at 32px, 48px, and 96px sizes
   ```
10. **Ask any remaining clarifying questions** that aren't covered by Refine. Wait for answers before reading code. Ask only when the answer materially changes what gets built.

### E. Investigate the code *(always)*

11. **Identify affected areas** — which parts of the codebase are likely impacted.
12. **Read relevant files systematically** — don't skim. Trace code paths end-to-end (UI → API → service → DB where applicable).
13. **Map the blast radius** — what existing functionality could be affected, what tests cover those areas.
14. **Note patterns and conventions** the codebase uses — Build must match them.
15. **DDD discovery** (project-wide convention — always do this):
    - **Bounded context** — which context does this work belong to? Note its name and the language it uses
    - **Subdomain type** — core (strategic differentiator), supporting (necessary but not differentiating), or generic (boilerplate that could be a library)?
    - **Ubiquitous language** — capture the domain terms the user uses (and that the existing code uses) verbatim. These will name the aggregates, methods, and events in Build
    - **Existing aggregates touched** — which aggregate roots in the current model will this work read from or modify? Are any new aggregates implied?
    - **Cross-context interactions** — does this work need to read or signal across context boundaries? Note where the anti-corruption layer would live
16. **Write a summary** of your understanding.

## Output (append to state.md, in order)

Update `## Criteria` with acceptance criteria, then append these sections (Refine and Spec only when run):

```markdown
### Plan: Refine

**Original Request:**
<copy of the relevant lines from ## Description>

**Ambiguities Found:**
- <ambiguity — what's vague and why it matters — or "None — request is clear">

**Framings Considered:**
1. <framing A — one sentence>
2. <framing B — one sentence>
3. <framing C — only if needed>

**Chosen Framing:** <A | B | C> (confirmed by user)

**Tightened Problem Statement:**
<one concrete sentence — this is what Spec works from>
```

```markdown
### Plan: Spec

**Goal:** <one observable sentence>

**Non-goals:**
- <thing we are explicitly not doing>

**Users:** <specific actor in a specific context>

**Success signal:** <what an observer would see, ideally measurable>

**Constraints:**
- <hard limit>
```

```markdown
### Plan: Clarify

**Understanding:** <2-3 sentence summary of what to build and why>

**Affected Areas:**
- <area 1>

**Confirmed Requirements:**
- <requirement 1>

**Assumptions:**
- <things you're proceeding with unless corrected>

**Open Questions:**
- <anything still unclear — empty if resolved>

**Notes:**
- <risks, dependencies, related past work — or "None">
```

```markdown
### Plan: Investigate

**Affected Files:**
- `path/to/file.ts` — <why relevant>

**Code Paths Traced:**
- <e.g., "User creation: form → action → service → DB">

**Patterns Found:**
- <e.g., "All API routes use zod validation + service delegation">

**Blast Radius:**
- <existing features that could break>
- <tests that cover these areas>

**DDD Map:**
- **Bounded Context:** <name>
- **Subdomain Type:** core | supporting | generic
- **Ubiquitous Language:** `<term>` — <meaning, source: user/code>
- **Aggregates Touched:** `<Aggregate>` (read | write | new)
- **Cross-Context:** <interaction with other context — or "None">

**Key Findings:**
- <surprises, important constraints, tech debt to navigate>
```

Also append to `## Decisions` if Refine produced one:

```markdown
- **Framing**: chose <A> over <B/C> — <why, in user's words if they explained>
```

## Loopback

If C (Spec) uncovers ambiguity that Refine missed: report `revise` and re-run Refine, then Spec. Max 2 iterations.

## Rules

- **Refine and Spec are conditional.** For bug-fix / small-change / refactor, skip them — the user already knows what they want. For feature / large-feature, always run them.
- **Define criteria before reading code** — intent first, implementation second.
- If a criterion can't be made testable, you don't understand the request yet.
- **Keep clarification lightweight** — 5 minutes of thinking, not 30. If the request is crystal clear after Refine, don't invent more questions.
- **Be thorough on investigation** — missed dependencies here cause bugs in Build.
- Note file paths precisely — they'll be referenced in Design.
- If the codebase has no tests for affected areas, flag it as a risk.
- Spec is for the next steps, not the user. The user already approved the framing in Refine.
- Do NOT propose architecture, file paths, libraries, APIs, or solutions — that's Design.
- If you encounter `[redacted: N lines — @wk-ignore]` placeholders, leave them alone — don't reconstruct or work around them.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The request is obvious — no need to Refine" | If it were obvious, the user wouldn't be at a feature-class request. The point of Refine is to catch the assumption *you* are about to make. Surface it. |
| "I'll pick the most likely framing and the user can correct me" | That wastes the next 6 steps if you guessed wrong. One question now saves an entire Build phase. |
| "The request is clear, no questions needed" | Ambiguity hides in assumptions. One clarifying question now prevents a wrong turn that wastes a Build phase. |
| "Acceptance criteria can be refined later" | Vague criteria produce vague implementations. If you cannot write a testable criterion now, you do not understand the request. |
| "I should add an Architecture section to Spec" | Plan/Design does architecture. Adding it here pollutes the boundary and Design has to re-litigate a decision Spec wasn't equipped to make. |
| "Non-goals feel like nitpicks, I'll skip them" | Non-goals are the most valuable section. They prevent scope creep in Build by stating up front what we're *not* doing. |
| "I already understand the codebase from the description" | You understand intent, not implementation. Blast radius and patterns live in code, not the request. |
| "The blast radius is obvious, no need to trace paths" | Obvious blast radius is the most common source of missed side-effects. Surprises live one hop beyond what seems obvious. |
