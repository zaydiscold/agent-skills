---
name: nasa-coding-standards
description: Enforce NASA JPL "Power of 10" safety-critical coding rules on C/C++, Python, JS, TS, or Go code. Use when user says "apply nasa rules", "check power of 10", "nasa coding standards", "safety-critical audit", or "verify code reliability". Do NOT use for general code review without safety-critical context.
metadata:
  author: zaydk
  version: 1.3.0
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

## Problem-First Framing

This skill is **problem-first**: User describes outcome ("make this code safe for embedded use"), skill handles the tool (NASA rule enforcement). Users never specify which rules to check — you apply all 10 rules systematically.

User intent → Language detection → Rule reference selection → Full audit → Refactor → Summary.

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

**Step 1: Identify language & load rules**
```
Language: C
Loading: references/rules-c.md
```

**Step 2: Audit with violation table**
```markdown
| # | Rule | Location | Violation | Severity |
|---|------|----------|-----------|----------|
| 1 | R1 | driver.c:23 | malloc() used in init | CRITICAL |
| 2 | R2 | driver.c:45 | while loop without fixed bound | CRITICAL |
| 3 | R5 | utils.c:12 | recursive error handler | HIGH |

Compliance: 7/10 rules passed (70%)
```

**Step 3: Refactored output**
```c
// NASA R1: Static allocation only — fixed-size buffer pool
static uint8_t buffer_pool[DRIVER_BUFFER_COUNT][BUFFER_SIZE];

// NASA R2: All loops must have fixed bounds
for (int i = 0; i < MAX_RETRIES; i++) {  // Fixed: explicit bound
    // ...
}

// NASA R5: No recursion — converted to iteration
void handle_error(int code) {
    // Iterative error handling stack
    while (code != 0) { ... }
}
```

**Step 4: Impact summary**
```
Changes by rule:
- R1: Replaced malloc with static pool (prevents memory fragmentation)
- R2: Added explicit loop bounds (prevents infinite loops)
- R5: Converted recursion to iteration (prevents stack overflow)
```

### Audit Python script
User: "Check my Python against power of 10"

**Input:** data_processor.py
```python
def process(data):
    if len(data) > 1:
        return process(data[:len(data)//2]) + process(data[len(data)//2:])  # R5 violation: recursion
    return data[0]

def main():
    # 120 lines of code here...  # R3 violation: function too long
    pass
```

**Output:**
```markdown
| # | Rule | Location | Violation | Severity |
|---|------|----------|-----------|----------|
| 3 | R3 | main() | 120 lines (>60 limit) | HIGH |
| 5 | R5 | process() | Unbounded recursion | HIGH |

Compliance: 8/10 rules passed (80%)
```

**Refactored:**
```python
def process(data):
    # NASA R5: Converted to iteration
    stack = [data]
    result = 0
    while stack:
        current = stack.pop()
        if len(current) > 1:
            stack.extend(split(current))
        else:
            result += current[0]
    return result

def main():
    setup()  # NASA R3: Split into sub-functions
    process_data()
    cleanup()
```

### Verify compliance
User: "Does this code meet NASA standards?"

**Full audit result:**
```markdown
| # | Rule | Status | Notes |
|---|------|--------|-------|
| 1 | R1 | ✓ PASS | No dynamic allocation |
| 2 | R2 | ✓ PASS | All loops bounded |
| 3 | R3 | ✓ PASS | All functions <60 lines |
| 4 | R4 | ✓ PASS | No function pointers |
| 5 | R5 | ✓ PASS | No recursion |
| 6 | R6 | ✓ PASS | Data flow checked |
| 7 | R7 | ✓ PASS | All returns checked |
| 8 | R8 | ✓ PASS | Limited preprocessor use |
| 9 | R9 | ✓ PASS | Pointers limited |
| 10 | R10 | ✓ PASS | No standard warnings |

Result: **All 10 rules passed. Code meets NASA JPL safety-critical standards.**
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
