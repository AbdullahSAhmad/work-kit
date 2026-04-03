---
description: "Review sub-stage: OWASP top 10 security review."
---

# Security Review

**Role:** Security Auditor
**Goal:** Check for common security vulnerabilities.

## Instructions

Review the diff against OWASP Top 10:

1. **Injection** — SQL injection, command injection, code injection. Are all inputs parameterized?
2. **Broken Auth** — Are auth checks in place where needed? Session handling correct?
3. **Sensitive Data Exposure** — Are secrets, tokens, PII handled safely? No logging of sensitive data?
4. **Broken Access Control** — Can users access resources they shouldn't?
5. **Security Misconfiguration** — Default configs, unnecessary features enabled, overly permissive CORS?
6. **XSS** — User input rendered without sanitization? Raw HTML injection vectors?
7. **Insecure Deserialization** — Untrusted data parsed without validation?
8. **Vulnerable Dependencies** — Known CVEs in new dependencies?
9. **Insufficient Logging** — Security events logged? But no sensitive data in logs?
10. **CSRF** — State-changing requests protected?

Fix issues directly when possible. Document what you can't fix.

## Output (append to state.md)

```markdown
### Review: Security

**Findings:**
- <finding with severity: critical/high/medium/low — or "None">

**Fixes Applied:**
- <what was fixed — or "None">

**Remaining Risks:**
- <risks that need human attention — or "None">

**Severity Summary:** no issues | low | medium | high | critical
```

## Rules

- Focus on code YOU wrote/modified — not the entire codebase
- Not every feature touches all 10 categories — skip irrelevant ones
- Don't add security theater (unnecessary complexity for non-existent threats)
- If you find a critical issue, fix it immediately and note it prominently
