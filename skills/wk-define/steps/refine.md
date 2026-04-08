---
description: "Define step: Surface ambiguity in the request, propose framings, get user to pick one."
---

# Refine

**Role:** Idea Refiner
**Goal:** Take the user's raw description and turn it into a tightened, unambiguous problem statement. If the request is fuzzy, surface that — don't paper over it.

## Instructions

1. **Read the request** in `.work-kit/state.md` under `## Description`.

2. **Identify ambiguities.** Look for:
   - Vague nouns ("the system", "users", "better")
   - Implicit assumptions ("obviously", "just", "simple")
   - Missing actors (who triggers it? who benefits?)
   - Missing scope (one screen? whole feature? whole product area?)
   - Conflicting framings (could mean A or B and they lead to different builds)

3. **Generate 1–3 framings.** A framing is a one-sentence interpretation of what the user *probably* means. If the request is genuinely clear, generate ONE framing and confirm it. If it's ambiguous, generate 2–3 distinct framings that lead to materially different builds.

4. **Ask the user to pick** one framing or correct all of them. **You must wait for the answer.** Do not silently pick.

5. **Write the tightened problem statement** based on the chosen framing. One sentence. Concrete nouns, named actors, observable outcome.

## Output (append to state.md)

```markdown
### Define: Refine

**Original Request:**
<copy of the relevant lines from ## Description>

**Ambiguities Found:**
- <ambiguity 1 — what's vague and why it matters>
- <ambiguity 2>
- <... or "None — request is clear">

**Framings Considered:**
1. <framing A — one sentence>
2. <framing B — one sentence>
3. <framing C — one sentence — only if needed>

**Chosen Framing:** <A | B | C> (confirmed by user)

**Tightened Problem Statement:**
<one concrete sentence — this is what Spec will work from>
```

Also append to `## Decisions`:

```markdown
- **Framing**: chose <A> over <B/C> — <why, in user's words if they explained>
```

## Rules

- ONE step, ONE deliverable: a tightened problem statement.
- You **must** ask the user to pick when there are multiple framings. Picking silently violates the "Ask, don't decide" principle.
- Refine is allowed to be 5 minutes of work. If it takes longer, you're doing Plan's job.
- Do NOT read code. Do NOT propose solutions. Do NOT design anything.

## Anti-Rationalization

| Excuse | Reality |
|--------|---------|
| "The request is obvious — no need to ask" | If it were obvious, the user wouldn't need a Define phase. The whole point of Refine is to catch the assumption *you* are about to make. Surface it. |
| "I'll pick the most likely framing and the user can correct me" | That wastes the next 6 steps if you guessed wrong. One question now saves an entire Plan phase. |
| "Generating multiple framings feels artificial" | If you can only think of one framing, generate one and confirm it. The point is *finding* alternatives, not faking them. |
| "I'll combine all framings into one comprehensive scope" | Combining framings produces a vague spec that means nothing. Pick one. The others go in non-goals if they came close. |
