---
description: Review and refactor code to comply with NASA Power of 10 standards
argument-hint: [file-paths or scope]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# NASA

Enforce NASA JPL "Power of 10" coding standards on the target code.

Treat `$ARGUMENTS` as the requested scope when present. If the `nasa-coding-standards`
skill is installed, use it as the primary workflow and use its bundled references.
If the skill is unavailable, follow the same workflow directly.

## What This Command Does

1. Determine the target code from `$ARGUMENTS`, attached files, or the current selection
2. Detect the language and apply the correct NASA rule set
3. Audit the code against all 10 rules
4. Refactor the code to resolve violations while preserving behavior
5. Report findings and summarize the most important changes

## Usage

```bash
/nasa
/nasa src/main.c
/nasa src/api/users.ts src/lib/auth.ts
/nasa "the currently selected function"
```

## Implementation Steps

### 1. Determine the Target Scope

Resolve the code to review in this order:

1. If `$ARGUMENTS` is non-empty, treat it as the requested file path(s), directory, or scope
2. Otherwise, use attached files or the user's current code selection if available
3. If neither exists, ask the user to provide file paths or paste code, then stop

Do not broaden the scope to unrelated files unless the user explicitly asks.

### 2. Trigger the NASA standards workflow

Use the `nasa-coding-standards` skill if it is available.

Apply these rule sets:

- For **C/C++**, apply the original NASA JPL rules
- For **Python, JavaScript, TypeScript, Go, Java, Ruby, PHP, Rust, and similar languages**, apply the adapted interpreted-language rules
- For **mixed codebases**, apply the correct rule set per file

### 3. Audit all 10 rules

Inspect the target code and build a violation report with these columns:

```text
| # | Rule | Location | Violation | Severity |
```

Use these severities:

- `CRITICAL`: likely runtime failure, undefined behavior, or unbounded resource use
- `HIGH`: likely bug, dangerous maintainability issue, or strong NASA rule violation
- `MEDIUM`: analyzability or structure concern that still merits cleanup

Be strict. Do not downgrade clear violations into general suggestions.

### 4. Refactor the code

Rewrite the code to resolve every actionable NASA rule violation while preserving behavior.

Follow these constraints:

- Preserve the original logic and outputs
- Add inline comments only when the fix is non-obvious and a NASA rule citation helps
- Do not add explanatory comments that merely narrate the code
- Keep functions small and scope narrow
- Prefer bounded iteration, explicit checks, and predictable control flow

### 5. Verify the result

If the repository exposes safe verification commands, run targeted verification after edits.

Examples:

- C/C++: compiler warnings, static analyzers, or project test commands
- Python: `ruff`, `mypy`, `pytest`
- JavaScript/TypeScript: `eslint`, `tsc`, `vitest` or `jest`
- Go: `go test`, `go vet`, `staticcheck`

If no clear verification command is available, say so explicitly instead of guessing.

### 6. Report results

Structure the response in this order:

1. `language detected`
2. `rule set applied`
3. `violation report`
4. `refactored code`
5. `change summary`
6. `verification`

## Important notes

- Use this command for NASA standards enforcement, not generic code review
- If the user says `/nasa right` or similar while a file or selection is already in context, operate on that in-context target
- If the user provides only a snippet, audit only what is visible and call out rules that cannot be fully verified
- Do not silently skip rules because they are inconvenient in the target language. apply the adapted interpretation instead
- Stop and ask the user if the target scope is ambiguous

## Error handling

If any step fails:

- Report the exact step that failed
- Show the relevant error message
- Explain what information or action is needed to continue
- Do not invent missing file paths, commands, or project structure
