---
name: nasa-coding-standards
description: Enforce strict safety-critical guidelines. Use when user asks to "apply nasa rules", "check power of 10", "power of 10", "nasa coding standards", or audit code against safety-critical constraints.
metadata:
  author: zaydk
  version: 1.1.0
---

# NASA Coding Standards Enforcer

Enforce NASA JPL's "Power of 10" coding rules on any codebase to automatically produce verifiable, reliable, and safety-critical software.

## Quick Reference
1. Determine Language (C/C++ vs Interpreted)
2. Run standard audit checking all 10 rules.
3. Generate violation report table (Rule, Location, Reason, Severity).
4. Refactor code to resolve rules completely.
5. Summarize impactful changes by rule.

## Reference Navigation
Review these references depending on the target code's language:
- `references/rules-c.md` - The original 10 rules for C/C++
- `references/rules-interpreted.md` - Adapted 10 rules for Python, JS, TS, Go

## Workflow

### 1. Identify Code & Language
Ask the user what files or code to audit. Identify the language out of:
- **C/C++**: Apply `references/rules-c.md`
- **Interpreted**: Apply `references/rules-interpreted.md`
- **Mixed**: Apply per file.

### 2. Audit Every Rule
Walk through all 10 rules. For every violation found, record:
- **Rule No.**
- **Location**
- **Issue**
- **Severity**: CRITICAL, HIGH, or MEDIUM.

### 3. Generate Report
Generate a table holding the findings:
```markdown
| # | Rule | Location | Violation | Severity |
|---|------|----------|-----------|----------|
| 1 | R2 | main():12 | while loop bound not fixed | CRITICAL |
```
Include a summary of total violations and compliance % below.

### 4. Refactor
Automatically rewrite snippet/file to resolve ALL violations:
- Add a brief inline comment citing the rule where non-obvious (e.g., `// NASA R2: explicit loop bound`)
- Do not narrate behavior.

### 5. Summary
Conclude with a bulleted list of why changes were made, grouped by rule. Do not repeat the output report; focus on the impact.

## Guidelines
- NASA rules prevent catastrophic failure. Be incredibly strict.
- Medium severity should be used for subjective boundary breaks.
- If code already passes 10/10, say so clearly.
