---
name: jane-street-house-style
description: Audit and refactor code to Jane Street's house style — correctness-by-construction, brevity that clarifies, and "make illegal states unrepresentable." Use when the user says "apply jane street style", "make this more jane street", "/jane", "tighten this up", "jane street review", or wants terse, type-safe, functional-flavored code. On OCaml it enforces the real house rules (Base/Core, .mli-as-spec, [@@deriving], Or_error, ppx_js_style); on any other language it enforces the transferable principles. Do NOT use for generic code review with no correctness/brevity/typing angle.
metadata:
  author: zaydk
  version: 1.0.0
  upstream: https://github.com/zaydiscold/agent-skills
  compatibility: "Primary target OCaml; principles apply to TypeScript, Rust, Python, Go, Haskell, F#, ReScript, and any statically-typed or type-hinted language."
---

# Jane Street House Style Enforcer

Jane Street is an OCaml shop famous for a house style built around one idea: **let the
types do the work.** Code should be correct by construction, say what it means in as
few moving parts as possible, and make the wrong thing impossible to write rather than
merely discouraged.

This skill audits code against that style and refactors it to comply. It has two modes,
chosen automatically:

- **OCaml** → enforce the literal house rules (Base/Core, `.mli` as spec, `[@@deriving]`,
  `Or_error`, the `ppx_js_style` checks, the `ocamlformat` `janestreet` profile).
  Load `references/ocaml.md`.
- **Any other language** → enforce the *transferable principles* — necessity, brevity,
  illegal-states-unrepresentable, errors-as-values, immutability, exhaustive matching,
  strictness. The OCaml mechanism (a variant, a `.mli`, `Or_error.t`) maps to the host
  language's equivalent (a discriminated union, a narrow public surface, `Result`).
  Load `references/principles.md`.

The point isn't OCaml cosplay. It's that Jane Street's discipline — every line earns its
keep, invariants live in types, errors are values not surprises — makes *any* codebase
tighter and safer.

## Quick Reference

| Step | Action | Output |
|------|--------|--------|
| 1 | Detect language | OCaml vs. other |
| 2 | Load rule set | `ocaml.md` or `principles.md` |
| 3 | Audit against JS1–JS12 | Violation table |
| 4 | Refactor to comply | Tighter, type-safe code |
| 5 | Summarize by tenet | Impact grouped by tenet |
| 6 | Verify if tooling exists | `dune`/`ocamlformat` · `tsc`/`eslint` · `cargo clippy` · `ruff`/`mypy` |

## Problem-First Framing

The user describes an outcome ("make this tighter", "this feels un-jane-street", "clean
up this module"). They do **not** name tenets or reference files — you select and apply
them. Users never need to know:

- Which of the twelve tenets a given smell violates
- Whether their language gets the OCaml rules or the ported principles
- What `[@@deriving]` or `Or_error` map to in their language

You handle that translation internally.

## The Twelve Tenets (JS1–JS12)

These are the spine of the audit. Each has an OCaml-native form and a
port to other languages; the reference files elaborate both. Ordered roughly by the
Jane Street value hierarchy — **correctness first, then clarity, then polish.**

| # | Tenet | The smell it kills |
|---|-------|--------------------|
| JS1 | **Interface is the spec** | Sprawling public surface; internals leaking; no separation of "what" from "how". OCaml: every module has a written `.mli`. |
| JS2 | **Make illegal states unrepresentable** | Boolean flags and stringly-typed status where a variant/sum type belongs; invariants enforced at runtime instead of by the type. Parse, don't validate. |
| JS3 | **Errors are values** | Exceptions for expected failure; `null` returns; swallowed errors. Use `Result`/`option`/`Or_error`. Exceptions only for genuine bugs; partial functions get an `_exn` suffix. |
| JS4 | **Immutability by default** | Mutable state and in-place updates where a pure transformation would do. Mutation must be local and justified. |
| JS5 | **Necessity — every line earns its keep** | Dead code, unused params, speculative generality, single-caller abstractions, needless intermediate bindings. YAGNI. |
| JS6 | **Brevity that clarifies** | Ceremony, boilerplate, restating the type in the name, five lines doing one line's work — *and its opposite*, terseness that hides meaning. |
| JS7 | **Explicit over clever** | Magic, hidden effects, wildcard `open`/`import *`, point-free golf that obscures, implicit coercions. Control flow and effects should be visible. |
| JS8 | **Total functions & exhaustive matching** | Non-exhaustive matches; catch-all `_ ->`/`default:` that silently swallows new cases; `if` chains where a match over a closed set belongs. |
| JS9 | **Consistent, intent-revealing names** | The principal type of a module is `t`; suffix conventions (`_exn`, `_opt`); snake_case values / Capitalized types in OCaml, host idiom elsewhere; no Hungarian, no noise words. |
| JS10 | **Derive mechanical code** | Hand-written equality, comparison, hashing, serialization. Generate it (`[@@deriving]`, `#[derive]`, codegen/schema) so it can't drift. |
| JS11 | **Strict everywhere, zero warnings** | Loose compiler/linter settings; warnings tolerated. Turn everything up (warnings-as-errors, `tsc --strict`, `clippy -D warnings`, `ruff`+`mypy`, `ppx_js_style`). |
| JS12 | **Colocated tests, interface docs** | Tests far from code; comments narrating *how* the code works line-by-line. Prefer inline expect-tests and doc comments on the public surface explaining *what/why*. |

## Reference Navigation

Load exactly one, based on detected language. All workflow guidance is here in SKILL.md.

| Reference | Load when |
|-----------|-----------|
| `references/ocaml.md` | Auditing OCaml (`.ml`/`.mli`) — the literal, cited house rules |
| `references/principles.md` | Auditing any other language — the ported tenets with per-language mappings |

## Workflow

### Step 1: Detect language & load rules
- `.ml`/`.mli`, `dune`/`dune-project`, `open Core`/`open Base` → **OCaml** → `references/ocaml.md`
- Anything else (`.ts`/`.tsx`, `.rs`, `.py`, `.go`, `.hs`, `.res`, …) → **principles** → `references/principles.md`
- Mixed repo → apply per file.

### Step 2: Audit against JS1–JS12
Walk the code tenet by tenet. Record every violation:

| Field | Meaning |
|-------|---------|
| Tenet | JS1–JS12 |
| Location | file:line or function/module |
| Issue | The specific smell |
| Class | CORRECTNESS / CLARITY / POLISH |

Severity classes encode the Jane Street hierarchy — a representable illegal state or a
swallowed error is not the same weight as a verbose name:

- **CORRECTNESS** — the violation can produce or hide a *bug*: representable illegal
  states, non-exhaustive matches, exceptions used for control flow, mutation causing
  aliasing, unchecked errors.
- **CLARITY** — hurts readability/maintainability but isn't a latent bug: ceremony,
  clever code, weak names, `.mli`-less modules, hand-rolled boilerplate.
- **POLISH** — idiomatic nits: naming suffixes, formatting the autoformatter would fix,
  a binding that could be inlined.

### Step 3: Report
Emit the violation table, then a compliance line:

```markdown
| # | Tenet | Location | Issue | Class |
|---|-------|----------|-------|-------|
| JS2 | illegal states | order.ts:14 | `status: string` + `paidAt?: Date` — 3 impossible combos representable | CORRECTNESS |
| JS3 | errors are values | order.ts:31 | throws on missing item for expected "not found" | CORRECTNESS |
| JS5 | necessity | order.ts:52 | `formatOrderResultData()` has one caller | CLARITY |

Compliance: 9/12 tenets clean · 2 correctness, 1 clarity issue
```

### Step 4: Refactor to comply
Rewrite to resolve every actionable violation while preserving behavior.

- Lead with the type-level fixes (JS2, JS3) — they usually cascade and delete downstream
  runtime checks for free.
- Add a short comment only when a fix is non-obvious; cite the tenet, e.g.
  `(* JS2: variant makes the "shipped but unpaid" state unrepresentable *)` or
  `// JS3: return Result instead of throwing`.
- Do **not** narrate mechanical changes in comments.
- Don't invent behavior the original didn't have; if a fix changes semantics, call it out
  rather than smuggling it in.

### Step 5: Impact summary
Bullets grouped by tenet, explaining *why* each change makes the code safer or tighter —
not a mechanical changelog. Emphasize invariants now enforced by the compiler.

### Step 6: Verify (when tooling exists)
If the repo exposes safe checks, run the targeted ones after editing and report results
honestly. If none exist, say so — don't guess.

- OCaml: `dune build @check`, `ocamlformat --check` (janestreet profile), `dune runtest`
- TypeScript: `tsc --noEmit`, `eslint`
- Rust: `cargo clippy -- -D warnings`, `cargo test`
- Python: `ruff check`, `mypy`, `pytest`
- Go: `go vet`, `staticcheck`, `go test`

## Examples

### Make illegal states unrepresentable (TypeScript)
User: "make this more jane street"

**Input**
```ts
interface Order {
  status: string;           // "pending" | "shipped" | "cancelled" — but any string compiles
  trackingNumber?: string;  // only meaningful when shipped
  cancelReason?: string;    // only meaningful when cancelled
}
```

**Audit**
```markdown
| # | Tenet | Location | Issue | Class |
|---|-------|----------|-------|-------|
| JS2 | illegal states | Order | `status:string` + two optionals ⇒ "cancelled with a tracking number" compiles | CORRECTNESS |
| JS9 | naming | Order | stringly-typed status instead of a closed set | CLARITY |

Compliance: 10/12 clean · 1 correctness, 1 clarity
```

**Refactor**
```ts
// JS2: a discriminated union makes every impossible order state a type error
type Order =
  | { status: "pending" }
  | { status: "shipped"; trackingNumber: string }
  | { status: "cancelled"; cancelReason: string };
```

**Impact**
- JS2: "shipped without a tracking number" and "cancelled with tracking" are now
  compile errors, not runtime bugs to remember to guard against. The optional fields —
  and every `if (order.trackingNumber)` check downstream — disappear.

### Errors as values (Python)
User: "/jane on this loader"

**Input**
```python
def load_user(uid):
    row = db.get(uid)
    if row is None:
        raise UserNotFound(uid)   # expected, happens constantly
    return User(**row)
```

**Refactor**
```python
# JS3: "not found" is an expected outcome — return it, don't raise.
def load_user(uid: int) -> User | None:
    row = db.get(uid)
    return User(**row) if row is not None else None
```
- JS3: callers now handle the `None` case at the type level (`mypy` forces it); the
  exception path is reserved for genuine faults (a dropped DB connection), not routine
  control flow.

### Native OCaml
User: "apply jane street style"

**Input** `id.ml` (no `.mli`)
```ocaml
let make s = if String.length s = 0 then failwith "empty" else s
let to_string t = t
```

**Audit** → JS1 (no `.mli`; `string` alias leaks — every string is an `Id`), JS3
(`failwith` for validation), JS10 (no `[@@deriving]`). Load `references/ocaml.md` for the
full refactor to an abstract `t` with `Or_error.t`, `[@@deriving sexp, compare, equal]`,
and a written interface.

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Language ambiguous | Mixed/exotic repo | Apply `principles.md` per file; ask if truly unclear |
| "Terse vs. clear" tension (JS6) | Over-golfing | Clarity wins — JS6 forbids terseness that hides meaning |
| Refactor would change behavior | Latent bug in original | Surface it explicitly; don't silently "fix" via a style pass |
| No type system (plain JS, dynamic) | Host lacks static types | Enforce the principles you can (necessity, brevity, exhaustiveness, errors-as-values); recommend types/JSDoc where JS2 needs them |
| Already clean | Good code | State plainly "12/12 tenets clean" — don't manufacture nits |

## Core Principles

- **Correctness beats cleverness beats brevity — in that order.** JS6 never overrides JS2.
- **Move invariants into types.** The best refactor deletes a runtime check by making its
  failure impossible to express.
- **Every line earns its keep.** When unsure whether something should exist, it shouldn't.
- **Don't fake compliance.** If a smell is arguable, mark it POLISH and leave the call to
  the human rather than forcing a rewrite.
- **The style serves the code, not the other way around.** This is Jane Street's discipline
  ported to wherever the user actually works — not a demand that they adopt OCaml.
