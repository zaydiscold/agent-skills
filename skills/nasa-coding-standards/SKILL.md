---
name: nasa-coding-standards
description: Enforce NASA JPL "Power of 10" safety-critical coding rules on C/C++, Python, JS, TS, or Go code. Use when user says "apply nasa rules", "check power of 10", "nasa coding standards", "safety-critical audit", or "verify code reliability". Do NOT use for general code review without safety-critical context.
metadata:
  author: zaydk
  version: 1.2.0
  upstream: https://github.com/zaydk/nasa-coding-standards
  compatibility: "Works with any code language. References optimized for C/C++ and interpreted languages (Python/JS/TS/Go)."
---

# NASA Coding Standards Enforcer

Apply NASA JPL's "Power of 10" rules for safety-critical, verifiable, reliable software. All 10 rules must pass for compliance.

## Quick Reference

| Step | Action | Output |
|------|--------|--------|
| 1 | Identify language | C/C++ or Interpreted |
| 2 | Load rules reference | `rules-c.md` or `rules-interpreted.md` |
| 3 | Audit all 10 rules | Violation table |
| 4 | Refactor code | Compliant version |
| 5 | Summarize changes | Impact by rule |

## Reference Navigation

Load based on target language:
- `references/rules-c.md` — Original 10 rules for C/C++
- `references/rules-interpreted.md` — Adapted rules for Python, JS, TS, Go

## Workflow

### Step 1: Identify Code & Language
Determine what to audit:
- **C/C++** → `references/rules-c.md`
- **Python/JS/TS/Go** → `references/rules-interpreted.md`
- **Mixed codebase** → Apply per-file rules

### Step 2: Load Rules
Read the appropriate reference file based on language.

### Step 3: Audit All 10 Rules
Systematically check each rule. Record every violation:

| Field | Description |
|-------|-------------|
| Rule # | R1 through R10 |
| Location | file:line or function |
| Issue | Specific violation |
| Severity | CRITICAL / HIGH / MEDIUM |

Severity guidelines:
- **CRITICAL**: Risk of crash, infinite loop, memory corruption
- **HIGH**: Clear rule violation with safety impact
- **MEDIUM**: Subjective boundary, stylistic concern

### Step 4: Generate Report
Output violation table:
```markdown
| # | Rule | Location | Violation | Severity |
|---|------|----------|-----------|----------|
| 2 | R2 | main.c:12 | while loop bound not fixed | CRITICAL |
| 5 | R5 | utils.c:45 | recursion depth unbounded | HIGH |
```

Include summary: `X/10 rules passed (Y% compliance)`

### Step 5: Refactor to Compliance
Rewrite code to resolve ALL violations:
- Add inline comments citing rules: `// NASA R2: explicit loop bound`
- Do not narrate behavior, just implement fixes
- Verify all 10 rules pass in new version

### Step 6: Impact Summary
Bulleted list of changes grouped by rule. Focus on why changes improve safety, not what changed mechanically.

## Examples

### Audit C code
User: "Apply NASA rules to this embedded driver"
```c
// Input: driver.c with dynamic allocation
// Output: Violation table + refactored code with static allocation
// R1-R10 check, R1 violation found (malloc used), fixed with fixed-size pool
```

### Audit Python script
User: "Check my Python against power of 10"
```python
# Input: data_processor.py
# Output: R3 violation (function >60 lines), R5 violation (recursion)
# Refactored: split functions, converted recursion to iteration
```

### Verify compliance
User: "Does this code meet NASA standards?"
```
# Full audit, if 10/10 pass:
# "All 10 rules passed. Code meets NASA JPL safety-critical standards."
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Can't determine language | Mixed extensions | Ask user to specify, or audit per-file |
| Rule ambiguous for language | JS async vs sync | Use judgment, document decision |
| All rules fail | Legacy code | Prioritize CRITICAL, iterate |
| Already compliant | Good code | Clearly state "10/10 rules passed" |

## Pattern: Domain-Specific Intelligence

This skill embeds **safety-critical domain expertise** beyond generic code review.

### Compliance-First Processing
**Before action, always apply domain rules:**

1. **Safety assessment**: Could this code run in a life-critical system?
2. **Rule hierarchy**: R1 (static allocation) > R2 (loop bounds) > R5 (recursion) > others
3. **Exception handling**: If a rule cannot apply, document with `// NASA EXCEPTION: <reason>`
4. **Audit trail**: Every decision must be explainable to a safety review board

### Context-Aware Severity
Same violation, different severity based on context:

| Context | R1 (no malloc) | R5 (no recursion) |
|---------|---------------|-------------------|
| Embedded flight software | CRITICAL | CRITICAL |
| Ground control tools | HIGH | MEDIUM |
| Test harnesses | MEDIUM | LOW |
| Simulation code | LOW | LOW |

### Decision Tree for Rule Violations

```
Is the code in a safety-critical path?
├── YES → All rules apply strictly, no exceptions without documentation
└── NO → Apply with context:
    ├── Performance-critical? → R1, R2 still HIGH
    ├── User-facing? → R3, R4 prioritized
    └── Internal tooling? → MEDIUM severity acceptable
```

## Core Principles

- **Safety first**: These rules prevent catastrophic failure in spacecraft. Be strict.
- **All 10 must pass**: Partial compliance is non-compliance
- **Document exceptions**: If a rule truly cannot apply, explain why inline
- **No false confidence**: If unsure about a violation, flag it as MEDIUM for human review
- **Context matters**: Same code, different severity based on where it runs
