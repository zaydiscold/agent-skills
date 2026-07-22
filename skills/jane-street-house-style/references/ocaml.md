# Jane Street House Style — OCaml (the literal rules, cited)

This is the authentic house style, for `.ml`/`.mli` code. Unlike the ported principles, much
of this is **machine-enforced**: a Jane Street build actually rejects violations via
`ppx_js_style` and the `ocamlformat` `janestreet` profile. Enforce §0 first — it isn't
opinion, it's what the toolchain fails on. The rest maps the twelve tenets (JS1–JS12) onto
OCaml mechanics, each with a primary-source citation.

Table of contents: [§0 Mechanical](#s0) · [JS1](#js1) · [JS2](#js2) · [JS3](#js3) ·
[JS4](#js4) · [JS5/JS6/JS7](#js567) · [JS8](#js8) · [JS9](#js9) · [JS10](#js10) ·
[JS11](#js11) · [JS12](#js12) · [Effective ML maxims](#maxims) · [Sources](#sources)

---

## §0 — Mechanical enforcement (what the build actually rejects) {#s0}

### 0.1 `ppx_js_style` — the compile-time style linter
An identity ppx rewriter run via `ppx_jane` that "enforces Jane Street coding styles." Each
row is a real check with its emitted error; flag these as **CORRECTNESS/CLARITY** violations
because a JS build won't compile past them.

| Check | Condition | Default |
|-------|-----------|---------|
| **Annotated ignores** | `ignore` / `let _ = e` must carry a type: `ignore (e : t)` or `let (_ : t) = e`. Aliases (`let _ = Foo.bar`) exempt. | on |
| **Doc-comment discipline** | In `.mli`, every comment is a doc comment `(** … *)` or an ignored `(*_ … *)`; plain `(* … *)` is an error. Enables warning 50 (placement) + validates odoc syntax. | via `-check-doc-comments` |
| **No doc comment on `open`** | A doc comment on an `open` is dropped by odoc → flagged. | on |
| **`[@cold]` not `[@inline never]`** | Mark cold functions `[@cold]`. | via `-forbid-inline-never` |
| **No let-operators; use ppx_let** | Custom binding ops (`let*`, `let+`) are forbidden internally — use `let%bind`/`let%map` for one consistent style. | forbidden internally |
| **Dated deprecation** | `[@@deprecated]` payload must start `"[since YYYY-MM] …"`. | on internally |
| **Underscore grouping** | Literal underscores on multiples of 3 (decimal) / 2 (hex/oct/bin); `1_000_000` ok, `10_00` flagged. `__` disables per-literal. | on |
| **ocamlformat disable only at top level** | `[@@@ocamlformat "disable"]` allowed only at toplevel. | on |
| **No bare top-level expressions** | Outside `.mlt`/MDX. | on |

Source: https://github.com/janestreet/ppx_js_style (README + `src/ppx_js_style.ml`).

### 0.2 `ocamlformat --profile=janestreet` — the formatting contract
Require an `.ocamlformat` with `profile = janestreet` + a pinned `version`. **Never hand-align
or hand-wrap code** — the formatter owns whitespace; manual alignment fights it and is a
violation. Load-bearing settings (from `ocamlformat`'s `lib/Conf.ml`):

- **90-column margin** (`margin = 90`), `lf` line endings.
- Spaces inside delimiters: `[ 1; 2 ]`, `{ x = 1 }`, `[| … |]`.
- `if`/`then`/`else` keyword-first on breaks; `match` cases `fit_or_vertical`, indent 2.
- Leading separators on wrap (`;`/`,`/`|` at line start).
- Doc comments *before* the item, unwrapped (`doc_comments = before`, `wrap_comments = false`).
- `ocp_indent_compat = true`, `max_indent = None`, `parens_tuple = multi_line_only`.

Source: https://github.com/ocaml-ppx/ocamlformat · https://ocaml.org/p/ocamlformat/latest/doc/index.html

---

## JS1 — Interface is the spec: the `.mli` {#js1}

- **Every module gets an `.mli`.** It enables information hiding and decouples clients from
  the implementation. RWO: "A module defined by `filename.ml` can be constrained by a
  signature placed in `filename.mli`." → https://dev.realworldocaml.org/files-modules-and-programs.html
- **The `.mli` is the spec and the home for documentation** — type signatures are
  "guaranteed-to-be-correct documentation" that can't rot like prose. Same source; also
  https://queue.acm.org/detail.cfm?id=2038036
- **Make types abstract in the signature** — expose `type t`, hide the definition, to "enforce
  invariants." → files-modules-and-programs.
- **Signatures first** — write the interface, implement second: "I want to write the interface
  first … This lets me use the module as a black box." → https://blog.janestreet.com/simple-top-down-development-in-ocaml/

```ocaml
(* username.mli — the whole contract *)
type t                          (* abstract: every t is validated *)
val of_string : string -> t Or_error.t
val to_string : t -> string
```

---

## JS2 — Make illegal states unrepresentable {#js2}

Minsky's most-cited maxim (2010 "Effective ML"): "Now that the invariants are part of the
types, the compiler can detect and reject code that would violate these invariants. This is
both less work and more reliable than maintaining such invariants by hand."
→ https://queue.acm.org/detail.cfm?id=2038036 · https://blog.janestreet.com/effective-ml-revisited/

- **Variants over booleans / flag-soup** ("boolean blindness"): a `bool` carries no call-site
  meaning and permits nonsense combos; a named sum type doesn't.
- **Combine variants (differences) with records (shared structure)** to raise type precision.
  → https://dev.realworldocaml.org/variants.html
- **Validate at the boundary, return an abstract `t`** (parse-don't-validate flavor): a smart
  constructor `of_string : string -> t Or_error.t` + abstract `t` lets downstream assume valid.
- **But avoid complex type hackery** (Effective ML #8): reach for phantom/GADT tricks only when
  the invariant genuinely warrants it — "the enemy of good code is complexity," not dynamism.

```ocaml
(* BEFORE — "connected but no session_id" is representable *)
type conn = { is_connected : bool; session_id : string option; last_ping : Time.t option }

(* AFTER — each state carries exactly its data; impossible combos won't compile *)
type conn =
  | Disconnected
  | Connecting
  | Connected of { session_id : string; last_ping : Time.t }
```

---

## JS3 — Errors are values {#js3}

RWO "Error Handling": foreseeable failures belong in the type; "use exceptions for exceptional
conditions." → https://dev.realworldocaml.org/error-handling.html

- **`option`** for a single obvious failure with nothing to report; **`Result.t`/`Or_error.t`**
  when the error must explain itself (`Or_error` standardizes on Base's sexp-based `Error.t`).
- **`_exn` suffix = "this raises"**, with a non-raising default beside it: `List.find` returns
  `option`, `List.find_exn` raises. "We named the function `find_exn` to warn the user … a
  convention used heavily in Base." → error-handling · https://blog.janestreet.com/core-principles-uniformity-of-interface/
- **Convert raising code at the boundary** with `Or_error.try_with`.
- **Sequence with `let%bind`/`let%map`**, not hand-rolled matches — `bind` short-circuits on
  the first `Error`. → https://github.com/janestreet/ppx_let
- **Structured error payloads with `[%message]`/`raise_s`**, never string concatenation:
  `raise_s [%message "bad size" ~got:(n : int) ~max:(cap : int)]`. → https://github.com/janestreet/ppx_sexp_message

---

## JS4 — Immutability by default {#js4}

"OCaml … mak[es] immutable data structures the default. A well-written OCaml system almost
always has mutable state, but that state is carefully limited."
→ https://queue.acm.org/detail.cfm?id=2038036

- **Functional record update** `{ r with field = v }` instead of mutation. → https://dev.realworldocaml.org/records.html
- **Don't be puritanical about purity** (Effective ML #9): `ref`/`mutable` are fine when
  justified and contained. The rule is immutable *defaults*, not immutable absolutism.

---

## JS5 / JS6 / JS7 — Necessity, brevity, explicitness {#js567}

- **Favor readers over writers** (Effective ML #1): "Whenever there's a difference in opinion
  between these two groups, the readers are always right." → https://gist.github.com/jonschoning/8394412
- **Avoid boilerplate** (Effective ML #7) — hand-written mechanical code is dead weight; derive
  it (see JS10).
- **Concision within limits** — "shorter code is easier to read … but no good is done by
  reducing all your function names to single characters." → ACM Queue.
- **Open few modules** (Effective ML #5): `open` "is a trade-off between terseness and
  explicitness" — it helps the writer, hurts every reader. Prefer a **local** open
  `Module.(…)` / `let open … in` or a local alias `let module C = Counter in …` over a
  file-scope open. Legitimate file-scope opens: `Base`/`Core`, `Option.Monad_infix`, `Float.O`.
  → https://dev.realworldocaml.org/files-modules-and-programs.html

---

## JS8 — Total functions & exhaustive matching {#js8}

- **Pattern-match over `if`/`else` chains and boolean accessors** — the compiler builds jump
  tables and checks exhaustiveness; decomposing by match is "many times faster" than repeated
  `hd_exn`/`tl_exn`. → https://dev.realworldocaml.org/lists-and-patterns.html
- **Write exhaustive matches; avoid catch-all `_`** — "beware of catch-all cases: they suppress
  exhaustiveness checking," so adding a constructor won't flag the sites that must change. Use
  the missing-case warning as a refactoring tool (Effective ML #4). → https://dev.realworldocaml.org/variants.html
- **Mark recursion `rec` explicitly; prefer inline records in constructors** —
  `Move of { dx : int; dy : int }` is "more concise and more efficient than … free-standing
  record types."

---

## JS9 — Naming {#js9}

- **The module's principal type is `t`; refer to it `M.t`.** "It is standard practice to name
  the type associated with the module `t`." Bonus: derived functions get clean names
  (`compare`, `hash`, `sexp_of_t`) only when the type is `t`. → https://dev.realworldocaml.org/records.html
- **`snake_case` values/fields; `Capitalized_snake_case` modules and constructors.**
- **`_exn` = raises; make common errors obvious in the name** (`hd` vs `hd_exn`) — Effective ML
  #6. → https://blog.janestreet.com/core-principles-uniformity-of-interface/
- No Hungarian, no type-encoding prefixes — the types carry that.

**Argument style** (RWO variables-and-functions): **label args when several share a type, and
always label boolean flags** (`create ~width ~height`, `sort ~reverse:true`); use **optional
args sparingly and only in public interfaces**; **never leave an optional arg last** (it can't
be erased). Default to currying for clean partial application.

---

## JS10 — Derive mechanical code {#js10}

Put `[@@deriving …]` on type declarations; **never hand-write** equality/compare/hash/sexp.
Depend on the umbrella `ppx_jane`. → https://github.com/janestreet/ppx_jane

```ocaml
type t =
  { host : string
  ; port : int
  }
[@@deriving sexp, compare, equal, hash, fields]
```

- **`compare`/`equal`** — derived versions are "usually much faster than `Pervasives.compare`"
  and only compare comparable values (never polymorphic `=`/`compare` on structured types).
  → https://github.com/janestreet/ppx_compare
- **`sexp`** on nearly every type — the universal currency for serialization, printing, test
  output, error messages. → https://github.com/janestreet/ppx_sexp_conv
- **`fields`/`variants`** for exhaustive iteration — add a field/constructor and every derived
  iterator breaks at compile time. → ppx_fields_conv · ppx_variants_conv
- **`hash`, `enumerate`, `bin_io`** where applicable.

---

## JS11 — Strict everywhere, zero warnings {#js11}

- **Warnings are fatal** — dune's dev profile turns warnings-as-errors on, and dune's scheme
  "is inspired from the one used inside Jane Street." Release builds relax it.
  → https://dune.readthedocs.io/en/stable/faq.html
- **Don't silence warnings locally** with `[@@@warning "-…"]` casually — fatal exhaustiveness/
  unused checks are the safety net and refactoring tool (JS8). Suppressions must be rare and
  justified.
- Plus `ppx_js_style` (§0.1) and `ocamlformat --check` (§0.2) in CI.

> The exact numeric `-w` set isn't quoted in a single JS page; enforce "warnings fatal in dev"
> and read the project's own `dune` flags rather than assuming a list.

---

## JS12 — Colocated tests, interface docs {#js12}

- **Inline tests in the `.ml`** with `let%test`/`let%test_unit`. → https://github.com/janestreet/ppx_inline_test
- **Prefer `let%expect_test`** and commit the captured `[%expect {| … |}]`; a failure emits a
  `.corrected` file to diff/accept. → https://github.com/janestreet/ppx_expect

```ocaml
let%expect_test "adds" =
  printf "%d" (2 + 2);
  [%expect {| 4 |}]
```

- **Docs go in `.mli` doc comments `(** … *)`**; internal notes use `(*_ … *)`; plain `(* *)`
  in an `.mli` is a lint error (§0.1). Don't narrate obvious code — types are the documentation.

**Build CLIs with `Command`**, not raw `Sys.argv` — declare flags/anons once with
`Command.Param`/`Command.basic`, subcommands with `Command.group`. → https://dev.realworldocaml.org/command-line-parsing.html

---

## The nine "Effective ML" maxims (the culture, verbatim) {#maxims}

1. Favor readers over writers. 2. Create uniform interfaces. 3. Make illegal states
unrepresentable. 4. Code for exhaustiveness. 5. Open few modules. 6. Make common errors obvious.
7. Avoid boilerplate. 8. Avoid complex type hackery. 9. Don't be puritanical about purity.
→ https://gist.github.com/jonschoning/8394412 · https://blog.janestreet.com/effective-ml-revisited/

**Modules & functors, briefly:** build uniform interfaces via standard signature bundles
(`Comparable.S`, `Hashable.S`, `Stringable.S`, module type `S`); use functors for abstraction
but not in small programs (constrain the *output* module); factor shared signatures into a
`foo_intf.ml` `include`d by both `foo.ml` and `foo.mli`; prefer destructive substitution
(`with type t := …`) when combining signatures; reserve first-class modules for genuine
runtime-dispatch/plugin designs. → https://blog.janestreet.com/core-principles-uniformity-of-interface/ ·
https://dev.realworldocaml.org/functors.html · https://dev.realworldocaml.org/first-class-modules.html

---

## Where sources are soft or disagree

- **Immutability**: "immutable by default" vs "don't be puritanical" → immutable *defaults*,
  contained mutation ok.
- **Illegal states** vs **avoid type hackery** → encode invariants, stop before the gymnastics
  cost more than they buy.
- **Argument order**: RWO "function arg first" vs uniformity "`t` in the conventional slot" →
  labeled `~f`/config args make position moot; `t` stays conventional.
- **Base vs Core**: internally Core is default; externally many use Base alone. "Open a JS
  stdlib," not necessarily Core.
- **Hard/mechanical** (build fails): everything in §0 + warnings-fatal in dev. **Soft** (culture,
  not linted): open discipline, `_exn` pairing, readers-over-writers, CLI-via-`Command`,
  signatures-first.

---

## Sources {#sources}

- `ppx_js_style` (linter — source of truth): https://github.com/janestreet/ppx_js_style
- `ocamlformat` janestreet profile: https://github.com/ocaml-ppx/ocamlformat · https://ocaml.org/p/ocamlformat/latest/doc/index.html
- Base/Core: https://github.com/janestreet/base · https://ocaml.org/p/base
- ppx family (all under https://github.com/janestreet/): ppx_jane, ppx_sexp_conv, ppx_compare,
  ppx_hash, ppx_fields_conv, ppx_variants_conv, ppx_enumerate, ppx_bin_prot, ppx_let,
  ppx_sexp_message, ppx_inline_test, ppx_expect
- Real World OCaml, 2nd ed.: https://dev.realworldocaml.org/
- Jane Street Tech Blog: https://blog.janestreet.com/core-principles-uniformity-of-interface/ ·
  https://blog.janestreet.com/simple-top-down-development-in-ocaml/ · https://blog.janestreet.com/effective-ml-revisited/
- Yaron Minsky, "OCaml for the Masses," ACM Queue: https://queue.acm.org/detail.cfm?id=2038036
- "Effective ML" talk notes (community transcription): https://gist.github.com/jonschoning/8394412
- dune warnings-as-errors: https://dune.readthedocs.io/en/stable/faq.html
