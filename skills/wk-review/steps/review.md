---
description: "Review step: Fan out 4 parallel reviewer sub-agents (Quality, Efficiency, Security, Compliance). Report-only — Resolve does the fixing."
---

# Review

**Role:** Review Conductor
**Goal:** Run the 4 reviewer lenses Scope selected. Each lens is a focused sub-agent with a concrete pattern checklist. They report findings; they do NOT fix.

## How this step runs

1. Read `### Review: Scope` — note the **Reviewers to spawn** list and **Scope boundaries**
2. Read `### Build: Final`, `### Plan: Final`, `## Criteria` — these are passed forward to sub-agents
3. Capture the diff: `git diff main...HEAD`
4. **Use the Agent tool to spawn the selected reviewers in a single message** — true parallel fan-out (mirrors the `simplify` skill's pattern). Each gets its lens spec from this file plus the diff and relevant context
5. Wait for all to complete. Each writes its own `### Review: <Lens>` section to state.md
6. After all four have reported, append a `### Review: Roundup` section listing total findings by severity per lens

Reviewer subset is chosen by Scope. Self-Review is not a separate lens — its concerns are absorbed into Quality. Performance is absorbed into the broader Efficiency lens.

## Universal reviewer rules (apply to every lens)

These rules ride along in every sub-agent prompt. The Conductor pastes them into each sub-agent invocation.

- **Specificity** — every finding cites `file:line — what's wrong — suggested fix`. Vague flags ("naming could be better") are rejected. Either name the line and the better name, or skip it.
- **Reuse-first** — before flagging "missing X" or "should add X", grep the codebase for existing utilities, helpers, value objects, or patterns. If one exists, the finding becomes "use existing `<thing>` at `<path>`". If you suggest *new* code, briefly state why no existing pattern fits.
- **Scope respect** — items listed in **Scope boundaries** from `### Review: Scope` are intentionally deferred. Do NOT flag them as gaps, missing features, or incomplete work. Review code that was actually written or modified.
- **No fixing** — never edit code. Resolve aggregates and fixes everything in one pass.
- **Severity** — tag every finding `critical | high | medium | low`. Reserve `critical` for security blockers and code that will fail in production. Reserve `high` for bugs and significant correctness issues. `medium` is the default for actionable code-quality issues. `low` is nit / cleanup.
- **Redaction** — if you encounter `[redacted: N lines — @wk-ignore]` placeholders, leave them alone. Do not reconstruct or work around them. If you suspect a real issue inside one, flag it for human review.

---

## Lens A — Quality

**Role:** Code Quality Reviewer
**Goal:** Catch code that works but is hand-rolled, duplicated, leaky, or careless. Absorbs Self-Review's "obvious mistakes" sweep.

### Checklist (walk this list against the diff)

1. **Reuse misses** — newly written function/utility that duplicates an existing one. Search the codebase first; recommend the existing function.
2. **Inline logic that should use a utility** — hand-rolled string manipulation, manual path handling, custom env checks, ad-hoc type guards, ad-hoc date math. If a project utility exists, use it.
3. **Redundant state** — state that duplicates existing state, cached values that could be derived, observers/effects that could be direct calls.
4. **Parameter sprawl** — adding a new parameter to a function (especially a flag) instead of generalizing or restructuring. Especially watch for `boolean` flags that hint at two distinct functions.
5. **Copy-paste with slight variation** — near-duplicate code blocks that should be unified with a shared abstraction.
6. **Leaky abstractions** — exposing internal details that should be encapsulated, or breaking existing abstraction boundaries (UI reaching into repositories, controllers calling aggregates directly, etc.).
7. **Stringly-typed code** — raw strings where constants, string-union types, branded types, enums, or value objects already exist in the codebase.
8. **Unnecessary nesting** — wrapper components / `<div>` / `Box` that add no layout or semantic value. Check if inner element props (`flexShrink`, `alignItems`, etc.) already give the needed behavior.
9. **Unnecessary comments** — comments explaining WHAT the code does, narrating the change ("added for the X flow"), or referencing the task/caller/PR. Keep only non-obvious WHY (hidden constraints, subtle invariants, workarounds).
10. **Dead code & unused imports** — anything not reachable, anything imported but unused, TODOs that should be resolved, debug code (console.log, debugger, commented-out blocks).
11. **Unclear naming** — names that don't reflect the ubiquitous language from Plan/Understand. Suggest the better name (don't flag without one).
12. **Linter warnings** — run the project's linter on the diff and list every warning as a finding (Resolve fixes them).

### Output

```markdown
### Review: Quality

> **Note:** Skip `[redacted: N lines — @wk-ignore]` placeholders.

**Verdict:** clean | issues_found
**Findings:**
- <severity> `<file>:<line>` — <what's wrong> — <suggested fix, naming the existing helper if reuse>

**Linter:** <N warnings — list them> | clean
```

### Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "My code is already clean" | You wrote it minutes ago — re-read it as if someone else wrote it. Look for naming, missing edge cases, unclear logic. |
| "These are minor style issues, not worth fixing" | Minor issues compound. Each takes seconds; deferring them creates tech debt. |
| "The linter didn't flag anything" | Linters catch syntax and formatting. They miss unclear names, missing edge cases, redundant logic, leaky abstractions. |
| "There's no existing helper for this" | Did you actually grep? "I assume there isn't" is the most common reuse miss. |

---

## Lens B — Efficiency

**Role:** Efficiency Engineer
**Goal:** Catch unnecessary work, missed concurrency, hot-path bloat, and resource leaks. Subsumes the old Performance lens with the broader simplify-style efficiency patterns.

### Checklist

1. **Unnecessary work** — redundant computations, repeated file/network reads, duplicate API calls, work re-done inside loops or per-render.
2. **N+1 patterns** — loops that make individual DB or API calls instead of batching. Suggest the batch primitive.
3. **Missing indexes** — new query patterns over a column without an index. List the column and the table.
4. **Missed concurrency** — independent async operations run sequentially when `Promise.all` / `asyncio.gather` / equivalent would be safe and faster.
5. **Hot-path bloat** — new blocking work added to startup paths, per-request handlers, or per-render component bodies. Heavy imports inside hot functions.
6. **Recurring no-op updates** — state/store updates inside polling loops, intervals, or event handlers that fire unconditionally. Add a change-detection guard so downstream consumers aren't re-notified when nothing changed. If a wrapper function takes an updater/reducer callback, verify it honors same-reference returns (otherwise callers' early-return no-ops are silently defeated).
7. **TOCTOU / unnecessary existence checks** — pre-checking file/resource existence before operating. Operate directly and handle the error.
8. **Unbounded data structures** — caches, arrays, maps that grow without a bound or eviction policy. Event listeners, intervals, subscriptions added without cleanup.
9. **Overly broad operations** — reading entire files when a slice is needed, loading all rows when filtering for one, fetching whole records to read one field.
10. **Bundle bloat** — importing entire libraries when one function is needed. Default-import of large libs with tree-shakable exports.
11. **Missing pagination** — unbounded list renders, unbounded queries.
12. **Missing memoization for proven hot work** — only flag if the work is actually hot; do not premature-optimize one-time page-load work.

### Output

```markdown
### Review: Efficiency

**Verdict:** clear | issues_found
**Findings:**
- <severity> `<file>:<line>` — <pattern, e.g. "N+1 query in user list"> — <suggested fix>

**Recommendations (non-blocking):**
- <future optimization noted but not flagged as a finding — or "None">
```

### Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "It's fast enough now" | "Now" is small data. Anything that scales with data needs to be flagged. |
| "Premature optimization is the root of all evil" | The quote is about *micro-optimization*. Algorithmic and concurrency wins (N+1, missed parallelism) are not premature. |
| "Existence-checking before reading is safer" | TOCTOU race condition. Operate directly and handle the error. |
| "I'll add the index later" | Migrations slip. List the index now so Resolve can add it. |

---

## Lens C — Security

**Role:** Security Auditor
**Goal:** Walk the diff against OWASP Top 10. Focus on the specific threats this change introduces.

### Checklist

1. **Injection** — SQL, command, code injection. Are all user inputs parameterized? Any string concatenation into queries or shell commands?
2. **Broken authentication** — Are auth checks present where needed? Session handling correct? Password storage hashed with a current algorithm?
3. **Sensitive data exposure** — Secrets, tokens, PII handled safely? No logging of sensitive data? Encryption at rest and in transit where required?
4. **Broken access control** — Can users access resources they shouldn't? Authorization checks per-resource, not just per-route? Insecure direct object references?
5. **Security misconfiguration** — Default configs, unnecessary features enabled, overly permissive CORS, leaked stack traces, debug endpoints exposed.
6. **XSS** — User input rendered without sanitization? Raw HTML injection vectors? Unsafe HTML insertion APIs receiving user content?
7. **Insecure deserialization** — Untrusted data parsed without validation? Schema validation at the edge?
8. **Vulnerable dependencies** — New deps with known CVEs? Pinned to a specific version?
9. **Insufficient logging / monitoring** — Security events logged? But no sensitive data in logs?
10. **CSRF** — State-changing requests protected? SameSite cookies set?

### Output

```markdown
### Review: Security

> **Note:** If a `[redacted: N lines — @wk-ignore]` block might hide a security issue, flag it for human review rather than reconstructing.

**Verdict:** clear | risks_noted | blocked
**Findings:**
- <severity> `<file>:<line>` — <OWASP category> — <what's wrong> — <suggested fix>

**Risks (not blockers):**
- <risk needing human attention — or "None">

**Severity Summary:** no issues | low | medium | high | critical
```

### Rules

- Focus on code in the diff — not the whole codebase
- Skip categories that genuinely don't apply (no auth changes → skip auth section)
- "Handled elsewhere" is the most common security gap. Verify the claim — check the actual validation at the boundary.
- Critical/high findings are blockers — note them prominently for Resolve

### Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "This feature doesn't touch auth, no security concerns" | Security ≠ auth. Input validation, data exposure, injection, CSRF, insecure defaults exist in every feature handling user data. |
| "Input validation is handled elsewhere" | Verify it. Each layer assumes another layer validates. Check actual validation at every boundary. |
| "This is internal-only, security doesn't matter" | Internal APIs become external when architectures change. Networks get compromised. Validate every input. |

---

## Lens D — Compliance

**Role:** Compliance Auditor
**Goal:** Verify the implementation matches the Blueprint from Plan/Design.

### Instructions

1. Re-read the Blueprint from `### Plan: Final` in state.md
2. For each Blueprint step, classify status: `done | deviated | skipped`
3. Cross-reference any items in **Scope boundaries** — those are intentional exclusions, not skipped steps
4. Check architecture alignment: data model, API surface, components match Plan/Design
5. Check UX Flow alignment (if UI was in scope): screens, interactions, states match
6. Note scope creep — anything built that wasn't in the Blueprint
7. Read `## Deviations` from state.md — Build may have already self-reported some; cross-check those are documented honestly

### Output

```markdown
### Review: Compliance

**Result:** compliant | deviations_found

**Blueprint Steps:** (every step MUST appear with a status)
- Step 1: <done | deviated | skipped> — <one-line note if deviated/skipped>
- Step 2: ...

**Architecture alignment:** matches | drifted (<details>)
**UX Flow alignment:** matches | drifted | n/a

**Deviations (post-build, not yet in `## Deviations`):**
- <severity> <Blueprint step>: <what changed> — <justification or "needs justification">

**Scope creep:**
- <severity> <file:line> — <thing built outside the Blueprint> — <why it should/shouldn't stay>
```

### Rules

- Deviations aren't always bad — sometimes the plan was wrong and the code adapted. But they need a justification.
- "I felt like it" is not a justification.
- Missing steps are a red flag — they need to be implemented or explicitly dropped with reason.
- Intentionally deferred items (per Scope boundaries) are not deviations.
- Scope creep should be called out even if the extra code is good — Resolve decides whether it stays.

### Anti-rationalization

| Excuse | Reality |
|--------|---------|
| "The deviations are improvements" | Improvements still need documentation. Future readers need to know it was intentional, not accidental drift. |
| "The Blueprint was wrong, so compliance doesn't apply" | If the Blueprint was wrong, that's itself a finding. Compliance catches plan-vs-reality drift in both directions. |
| "Minor scope additions don't count" | They compound. If it wasn't in the Blueprint, it's scope creep — record it. Resolve decides what to do. |

---

## Roundup output

After all sub-agents complete, the Conductor (this step's main agent) appends a single roundup so Resolve can plan its work:

```markdown
### Review: Roundup

**Reviewers run:** <list — e.g. Quality, Efficiency, Security, Compliance>
**Reviewers skipped:** <list with reason — or "None">

**Findings by lens:**
- Quality: <N> (critical: <n>, high: <n>, medium: <n>, low: <n>)
- Efficiency: <N> (...)
- Security: <N> (...)
- Compliance: <N> (...)

**Blockers (critical/high):** <count>
**Total findings:** <N>
```

The Conductor does not write a verdict — Resolve owns the ship decision.
