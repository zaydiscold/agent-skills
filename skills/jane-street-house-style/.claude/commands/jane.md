---
description: Audit and refactor code to Jane Street house style (correctness-by-types, brevity, illegal-states-unrepresentable)
argument-hint: [file-paths or scope]
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Jane

Apply Jane Street's house style to the target code.

Treat `$ARGUMENTS` as the requested scope when present. If the
`jane-street-house-style` skill is installed, use it as the primary workflow and its
bundled references. If the skill is unavailable, follow the same workflow directly.

## What This Command Does

1. Determine the target code from `$ARGUMENTS`, attached files, or the current selection
2. Detect the language and load the correct rule set
3. Audit against the twelve tenets (JS1–JS12)
4. Refactor to comply while preserving behavior
5. Report findings and summarize the most important changes by tenet

## Usage

```bash
/jane
/jane src/lib/order.ts
/jane lib/id.ml lib/id.mli
/jane "the selected function"
```

## Implementation Steps

### 1. Determine the target scope
1. If `$ARGUMENTS` is non-empty, treat it as the file path(s), directory, or scope
2. Otherwise use attached files or the current selection
3. If neither exists, ask the user to provide paths or paste code, then stop

Do not broaden scope to unrelated files unless asked.

### 2. Trigger the Jane Street workflow
Use the `jane-street-house-style` skill if available.

- **OCaml** (`.ml`/`.mli`) → the literal house rules in `references/ocaml.md`
  (Base/Core, `.mli`-as-spec, `[@@deriving]`, `Or_error`, `ppx_js_style`, ocamlformat
  janestreet profile).
- **Any other language** (TS, Rust, Python, Go, …) → the ported tenets in
  `references/principles.md`.
- **Mixed repo** → apply per file.

### 3. Audit against JS1–JS12
Build a violation report:

```text
| # | Tenet | Location | Issue | Class |
```

Classes encode the Jane Street hierarchy — correctness first, then clarity, then polish:

- `CORRECTNESS`: can produce or hide a bug (representable illegal states, non-exhaustive
  matches, exceptions for control flow, unchecked errors, aliasing mutation)
- `CLARITY`: hurts readability/maintainability (ceremony, cleverness, weak names, no `.mli`,
  hand-rolled boilerplate)
- `POLISH`: idiomatic nits (naming suffixes, formatter-fixable layout, inline-able bindings)

Be honest, not exhaustive-for-its-own-sake. If clean, say so.

### 4. Refactor
Rewrite to resolve violations while preserving behavior.

- Lead with type-level fixes (JS2, JS3) — they usually delete downstream runtime checks.
- Add a comment only when a fix is non-obvious; cite the tenet (`// JS3: return Result`).
- Don't narrate mechanical changes. Don't smuggle in behavior changes — surface them.

### 5. Verify (when tooling exists)
- OCaml: `dune build @check`, `ocamlformat --check`, `dune runtest`
- TypeScript: `tsc --noEmit`, `eslint`
- Rust: `cargo clippy -- -D warnings`, `cargo test`
- Python: `ruff check`, `mypy`, `pytest`
- Go: `go vet`, `staticcheck`, `go test`

If no clear verification command exists, say so instead of guessing.

### 6. Report
Order: `language detected` · `rule set applied` · `violation report` · `refactored code`
· `change summary (by tenet)` · `verification`.

## Important notes

- Use this for Jane Street house-style enforcement, not generic code review.
- Correctness beats cleverness beats brevity — JS6 (brevity) never overrides JS2 (illegal
  states) or JS3 (errors as values).
- On languages without static types, enforce what applies (necessity, brevity, exhaustiveness,
  errors-as-values) and recommend adding types where JS2 needs them.
- Stop and ask if the target scope is ambiguous.

## Error handling

If a step fails: report the exact step, show the error, explain what's needed, and do not
invent file paths, commands, or project structure.
