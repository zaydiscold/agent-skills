# Jane Street House Style — Principles Ported to Any Language

Jane Street writes OCaml, but the *style* is a set of engineering values that outlive the
language. This file translates each tenet into the language in front of you. Where OCaml
reaches for a variant, TypeScript reaches for a discriminated union, Rust for an `enum`,
Python for a tagged `dataclass` union. The value is identical: **let the types carry the
invariants, keep the surface small, and write nothing that doesn't earn its place.**

Use this file for TypeScript, Rust, Python, Go, Haskell, F#, ReScript, Swift, Kotlin — any
language with a real or gradual type system. For dynamically-typed code with no types at
all, enforce what still applies (JS5, JS6, JS7, JS8, JS12) and recommend adding types where
JS2/JS3 need them.

Table of contents: [JS1](#js1) · [JS2](#js2) · [JS3](#js3) · [JS4](#js4) · [JS5](#js5) ·
[JS6](#js6) · [JS7](#js7) · [JS8](#js8) · [JS9](#js9) · [JS10](#js10) · [JS11](#js11) ·
[JS12](#js12)

---

## JS1 — Interface is the spec {#js1}

**Rule:** Design the public surface — the types and signatures — before and apart from the
implementation, and keep it as small as possible. A reader should understand *what* a
module offers without reading *how* it works.

**Why:** In OCaml the `.mli` file literally is the spec: it lists the exported types and
values, hides everything else, and holds the documentation. The discipline of writing it
first forces you to decide what's public. Every language has an equivalent public/private
boundary — use it deliberately instead of exporting whatever happens to be defined.

**Port:**
- **TypeScript:** export a narrow set of types + functions; keep helpers module-private (no
  `export`). Prefer `export type` interfaces as the contract. Consider an `index.ts` barrel
  that re-exports only the intended surface.
- **Rust:** default to private; `pub` only the real API. `pub(crate)` for internal sharing.
  The module's `pub` items are its `.mli`.
- **Python:** define `__all__`; prefix internals with `_`. A `Protocol` or the class's
  public methods are the contract.
- **Go:** capitalization *is* the interface — export (capitalize) only what callers need.

**Smell → fix:** a 400-line module exporting 30 names, half of them helpers → export the 4
names callers actually use; make the rest private.

---

## JS2 — Make illegal states unrepresentable {#js2}

**Rule:** Encode invariants in the type so the compiler rejects the impossible. Replace
boolean flags and stringly-typed status with a closed sum type. **Parse, don't validate:**
turn unstructured input into a precise type once, at the boundary, and pass the precise
type inward — don't re-check the same invariant everywhere.

**Why:** This is the heart of Jane Street style. A value that *can't* be constructed wrong
needs no defensive check and can't drift out of sync. Booleans and optional-field soups let
the impossible compile; a variant makes it a type error.

**Port:**
- **TypeScript:** discriminated unions with a literal `kind`/`status` tag; `never` in the
  exhaustive `default` to force coverage. Branded/opaque types (`type UserId = string &
  { readonly __brand: unique symbol }`) for validated primitives.
- **Rust:** `enum` with data-carrying variants; newtypes (`struct Email(String)`) with a
  smart constructor returning `Result`.
- **Python:** a union of frozen `@dataclass`es discriminated by a `Literal` field; `NewType`
  for validated primitives.
- **Go:** an interface with a closed set of implementing structs (Go's weakest area — lean
  on constructors + unexported fields to protect invariants).

**Before/after (TypeScript):**
```ts
// before — 3 impossible states compile
{ loading: boolean; data?: Data; error?: Error }
// after — exactly the 3 real states, nothing else
type State =
  | { kind: "loading" }
  | { kind: "loaded"; data: Data }
  | { kind: "failed"; error: Error };
```

**Class:** almost always **CORRECTNESS** — representable illegal states are latent bugs.

---

## JS3 — Errors are values {#js3}

**Rule:** Expected failures are *returned*, not thrown. Reserve exceptions/panics for
genuine bugs and truly unrecoverable faults. Name a function that raises on bad input with
an `_exn` (or host-idiomatic) suffix so the danger is visible at the call site.

**Why:** "Not found", "invalid input", "insufficient funds" are normal outcomes, not
exceptional ones. Returning them (`Result`, `option`, `Or_error`) puts them in the type, so
the caller *must* handle them and the compiler checks that they did. Exceptions hide the
failure path and let it silently propagate.

**Port:**
- **TypeScript:** return `T | null`/`T | undefined` for one failure mode, or a
  `{ ok: true; value } | { ok: false; error }` result union for richer errors. Never
  `throw` for expected control flow. A throwing helper → suffix `orThrow`.
- **Rust:** `Result<T, E>` / `Option<T>` — idiomatic already. `.unwrap()`/`expect()` only
  where a failure is a bug; that's the `_exn` boundary.
- **Python:** return `T | None`, or a small `Result`/`Either` type, or (pragmatically) a
  narrow custom exception that callers are *expected* to catch — but don't raise for the
  common case. Type the `None` in the signature so `mypy` enforces handling.
- **Go:** the `(T, error)` pair — already the norm; the rule is *check every error*, never
  `_ = err`.

**Smell:** `try/except` (or `try/catch`) wrapping ordinary control flow; a `catch {}` that
swallows; returning a sentinel like `-1` instead of an absence type.

**Class:** **CORRECTNESS** when an error can be swallowed or a failure path is invisible.

---

## JS4 — Immutability by default {#js4}

**Rule:** Prefer immutable data and pure transformations. Reach for mutation only when it's
local, contained, and justified (usually performance in a hot loop), never as the default
way to move data around.

**Why:** Immutable values can't be changed under you by aliasing; they're safe to share,
trivial to reason about, and free from a whole class of temporal bugs. Jane Street's
default data structures are persistent/immutable for exactly this reason.

**Port:**
- **TypeScript:** `readonly` fields, `ReadonlyArray`, `as const`; build new objects with
  spread instead of mutating; avoid `let` where `const` works.
- **Rust:** the default already — bindings immutable unless `mut`; keep `mut` scopes tiny.
- **Python:** frozen `@dataclass(frozen=True)`, tuples over lists for fixed data,
  `replace()` to derive updated copies.
- **Go:** pass and return values; keep mutation behind a method with a clear owner.

**Smell:** a function that mutates its argument as a side effect; shared mutable state
threaded through call sites; `let x = []; ... x.push()` where a `map`/comprehension is
clearer.

---

## JS5 — Necessity: every line earns its keep {#js5}

**Rule:** Delete anything that isn't pulling its weight — dead code, unused parameters,
commented-out blocks, speculative "might need it later" generality, and abstractions with a
single caller (inline them). YAGNI. The best diff is often a subtraction.

**Why:** Jane Street code is dense with *meaning*, not volume. Every extra construct is
something a future reader must load into their head and keep in sync. An abstraction earns
its keep at the second or third caller, not the first.

**Port (language-agnostic):**
- One-caller helper → inline it.
- Parameter never used → remove it.
- A wrapper that only forwards → delete the wrapper.
- A generic/interface with one implementer → collapse to the concrete type until a second
  appears.
- Config flags no path sets → remove.

**Smell:** `formatUserResultDataHelper()` called once; a `BaseFooFactory` with one `Foo`; a
function taking `opts` where `opts` is always `{}`.

**Class:** usually **CLARITY** (occasionally CORRECTNESS when dead code hides a live bug).

---

## JS6 — Brevity that clarifies {#js6}

**Rule:** Say it once and say it plainly. Cut ceremony, boilerplate, redundant intermediate
names, and five-line dances that do one line's work. **But brevity never overrides
clarity** — terseness that hides meaning is a *worse* violation than verbosity. When the two
conflict, clarity wins.

**Why:** Concision is a Jane Street signature, but it's concision in service of *reading
speed*, not code golf. The goal is the shortest form a competent reader grasps instantly —
not the shortest form that compiles.

**Port:**
- Collapse `if (x) return true; else return false;` → `return x`.
- Replace an accumulator loop with `map`/`filter`/`reduce`/comprehension *when it reads
  more clearly*.
- Drop names that restate the type: `const userObject: User` → `const user: User`.
- Early-return to kill nesting.
- **Guardrail:** do NOT introduce dense point-free chains, nested ternaries, or clever
  one-liners that a reader has to decode — that trips JS7.

**Smell in both directions:** a 12-line function that should be 3; *and* a cryptic
`a=>b=>c=>...` chain that should be a named, readable function.

---

## JS7 — Explicit over clever {#js7}

**Rule:** Make control flow, data flow, and effects visible. No magic, no hidden mutation,
no wildcard imports, no implicit coercions, no clever indirection that saves keystrokes at
the cost of comprehension.

**Why:** Jane Street prizes code you can read top-to-bottom and trust. Cleverness is a debt
paid by every future reader. Explicit imports and explicit effects mean you always know
where a name or a side effect comes from.

**Port:**
- **Imports:** no `import *` / wildcard `open` / `from x import *`. Name what you use so
  every identifier is traceable.
- **Effects:** don't bury I/O, network, or mutation inside something that looks pure. Keep
  side effects at visible seams.
- **Coercion:** avoid implicit truthiness games and type juggling; compare explicitly.
- **Indirection:** no reflection/metaprogramming/dynamic dispatch where a direct call is
  clear.

**Smell:** `import * as _ from "./everything"`; a "getter" that also writes to a cache and
fires analytics; `if (list)` meaning "non-empty".

---

## JS8 — Total functions & exhaustive matching {#js8}

**Rule:** Handle every case explicitly. A match/switch over a closed set must cover all
variants with no catch-all that silently swallows cases added later. Prefer matching over a
sum type to chains of `if`/boolean-accessor checks.

**Why:** Exhaustiveness is a free correctness net: add a variant, and the compiler lists
every site that must now handle it. A wildcard `default` throws that net away — new cases
fall through unnoticed.

**Port:**
- **TypeScript:** `switch` on the discriminant with a `const _exhaustive: never = x` in
  `default` so a new variant fails to compile. Enable `noImplicitReturns`.
- **Rust:** `match` without a `_ =>` arm over your own enums (compiler enforces
  exhaustiveness); reserve `_` for genuinely open sets.
- **Python:** `match` with explicit cases; assert-never helper in the fallback; or
  `typing.assert_never`.
- **Go:** since Go can't enforce it, list every case and `panic("unreachable: %v")` in the
  default so a gap is loud, not silent.

**Before/after (TypeScript):**
```ts
// before — a new Shape variant slips through silently
if (s.kind === "circle") return area1(s);
return area2(s); // "everything else"
// after — adding a variant breaks the build here
switch (s.kind) {
  case "circle": return circleArea(s);
  case "square": return squareArea(s);
  default: { const _: never = s; return _; }
}
```

**Class:** **CORRECTNESS** — a swallowing default is a latent bug on the next variant.

---

## JS9 — Consistent, intent-revealing names {#js9}

**Rule:** Follow the house naming conventions and let names reveal intent.
- The **principal type of a module is `t`** (OCaml). Ported: the main type takes the
  module's name once (`user.User`, `order.Order`), not `UserClass`/`UserType`/`IUser`.
- **Suffix conventions:** `_exn`/`orThrow` for raising variants, `_opt`/`?`/`Maybe` for
  optional-returning ones.
- Host casing: snake_case values + Capitalized types in OCaml; camelCase/PascalCase in
  TS/Java; snake_case in Python/Rust values, PascalCase types.
- **No Hungarian notation, no noise words** (`data`, `info`, `manager`, `object` that add
  nothing), no restating the type in the name.

**Why:** Uniform naming lets a reader predict a name before they see it and trust what a
suffix promises (`_exn` *will* raise; a plain name won't).

**Smell:** `IUserManager`, `getUserDataObject()`, `strName`, `list_of_users` (say `users`).

---

## JS10 — Derive mechanical code {#js10}

**Rule:** Never hand-write equality, comparison, hashing, or serialization. Generate it from
the type so it can't drift when a field is added.

**Why:** In OCaml, `[@@deriving sexp, compare, equal, hash]` generates all of it from one
line; add a field and every derived function updates automatically. Hand-rolled versions
silently forget the new field. Prefer the generated, always-correct version everywhere.

**Port:**
- **TypeScript:** derive validators/serializers from a single schema (Zod, `io-ts`,
  TypeBox) rather than hand-writing `toJSON`/`isFoo`; generate types from OpenAPI/GraphQL
  rather than duplicating them.
- **Rust:** `#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]` — exactly
  the OCaml pattern.
- **Python:** `@dataclass`/`attrs` generate `__eq__`/`__hash__`/`__repr__`; `pydantic` for
  (de)serialization from the type.
- **Go:** struct tags + generated (de)serialization; `go generate` for the mechanical parts.

**Smell:** a hand-written `equals()` that compares 6 of 7 fields; a `toJSON` that forgot the
field someone added last month.

---

## JS11 — Strict everywhere, zero warnings {#js11}

**Rule:** Turn every static check up to its strictest setting and treat warnings as errors,
from day one. A clean build at maximum strictness is the baseline, not an aspiration.

**Why:** Jane Street runs `ppx_js_style`, the `ocamlformat` `janestreet` profile, and an
aggressive warning set as errors. The strict setting catches the bug class before review
does; tolerating warnings trains everyone to ignore the one that matters.

**Port:**
- **TypeScript:** `"strict": true` (plus `noUncheckedIndexedAccess`, `noImplicitReturns`,
  `exactOptionalPropertyTypes`); ESLint with `@typescript-eslint` strict configs; no
  `any`, no `@ts-ignore` without a cited reason.
- **Rust:** `#![deny(warnings)]` / `cargo clippy -- -D warnings`.
- **Python:** `mypy --strict`, `ruff` with a broad rule set, no bare `# type: ignore`.
- **Go:** `go vet` + `staticcheck` clean; `golangci-lint` in CI.

**Smell:** `tsconfig` without `strict`; `any` sprinkled to silence errors; suppressed lints
with no justification.

---

## JS12 — Colocated tests, interface docs {#js12}

**Rule:** Keep tests next to the code they exercise, expressed as small, readable examples.
Put documentation on the *public surface* explaining *what* and *why*; do not write comments
that narrate *how* the code works line-by-line — the code says how.

**Why:** Jane Street uses inline `ppx_expect` tests (`let%expect_test`) that live in the
source and show expected output literally, and doc comments that live in the `.mli`
(interface), not the implementation. Tests beside code get read and maintained; interface
docs explain intent without going stale against the body.

**Port:**
- **Tests:** colocated `*.test.ts` / Rust `#[cfg(test)] mod tests` / `pytest` files beside
  the module / Go `_test.go`. Prefer example/table-driven tests with literal expected
  values (snapshot/expect-style where it fits).
- **Docs:** doc comment the exported functions/types (`/** */` TSDoc, `///` Rust,
  docstrings on public defs, Go doc comments) — say what it does, its contract, and any
  gotcha. Delete comments that merely restate the next line.

**Smell:** a `// increment i` comment; a 200-line module with zero doc on its public API and
its tests in a distant `__tests__` tree three folders away.

---

## Applying the audit

Walk JS1→JS12 in order — correctness tenets (JS2, JS3, JS8) first, because their fixes often
delete the code that later tenets would have flagged. A representable illegal state fixed at
JS2 removes the runtime check JS5 would have called dead, the exception JS3 would have
flagged, and the non-exhaustive branch JS8 would have caught. Fix the types, and the rest of
the diff shrinks on its own.
