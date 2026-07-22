# Critique mode catalog — all the scopes

This is a launchpad, not a fence. **Pick 4–6 modes whose values genuinely differ** for a given
run — difference beats coverage, and ten near-identical critics just make noise. **Mix across
domains** when the artifact spans them (a feature = code + design + copy; a pitch = logic +
business + writing). And **invent modes freely** — if the artifact has an axis no mode below
names (a game's *feel*, a contract's *enforceability*, a recipe's *technique*), spin up that lens.
The catalog exists so you never start from a blank page, not so you stay inside it.

Each line is `mode — what it hunts for`. The em-dash clause is enough to brief a critic; expand
it in second person with an attitude when you spawn it ("YOU ARE a security auditor who assumes
every input is hostile…").

## Code & engineering
- **code-correctness ("the autist")** — every edge case, type, invariant, off-by-one, null/overflow, the spec read to the letter.
- **security** — injection, authz/authn, secrets, untrusted input, the whole OWASP surface, what an attacker reaches.
- **performance** — Big-O, N+1 queries, allocations, the hot path, what melts at 100×.
- **maintainability** — naming, structure, cyclomatic load, dead code, the future maintainer's curse.
- **architecture** — module boundaries, coupling, the right abstraction for the problem, what will rot, premature generality.
- **api-ergonomics** — the surface others depend on; easy to use right, hard to use wrong; the contract.
- **testing** — coverage gaps, flakiness, what's untested, the missing failure test, tests that assert nothing.
- **reliability / SRE** — failure modes, retries, idempotency, timeouts, blast radius, observability, what pages someone at 3am.
- **concurrency** — races, deadlocks, ordering assumptions, shared mutable state.
- **dependency / supply-chain** — bloat, abandoned or risky deps, license, provenance, pinning.
- **data-modeling** — schema, normalization, migrations, integrity, the query you'll regret.
- **cost / ops** — cloud spend, operational toil, the thing that quietly 10×'s the bill.
- **accessibility (code)** — semantics, ARIA, keyboard paths, focus order, contrast.
- **portability** — platforms, runtimes, "works on my machine", hidden environment assumptions.

## Logic, reasoning & argument
- **logician** — validity, formal/informal fallacies, non-sequiturs, hidden premises, equivocation.
- **skeptic** — claims vs evidence; what's asserted but never shown; the load-bearing "obviously".
- **steelman** — the strongest version of the opposing view; is it actually engaged or strawmanned.
- **bayesian** — priors, base rates, what evidence would actually move the conclusion; overconfidence.
- **first-principles** — strip every assumption; does it still stand when rebuilt from scratch.
- **causal** — correlation-vs-causation, confounders, reversed arrows, selection effects.
- **decision-theory** — the choice under uncertainty; expected value, the ignored downside, optionality.

## Design, UX & visual
- **first-visitor** — a human, cold, never seen it: what do I *feel* second by second; where attention goes; where I drag; where I feel *seen* vs *sold to*.
- **editor** — the cut list; density, redundancy, three jokes where one would land harder.
- **typographer / visual** — color, weight, hierarchy, rhythm, restraint; crafted vs amateur; wasted accents.
- **motion** — timing, cadence, choreography, dynamic range; is there a climax or one flat tempo.
- **brand / ethos purist** — does it honor the design language and intended feeling, or betray it; what's off-voice.
- **accessibility / inclusive** — contrast, motion-sensitivity, screen-reader path, cognitive load, the excluded user.
- **information-architecture** — findability, grouping, labels, the mental model vs the actual model.
- **conversion / funnel** — friction, the drop-off point, competing CTAs, the one action.
- **interaction** — affordances, feedback, states (empty/loading/error), recovery from mistakes.

## Writing, docs & content
- **reader** — clarity; where I get lost, where I reread, whether I trust the voice.
- **editor** — tighten, cut filler, kill the throat-clearing and the hedges.
- **skeptic** — claims, evidence, logic gaps, the unsupported leap.
- **stylist** — voice, cadence, word choice, the music; clichés and tics.
- **structure** — does the argument build; is this the strongest possible order; the buried lede.
- **pedagogue** — does a newcomer actually learn this; what's silently assumed.
- **SEO / discoverability** — how it's found; the terms, the headings, the structure.
- **localization** — what breaks in translation; idioms, units, cultural assumptions.

## Product, strategy & business
- **the-user** — the job to be done, the friction, the moment of value, the "why would I".
- **contrarian** — the strongest case this fails; the question nobody asked.
- **operator** — can it actually be built / shipped / run; what breaks at scale or on call.
- **competitor** — how the best alternative does this better; why a user switches *to* you, or doesn't.
- **growth** — acquisition, the retention loop, the metric that actually matters vs the vanity one.
- **unit-economics / CFO** — does the math close; cost-to-serve, margin, the spreadsheet that kills it.
- **PM / delivery** — scope, prioritization, complexity-vs-value, the roadmap, the debt-vs-deadline trade, what to *not* build.
- **legal / compliance / risk** — liability, regulation, data exposure, the "can we even do this".
- **positioning** — who it's for, what it replaces, the one-line promise; the muddled message.

## Adversarial & red-team (cross-domain)
- **attacker** — security, abuse, exploit, the malicious or malformed input, the trust you shouldn't extend.
- **bad-faith user** — the troll, the rule-lawyer, the one who does the exact thing you said not to.
- **chaos / failure-injection** — pull the plug, drop the network, corrupt the state, double-click everything.
- **shark-tank / skeptical investor** — why I wouldn't put a dollar in; the polite no and the real reason.
- **pre-mortem** — it's a year later and this failed; narrate what killed it.

## Process, org & longevity
- **maintainer-burden** — who keeps this alive; the bus factor, the toil, the thing only one person understands.
- **team-fit** — does this match how the org actually works, or fight it.
- **longevity / nth-use** — does it hold up on the 5th replay / the 2nd year, or curdle into try-hard / cruft.
- **onboarding** — can a newcomer pick this up; the implicit knowledge that isn't written down.
- **ethics / externalities** — who's harmed, what's the second-order effect, the incentive it creates.

## Common starting sets (then tailor)
- **hard code review:** code-correctness · security · performance · maintainability · architecture · testing
- **code + delivery:** code-correctness · architecture · PM/delivery · maintainer-burden · attacker
- **design / UI:** first-visitor · editor · typographer · motion · brand-purist
- **writing / essay:** reader · editor · skeptic · stylist · structure
- **a plan / strategy:** the-user · contrarian · operator · unit-economics · pre-mortem
- **an argument / claim:** logician · skeptic · steelman · bayesian · first-principles
- **a pitch / proposal:** shark-tank · the-user · competitor · skeptic · stylist

When in doubt, include at least one **adversarial** lens (it catches what the friendly lenses
rationalize) and one **subtraction-first** lens (editor / contrarian / pre-mortem) — those two
postures find the most across almost any artifact.
