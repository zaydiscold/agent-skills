---
name: critique
description: >-
  Run a rigorous multi-perspective critique of any artifact in any scope — code,
  an architecture, a system, a design or UI, writing, a logical argument, a plan,
  a strategy, a product, a business pitch. Spawns several independent critic
  agents, each with a distinct point of view (e.g. a correctness "code-autist", a
  security auditor, a PM/delivery lens, an adversarial red-teamer, a design
  critic, a logician, an editor, a pre-mortem), has each write a structured
  report, then compares and contrasts their notes into one verdict covering code,
  design, organization, logic, and what to ADD / REMOVE / CHANGE / KEEP. Use this
  whenever the user asks to "critique this", "review this from multiple angles",
  "tear this apart", "poke holes in this", "what should I cut/change/add", "is my
  logic/argument sound", wants a design review, a hard code review, an adversarial
  review, a second (and third and fourth) opinion, an honest read, or asks what's
  good and bad about something they made — even if they don't say "critique".
  Prefer this over a single inline review whenever the artifact is substantial or
  the user wants depth, honesty, or many independent eyes.
---

# Critique — many eyes, one verdict

A single reviewer has a single blind spot. The power of this skill is **independence**:
several critics who never see each other's notes, each chasing what *their* point of view
is built to catch, then a synthesis that treats agreement and disagreement as two different
kinds of signal.

> **The core insight that makes this worth doing:** when independent perspectives
> **converge** on the same note, that isn't taste — it's fact, and the user should act on it.
> When they **diverge**, that's a genuine taste fork, and the user should *decide* it, not be
> told. A good critique report makes that distinction loud. Everything below serves it.

## The shape of a run

1. **Scope** the artifact and pick the critics.
2. **Fan out** — spawn the critics in parallel, each blind to the others, each grounded in the
   real artifact, each returning a structured report.
3. **Synthesize** — one lead compares and contrasts: consensus first, then the real tensions.
4. **Deliver** the report (template below). Bias the whole thing toward *subtraction*.

## Step 1 — Scope and choose the critics

First, get the **real artifact in front of you** — the actual code, the rendered design (a
screenshot or transcript, not a description), the actual prose. Critics grounded in the thing
catch real problems; critics fed a summary write horoscopes. If you can capture it (read the
files, screenshot the UI, dump the transcript), do that before anything else.

Then pick **4–6 critics whose values genuinely differ** — that difference is the entire point.
Two critics who'd write the same note are one wasted slot. Match the lenses to the artifact; the
libraries below are starting points, not a menu to copy whole. Add a custom lens when the artifact
has a specific axis that matters (accessibility, cost, latency, legal, on-brand-voice, etc.).

The full **mode catalog lives in `references/lenses.md`** — dozens of modes across every scope:
code (the "autist" correctness purist, security, performance, architecture, testing, SRE,
concurrency, supply-chain, cost/ops…), logic & argument (logician, skeptic, steelman, bayesian,
first-principles, causal, decision-theory), design/UX (first-visitor, editor, typographer,
motion, brand-purist, a11y, IA), writing, product & strategy (the-user, PM/delivery,
unit-economics, competitor, growth, legal/risk), adversarial/red-team (attacker, chaos,
shark-tank, pre-mortem), and process/longevity (maintainer-burden, team-fit, nth-use, ethics).
It also lists **common starting sets** per artifact type.

Read it, pick a tailored 4–6, and **invent any mode it's missing** — a game's *feel*, a contract's
*enforceability*, whatever axis this specific artifact lives or dies on. The catalog is a
launchpad, not a fence: **literally any scope is fair game.**

If the artifact spans domains (a feature = code + design + copy; a pitch = logic + business +
writing), **mix lenses across them** — that cross-domain disagreement is often the most useful.
Always include at least one **adversarial** lens and one **subtraction-first** lens (editor /
contrarian / pre-mortem); those two postures find the most across almost anything.

## Step 2 — Fan out the critics

Run the critics **in parallel and blind to each other** — shared notes cause groupthink, and
groupthink is the failure mode this skill exists to beat.

**Preferred: the Workflow tool**, if it's available in this session (it gives clean parallel
fan-out + a synthesis stage). Pattern — see `references/workflow-template.js` for a ready script:

```
phase('Critique')
const reports = await parallel(LENSES.map(l => () =>
  agent(brief(l, ARTIFACT), { label: 'critic:'+l.key, schema: CRITIQUE_SCHEMA, effort: 'high' })))
phase('Synthesize')
const verdict = await agent(synthBrief(reports), { effort: 'high' })
```

**Fallback: parallel subagents** via the Agent/Task tool — dispatch all critics in one message
so they run concurrently, collect their reports, then do the synthesis yourself or in one more agent.

**Every critic's brief must contain:**
- Its lens, in second person and committed ("YOU ARE a ruthless editor who believes this is 30%
  too long" beats "consider editing"). A critic with an attitude finds more than a neutral one.
- The **full artifact** (or the concrete pointer to read it) — never a paraphrase.
- The artifact's **intent and constraints** — what it's *for*, who it's for, the house rules,
  the stage it's at. A critic that doesn't know the goal critiques the wrong thing.
- The mandate: **bias toward what to remove and change, not add.** Most artifacts suffer from
  too much, not too little; "add a feature" is the lazy note. Cutting is harder and worth more.
- The structured return (`references/critique-schema.json`): `keep`, `remove`, `change`, `add`,
  `biggestFlaw`, `biggestOpportunity`, and an honest `read` of what the thing actually is.

Cite specifics. "The middle drags" is useless; "cut lines 44, 46, 52 — same joke three times" is
actionable. Tell critics to quote the artifact.

## Step 3 — Synthesize (compare and contrast)

This is where the value is made. One lead reads all the reports and produces the verdict. The
lead's job is not to average — it's to find the structure:

- **Consensus = fact.** What 3+ critics independently flagged is not a matter of opinion. Lead with
  it. State how many critics named each consensus point — that count is the evidence.
- **Disagreement = the user's decision.** Where critics genuinely conflict (the purist wants it
  bare, the visitor wants a subtitle), do *not* resolve it silently. Name the fork, give each side's
  best argument in one line, recommend — and hand it to the user.
- **Keep is as important as cut.** Name the few things that are genuinely good and must not be
  touched, so the user doesn't "fix" their best parts while acting on the criticism.
- **Find the single move.** If the user did exactly one thing, what gives the most? It is very often
  a subtraction. Say so plainly.

## The report — output structure

Deliver in this order. Skip a section only if it's truly empty for this artifact; keep the headers
the user expects.

```
# critique — <artifact>

## the read           — one honest paragraph: what this IS, watched/read cold; its single
                        greatest strength and single greatest weakness. (consensus-driven.)

## what's bad         — the core problems, ranked. note how many critics hit each (the count is the evidence).

## remove             — specific cuts, ranked, consensus first. cite the actual lines/elements + a one-line why.

## change             — alterations (copy, color, weight, order, timing, naming, structure), ranked. not additions.

## reorder / organization — flow, sequence, grouping, file/module structure. where the shape is wrong.

## add                — only where it's GENUINELY thin (a real gap, not "more features"). bias hard against this.

## keep               — the few things that are beautiful/correct and must not be touched.

## the forks          — where the critics disagreed. each: the tension in one line, each side's best
                        argument, your recommendation. the user decides these.

## the single move    — the one change (often a deletion) that does the most.
```

When the artifact is code, fold **correctness / security / performance** findings into
`what's bad` / `change` with severity; when it's design or writing, those sections carry the
aesthetic notes. The headers stay; the content adapts to the artifact.

## Parameters the user can set

Honor these when the user gives them; otherwise choose sensible defaults.
- **target** — what to critique (a path, a URL, a selection, "the boot sequence", a screenshot).
- **lenses / depth** — how many critics and which (e.g., "5 perspectives", "include an a11y lens",
  "code only"). Default 4–6, matched to the artifact.
- **dimensions / focus** — narrow the report (e.g., "just the copy", "perf and security", "design only").
- **stance** — how brutal. Default: honest and subtraction-biased; the user can ask for gentler.

## Principles (the why)

- **Independence beats expertise.** Five blind, opinionated critics out-find one careful one — they
  fail in different directions, so together they cover the space.
- **Convergence is data; divergence is a decision.** This is the whole engine. Protect it.
- **Subtraction is the default verdict.** The hardest, most valuable note is almost always "cut",
  not "add". Reward the critic who kills a darling.
- **Ground or it's a horoscope.** No critic earns its keep critiquing a summary. Show it the real thing.
- **Hand back taste, don't impose it.** The synthesis recommends; the user rules. Their artifact,
  their call — especially on the forks.

See `references/critique-schema.json` (the per-critic return shape) and
`references/workflow-template.js` (a drop-in Workflow script) to run a critique fast.
