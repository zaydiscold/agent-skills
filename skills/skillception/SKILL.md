---
name: skillception
description: Use when authoring, refactoring, auditing, or learning to build any agent skill — for Claude Code, the Claude API, claude.ai, the Claude Agent SDK, Hermes Agent (Nous Research), OpenClaw, Codex, Cursor, Cline, or Antigravity. Use when the user says any of "make a skill", "write a skill", "skill for [tool]", "skill best practices", "fix this skill", "review my SKILL.md", "skill description not triggering", "skill discovery", "skill frontmatter", "progressive disclosure", "agent skill format", "claude skill", "SKILL.md template", "Hermes skill", "skillception", "meta skill". Use even when the user does not say the word "skill" but is clearly authoring a SKILL.md, packaging an onboarding guide for an agent, or trying to make an LLM consistently follow a multi-step procedure. Use proactively whenever a workflow has been repeated more than once. This skill is the canonical, self-contained authority on skill authoring; load it first, follow it exactly.
license: MIT
compatibility: Format-agnostic. Anthropic Agent Skills (canonical), agentskills.io open standard, Claude Code extensions, Hermes Agent, OpenClaw. Required reading before authoring any skill.
metadata:
  version: "1.0.0"
  author: zaydiscold
  source-of-truth-citations:
    - https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf
    - https://agentskills.io/skill-creation/best-practices
    - https://agentskills.io/specification
    - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
    - https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
    - https://code.claude.com/docs/en/skills
  hermes-mirror:
    name: skillception
    description: Master reference for authoring agent skills across platforms. Use whenever creating, editing, auditing, or learning to write a SKILL.md file.
    platforms: [macos, linux, windows]
    tags: [Meta, Authoring, Documentation, Skills, BestPractices]
---

<!-- ─────────────────────────────────────────────────────────────────────
     Skillception — The Master Skill for Authoring Agent Skills
     ("Skillception" — the skill about making skills)
     ─────────────────────────────────────────────────────────────────────

     This file is intentionally comprehensive. The Anthropic spec
     recommends SKILL.md ≤ 500 lines for optimal token cost on every
     activation. This skill exceeds that on purpose: it is a study
     document and the canonical authority on skill authoring, not a
     tactical workflow skill. Trade-off: ~50K tokens to load vs. the
     same content scattered across files an agent must hop between.
     If you are going to violate the 500-line rule, do it consciously
     and document the trade-off — like this comment block.
     ──────────────────────────────────────────────────────────────── -->

# Skillception

> **Mandatory authorities — this skill MUST adhere to and defer to these in any conflict:**
>
> 1. Anthropic, **The Complete Guide to Building Skills for Claude** (33-page PDF, January 2026). https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf
> 2. **agentskills.io / Best practices for skill creators** (open standard, evolving). https://agentskills.io/skill-creation/best-practices
> 3. **agentskills.io / Specification** — the canonical wire format. https://agentskills.io/specification
>
> Anything written below that contradicts those three is wrong. Re-read those three first if you are unsure. Violating the letter of these rules is violating the spirit of these rules.

---

## §0. The 60-Second TL;DR

A **skill** is a folder containing a `SKILL.md` plus optional `scripts/`, `references/`, and `assets/`. The folder is loaded *progressively* by an agent: only `name` + `description` are pre-loaded (~100 tokens); the body is read on activation (≤5,000 tokens recommended); supporting files are read or executed only when the body tells the agent to.

A skill is an **employee**, not a file. CLAUDE.md is a sticky note; a skill is the recipe book, the pan, and the pantry inventory together.

The five non-negotiable invariants:

1. **`name`** is ≤64 characters, lowercase a–z + digits + hyphens, no leading/trailing/consecutive hyphens, must match the parent folder name, must not contain XML tags, must not be `claude` or `anthropic`.
2. **`description`** is ≤1,024 characters, written in **third person**, and contains both **what the skill does** *and* **when to use it** with concrete trigger keywords. The description IS the trigger; the body is not.
3. **SKILL.md body ≤ 500 lines** (this file is a deliberate exception — see header comment). Move detail to `references/` files referenced **one level deep** from SKILL.md.
4. **Every reference file >100 lines** has a table of contents at the top.
5. **The body assumes the agent is already smart.** Add only what the agent doesn't know on its own. Cut everything else.

If you remember nothing else, remember those five. The rest of this file is why they're true and how to apply them well.

---

## §1. What a Skill Is (and What It Is Not)

### 1.1 Definition

A skill is a **filesystem-based, progressively-loaded module of agent expertise**. It packages instructions, optional scripts, optional reference material, and optional assets into a single folder that an agent can discover, evaluate for relevance, and selectively load on demand.

### 1.2 The two anchoring metaphors

> **"CLAUDE.md is a sticky note. Skills are the recipe book, the pan, and the pantry inventory."** — Thariq Shihipar, Anthropic, *Lessons from Building Claude Code*

> **"A skill is an employee, not a file."** — Twitter agent-engineering folklore, captures the essential difference between skills and prompts.

Both metaphors point at the same shape: a skill is a *bounded competency* with **structure, references, and tools** an agent can reach into — not a paragraph of instructions. The folder shape is what enables progressive disclosure; trying to do the same job in a single inline prompt is what burns context.

### 1.3 Skills vs. CLAUDE.md vs. MCP — the comparison that matters

| Aspect | CLAUDE.md (memory) | Skill | MCP server |
|---|---|---|---|
| Always loaded? | **Yes**, every turn | Only metadata (~100 tokens) | Schema dump on connection |
| Body load timing | Always | On description match | Always (full schema) |
| Token cost (idle) | Full file every turn | ~100 tokens / skill | ~10K–50K tokens / server |
| Update without restart | No (re-read on next turn) | Yes (Claude Code watches dirs) | No (reconnect) |
| Best for | **Facts** that apply to every turn | **Procedures** repeated >1× / day | **External tools** Claude can't invoke directly |
| Anti-pattern | Procedures stuffed into CLAUDE.md | Single-use one-off scripts | Schema bloat consuming 88% of a 200K window |

**Token math worth memorizing.** The GitHub MCP server typically advertises ~50,000 tokens of schema on connection — that is 25% of a 200K context window before the agent has done anything. The same coverage as ten skills costs ~1,000 tokens (10 × ~100), or ~0.5%. Progressive disclosure is two orders of magnitude cheaper than schema dumping. This is the killer argument for skills.

### 1.4 What a skill is NOT

- **NOT a complete application or workflow.** One skill, one coherent unit of work. A skill that queries a database *and* formats results *and* administers the database is doing too much.
- **NOT a custom persona or role-play.** Skills add capability, not personality.
- **NOT a place to override Claude's safety guidelines.** Trusted-source policies apply.
- **NOT a dump of generic best practices.** "Handle errors appropriately. Follow good practices." is not a skill — it's noise. A skill is *non-obvious*, *project-or-domain-specific* knowledge the agent would not have on its own.
- **NOT a markdown file.** The folder is the unit. Files inside the folder are progressively loaded resources, not the skill itself.

### 1.5 When to author a skill

Author a skill when **all** of the following are true:

- The work has been repeated more than once a day OR you have lost time to the same gap more than twice.
- The expertise is *non-obvious* to a fresh agent — it requires project-specific facts, domain quirks, or learned conventions.
- The expertise is *reusable* across projects or sessions (otherwise it goes in CLAUDE.md or `.claude/rules/`).
- You can describe the trigger conditions in <1024 characters of plain language.

If those four are not all true, stop. Use a slash command, a CLAUDE.md note, or a one-off prompt instead.

---

## §2. The Three-Tier Progressive Disclosure Architecture

This is the architecture every skill inherits whether the author thinks about it or not. Authoring well means designing **for** it.

```
┌────────────────────────────────────────────────────────────────────┐
│  Tier 1 — METADATA (always loaded, ~100 tokens / skill)            │
│  Source: YAML frontmatter (name + description)                     │
│  Purpose: Discovery. Agent decides whether to load Tier 2.         │
│  Failure mode: vague description → skill never triggers.           │
└────────────────────────────────────────────────────────────────────┘
                            │ description matches user intent
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│  Tier 2 — INSTRUCTIONS (loaded on activation, ≤5,000 tokens)       │
│  Source: SKILL.md body (everything after frontmatter)              │
│  Purpose: Procedural knowledge — workflows, gotchas, patterns.     │
│  Failure mode: 500+ lines of prose → context burn + worse output.  │
└────────────────────────────────────────────────────────────────────┘
                            │ body references a file or runs a script
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│  Tier 3 — RESOURCES (loaded on demand, effectively unlimited)      │
│  Source: references/*.md, scripts/*.{py,sh,js}, assets/*           │
│  Purpose: API specs, large schemas, executable utilities, data.    │
│  Failure mode: nested references → partial reads, missed content.  │
└────────────────────────────────────────────────────────────────────┘
```

**Three architectural rules that follow from this picture:**

1. **The description is the gate.** If the description is wrong, nothing in Tier 2 or Tier 3 ever runs. Description quality dominates skill quality.
2. **Tier 2 is for *what every activation needs*.** If a section is needed in 30% of activations, move it to Tier 3 and tell Tier 2 *when* to read it.
3. **Tier 3 is free until accessed.** Bundle as much reference material as you want. The cost is zero until the agent reaches for it.

---

## §3. Frontmatter — The Two Required Fields and Everything Else

### 3.1 Required fields (the only two)

```yaml
---
name: my-skill-name
description: One sentence describing what the skill does, then a sentence describing exactly when to use it, including specific trigger phrases.
---
```

That is a complete, valid frontmatter. Everything else is optional.

### 3.2 The `name` field — hard rules

| Rule | Constraint |
|---|---|
| Length | 1 ≤ length ≤ 64 characters |
| Allowed characters | Lowercase a–z, digits 0–9, hyphen `-` |
| Forbidden | Uppercase, spaces, underscores, dots, slashes, XML tags |
| Hyphen rules | No leading hyphen, no trailing hyphen, no consecutive hyphens (`my--skill` invalid) |
| Reserved words | `anthropic`, `claude` (will be rejected) |
| Must match | The name field MUST match the folder name exactly |
| Stylistic preference | **Gerund form** (`processing-pdfs`, `auditing-skills`) over noun form (`pdf-processing`, `skill-audit`) — gerunds describe the activity |

**Valid:** `processing-pdfs`, `analyzing-spreadsheets`, `running-migrations`, `skillception`, `pdf-form-fill`, `commit`, `migrate-react-to-vue`.

**Invalid:** `PDF-Processing` (uppercase), `pdf--processor` (consecutive hyphens), `-pdf` (leading hyphen), `pdf_processing` (underscore), `claude-helper` (reserved word `claude`), `pdf processing` (space), `skill.v2` (dot).

### 3.3 The `description` field — the single most important decision in your skill

This is the field Claude reads to decide whether to load your skill out of potentially 100+ available skills. **More authorial care belongs here than in any other part of the skill.**

#### 3.3.1 Hard rules

| Rule | Constraint |
|---|---|
| Length | 1 ≤ length ≤ 1,024 characters |
| Voice | **Third person** ("Generates commit messages", not "I generate" or "You can use this to") |
| Content | Both **what** the skill does AND **when** to use it |
| Forbidden | XML tags, vague language ("helps with X") |
| Combined cap (Claude Code) | Description + `when_to_use` ≤ 1,536 characters in the listing |

#### 3.3.2 The single biggest description anti-pattern

> ❌ Putting the activation criteria in a `## When to Use This Skill` section *inside the body*.

The body is loaded **after** the description triggers a match. If the trigger isn't in the description, the body never gets read. Putting "when to use" in the body is dead weight.

> ✅ Put activation criteria in the description. Put rationale in the body.

#### 3.3.3 The "use when" framing template

Every great description follows roughly this shape:

```
[VERB] [OBJECT] [optional: outcome/constraint]. Use when [trigger phrase 1], [trigger phrase 2], [trigger phrase 3], or even when [non-obvious phrasing the user might not say].
```

Examples ranked weak → strong:

```yaml
# ❌ WEAK — vague, no trigger keywords
description: Helps with PDFs.

# ❌ WEAK — describes feature, not trigger
description: This skill processes PDF files using pdfplumber and pypdf libraries.

# ⚠️ ACCEPTABLE — has both halves but trigger is generic
description: Extracts text from PDF files. Use when working with PDFs.

# ✅ GOOD — specific triggers, what + when
description: Extracts text and tables from PDF files, fills forms, merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.

# ✅ EXCELLENT — adds the "even if they don't explicitly say" trigger
description: Analyzes a design image and creates a full design system project with separated artboards. Use whenever the user provides a reference image, screenshot, or mockup and wants to extract a design system, build a component library, or reverse-engineer visual patterns — even if they don't explicitly say "design system".
```

The pattern **"even if they don't explicitly say X"** is one of the highest-leverage description techniques. It catches the cases where the user describes the *symptom* but not the *category*.

#### 3.3.4 Description anti-patterns (each with the fix)

| Anti-pattern | Example | Fix |
|---|---|---|
| First-person voice | "I help you with PDFs" | Third person: "Processes PDFs" |
| Workflow summary | "Step 1: load file. Step 2: extract..." | Move steps to body; describe what + when in description |
| Vague verb | "Handles documents" | Concrete verb: "Extracts text and tables from" |
| Missing "when" | "Generates commit messages" | Add: "...Use when the user asks for help writing commit messages or reviewing staged changes" |
| Keyword stuffing | "PDF, pdf, document, file, text, ai, machine learning, claude..." | Pick 3–5 high-signal terms; cut the noise |
| Redundant with `name` | name: `pdf-extractor` / desc: "Extracts PDFs" | Add the *when*: triggers, contexts, file types |
| Past-tense language | "Helped extract data..." | Present tense: "Extracts data..." |
| XML / Markdown tags | "Use `<parser>` to extract" | Plain text only — XML in description is rejected |

#### 3.3.5 Description length budget

Aim for **150–400 characters** in most cases. Use the full 1,024 only when the trigger surface is genuinely large (multiple file types, many user phrasings, ambiguity worth disambiguating). For Claude Code, the listing truncates description + `when_to_use` at 1,536 characters combined — front-load the most important trigger keywords.

### 3.4 Optional frontmatter fields — full catalog

Different platforms add different optional fields. The list below covers all five major surfaces: agentskills.io spec, Anthropic API, claude.ai, Claude Code, and Hermes.

#### 3.4.1 agentskills.io open-standard fields

| Field | Type | Constraints |
|---|---|---|
| `license` | string | Free-form. Recommend short ("MIT", "Apache-2.0") or filename ("LICENSE.txt has terms") |
| `compatibility` | string ≤500 chars | Environment requirements ("Requires Python 3.14+ and uv") |
| `metadata` | map<string, any> | Arbitrary; recommend unique key prefixes to avoid client collisions |
| `allowed-tools` | space-separated string | Experimental; varies by client. Format `Bash(git:*) Read` |

#### 3.4.2 Claude Code-specific fields (extensions to the open standard)

| Field | Purpose | Default |
|---|---|---|
| `when_to_use` | Extra trigger context appended to `description` in the listing | empty |
| `argument-hint` | Autocomplete hint, e.g. `[issue-number]` | empty |
| `arguments` | Named positional arguments for `$name` substitution | empty |
| `disable-model-invocation` | `true` ⇒ only the user can invoke (`/skill`) | `false` |
| `user-invocable` | `false` ⇒ only Claude can invoke (no `/` menu) | `true` |
| `allowed-tools` | Tools Claude can use without approval while skill active | empty |
| `model` | Override session model when this skill is active | inherit |
| `effort` | low / medium / high / xhigh / max | inherit |
| `context` | `fork` ⇒ run in a forked subagent context | none |
| `agent` | Subagent type when `context: fork` (Explore, Plan, general-purpose) | general-purpose |
| `hooks` | Skill-scoped hooks (PreToolUse, PostToolUse, Stop) | empty |
| `paths` | Glob patterns; skill auto-loads only when working with matching files | unbounded |
| `shell` | `bash` (default) or `powershell` for `` !`cmd` `` blocks | bash |

#### 3.4.3 Claude Code dynamic context — `` !`shell-command` ``

A SKILL.md may inject the live output of a shell command into the prompt **before** Claude reads the body. Two forms:

```markdown
## Inline form
Current branch: !`git rev-parse --abbrev-ref HEAD`

## Block form (multi-line)
```!
node --version
npm --version
git status --short
```
```

The command runs at activation; the placeholder is replaced with the output; Claude only sees the rendered text. Combine with `context: fork` and `agent: Explore` for a powerful pattern: *fork a subagent with a tightly-scoped task and live data already inlined*.

#### 3.4.4 Claude Code string substitutions

Available inside SKILL.md when invoked with arguments:

| Variable | Expands to |
|---|---|
| `$ARGUMENTS` | All arguments as a single string |
| `$ARGUMENTS[N]` / `$N` | Nth argument by 0-based index |
| `$name` | Named argument from `arguments:` list (positional mapping) |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_EFFORT}` | Active effort level |
| `${CLAUDE_SKILL_DIR}` | Absolute path to the skill folder (use this for bundled scripts) |

Always reference bundled scripts as `python3 ${CLAUDE_SKILL_DIR}/scripts/foo.py` — never as a relative path that depends on the user's `cwd`.

#### 3.4.5 Hermes Agent (Nous Research) frontmatter

Hermes uses a richer frontmatter for conditional activation and platform gating. If you want a single skill to work in *both* Anthropic surfaces and Hermes, add a `metadata.hermes:` block (see §10.2 for the dual-format pattern):

| Field | Purpose |
|---|---|
| `platforms` | Array; skill auto-hides on incompatible OSes (`[macos]`, `[macos, linux]`) |
| `metadata.hermes.tags` | Categorical tags |
| `metadata.hermes.requires_toolsets` | Skill hidden when ANY listed toolset NOT available |
| `metadata.hermes.requires_tools` | Skill hidden when ANY listed tool NOT available |
| `metadata.hermes.fallback_for_toolsets` | Skill hidden when ANY listed toolset IS available (fallback semantics) |
| `metadata.hermes.fallback_for_tools` | Skill hidden when ANY listed tool IS available |
| `required_environment_variables` | Array of `{ name, prompt, help, required_for }` |
| `required_credential_files` | Array of `{ path, description }` (mounted read-only) |
| Template tokens | `${HERMES_SKILL_DIR}`, `${HERMES_SESSION_ID}` |

Hermes also ships **inline shell snippets** (`` !`cmd` ``) but disabled by default — opt in via `skills.inline_shell: true` in `~/.hermes/config.yaml`.

#### 3.4.6 OpenClaw fields

OpenClaw is closer to the open standard but adds:

```yaml
metadata:
  openclaw:
    os: ["darwin", "linux"]    # OS gating
    requires:
      bins: ["jq", "git"]      # Required binaries on PATH
      config: ["api.token"]    # Required config keys
```

OpenClaw also defines **discovery precedence layers** (highest first): `<workspace>/skills/` > `<workspace>/.agents/skills/` > `~/.agents/skills/` > `~/.openclaw/skills/` > bundled > custom dirs.

### 3.5 Frontmatter checklist (apply before shipping)

- [ ] `name` matches folder name exactly
- [ ] `name` passes hard rules in §3.2
- [ ] `description` is third person
- [ ] `description` contains both **what** and **when**
- [ ] `description` includes ≥3 concrete trigger keywords
- [ ] `description` ≤ 1,024 characters
- [ ] No XML tags anywhere in frontmatter
- [ ] No reserved words (`claude`, `anthropic`) in `name`
- [ ] If using Claude Code-specific fields, document why in a comment
- [ ] If targeting Hermes, the dual `metadata.hermes:` block is present (see §10.2)

---

## §4. Naming — Patterns That Make Skills Discoverable

### 4.1 Gerund-form preference

Anthropic recommends gerund (verb + -ing) form because it describes the **activity**, which matches how users phrase requests:

| Gerund (preferred) | Noun-form (acceptable) |
|---|---|
| `processing-pdfs` | `pdf-processing` |
| `analyzing-spreadsheets` | `spreadsheet-analysis` |
| `migrating-databases` | `database-migration` |
| `auditing-skills` | `skill-audit` |
| `writing-documentation` | `doc-writing` |

Action-oriented imperative is also acceptable for skills with a single dominant action: `commit`, `deploy`, `migrate-component`.

### 4.2 Avoid — naming anti-patterns

- **Vague:** `helper`, `utils`, `tools`, `wizard`, `assistant`
- **Overly generic:** `documents`, `data`, `files`
- **Reserved words:** anything containing `claude` or `anthropic`
- **Inconsistent within a collection:** mixing gerunds and nouns randomly
- **Including the agent name:** `cursor-skill`, `codex-helper` (the host already knows what tool it is)
- **Versioning in the name:** `pdf-extractor-v2` (use `metadata.version` instead)

### 4.3 Name as folder name

The folder name **must** equal the `name` field. If `name: skillception`, the folder is `skillception/`. Loaders enforce this and reject mismatches.

---

## §5. Writing the Body — Everything After the Frontmatter

### 5.1 The 500-line rule

`SKILL.md` body should be **≤500 lines**. If you exceed it, you have one of these problems:

1. **Multiple skills in one** — split into separate skills.
2. **Reference content masquerading as procedure** — move to `references/*.md` and link.
3. **Over-explanation** — assume Claude is smart and cut.
4. **Deliberate study document** — like this file. Document the trade-off in a header comment.

### 5.2 Recommended body structure (the Hermes pattern, refined)

The Nous Research / Hermes documentation crystallized the most-effective body shape. Use it for any procedural skill:

```markdown
# Skill Title

Brief one-paragraph intro — what does this enable?

## When to use
(Optional. Mostly redundant with description but useful for human readers
auditing the skill. Don't rely on this section to trigger activation.)

## Quick reference
A table or short list of common commands / API calls / outputs.

## Procedure
Numbered, imperative steps. Reasoning embedded ("...because X").

## Gotchas
The highest-signal section. Concrete corrections to non-obvious failures.

## Verification
How does the agent confirm success? What is the validation loop?

## References
Links to bundled files (one level deep), with WHEN to read each one.
```

### 5.3 Voice and style

#### 5.3.1 Imperative form

Models pattern-match to imperative instructions better than to declarative or conditional ones. Anthropic confirmed in their internal source code that production prompts use imperative voice deliberately.

```markdown
# ✅ GOOD — imperative
Extract the color palette from the image.

# ❌ AVOID — declarative
You should extract the color palette from the image.

# ❌ AVOID — conditional
If the user wants colors, then you can extract the palette.
```

#### 5.3.2 Reasoning over rigidity

When you find yourself writing **ALWAYS** or **NEVER** in all caps, reframe to explain *why*. A model that understands the reason makes better decisions in unanticipated situations.

```markdown
# ❌ Rigid — fails when the situation changes slightly
NEVER navigate to the editor during the build.

# ✅ Reasoned — model can generalize
Stay on the hub during the build. The user watches thumbnails appear
progressively — navigating to the editor would break the visual feedback
loop.
```

The exception: **fragile, low-freedom operations** (database migrations, irreversible deploys) where you want NO improvisation. For those, prescribe the exact command and forbid modification (see §6 — Calibrating Control).

#### 5.3.3 Consistent terminology

Pick one term for each concept and use it throughout. Inconsistency confuses both Claude and human reviewers.

```
# ❌ Inconsistent
"API endpoint" → "URL" → "API route" → "path"
"field" → "box" → "element" → "control"
"extract" → "pull" → "get" → "retrieve"

# ✅ Consistent
Always "API endpoint", "field", "extract".
```

#### 5.3.4 Repeating quality expectations

When quality is the goal (design, writing, code review), **repeat the quality bar at multiple points** in the skill. Anthropic's internal canvas-design skill deliberately uses language like "meticulously crafted", "painstaking attention", "master-level execution" repeatedly. Each repetition reinforces the standard.

This is not redundancy — it is calibration. The model treats quality language as a probabilistic signal; one mention is weak, three mentions across sections is strong.

### 5.4 What the body should and should not contain

#### 5.4.1 Add what the agent lacks

The body's *only* job is to add knowledge the agent doesn't already have. Test every paragraph with three questions:

1. Does the agent really need this explanation?
2. Can I assume the agent knows this?
3. Does this paragraph justify its token cost?

If the answer to (1) is "no" or to (2) is "yes," cut it.

```markdown
# ❌ TOO VERBOSE (~150 tokens)
PDF (Portable Document Format) files are a common file format that
contains text, images, and other content. To extract text from a PDF,
you'll need to use a library. There are many libraries available for
PDF processing, but pdfplumber is recommended because it's easy to use
and handles most cases well. First, you'll need to install it...

# ✅ CONCISE (~50 tokens)
Use pdfplumber for text extraction:

import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

The concise version assumes Claude knows what PDFs are and how Python imports work. It does — those are training-set basics.

#### 5.4.2 No time-sensitive information

Anything dated will go stale. Push deprecated content into a collapsible "Old patterns" section, not the main flow:

```markdown
# ❌ Time-sensitive
If you're doing this before August 2026, use the old API.

# ✅ Versioned
## Current method
Use the v2 API: `api.example.com/v2/messages`

## Old patterns
<details>
<summary>Legacy v1 API (deprecated 2026-08)</summary>
The v1 API used `api.example.com/v1/messages`. No longer supported.
</details>
```

### 5.5 Concrete examples beat abstractions

For any non-trivial pattern, include at least one fully-worked example. Models pattern-match on examples better than on abstract descriptions.

```markdown
## Commit message format

Generate commit messages following these examples:

**Example 1**
Input: Added user authentication with JWT tokens
Output:
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware

**Example 2**
Input: Fixed bug where dates displayed incorrectly in reports
Output:
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

Three examples is the sweet spot for most patterns: enough to disambiguate, not so many that the body bloats.

---

## §6. Calibrating Control — Specificity vs. Freedom

This is the most under-appreciated part of skill authoring. The right level of prescriptiveness depends on the **fragility of the task**.

### 6.1 The three control modes

| Mode | When to use | Example |
|---|---|---|
| **High freedom** (text instructions) | Multiple valid approaches, decisions depend on context | Code review skills, brainstorming skills, design analysis |
| **Medium freedom** (template + parameters) | Preferred pattern exists, some variation acceptable | Report generation, scaffolding |
| **Low freedom** (exact script, no params) | Operations are fragile, consistency is critical, sequence matters | Database migrations, deploys, releases |

### 6.2 The bridge metaphor (Anthropic, paraphrased)

> Think of the agent as a robot exploring a path:
> - **Narrow bridge with cliffs on both sides:** there's only one safe way forward. Provide specific guardrails, exact commands, no improvisation. (Low freedom.)
> - **Open field with no hazards:** many paths lead to success. Give general direction and trust the agent to find the route. (High freedom.)

Most skills are mixed. **Calibrate each section independently.**

### 6.3 Example: the same skill, three control levels

```markdown
## Code review process (HIGH freedom — exploratory)
1. Analyze the code structure and organization.
2. Check for potential bugs or edge cases.
3. Suggest improvements for readability and maintainability.
4. Verify adherence to project conventions.

## Generate report (MEDIUM freedom — preferred pattern)
Use this template; adapt sections as needed:

def generate_report(data, format="markdown", include_charts=True):
    # Process, then output in specified format, optionally with charts.

## Database migration (LOW freedom — fragile)
Run exactly this sequence:

python scripts/migrate.py --verify --backup

Do not modify the command or add additional flags.
```

### 6.4 Rule of thumb

If the task has **side effects you cannot reverse** (data loss, prod deploy, sending email, executing trades), default to **low freedom** with explicit forbidden modifications. If the task is read-only or in a sandbox, default to **high freedom** unless quality has been visibly suffering.

---

## §7. Defaults, Not Menus

When multiple tools or libraries could solve a problem, **pick one as the default and mention alternatives only as escape hatches**.

```markdown
# ❌ Too many choices — produces decision paralysis
You can use pypdf, pdfplumber, PyMuPDF, or pdf2image, depending on...

# ✅ Clear default + escape hatch
Use pdfplumber for text extraction:

import pdfplumber

For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

This rule is mechanical: every time you write "you could use A, B, or C", stop. Pick one. Demote the rest to a one-line "if X, instead use Y" addendum.

---

## §8. Procedures Over Declarations

Teach the agent **how to approach a class of problems**, not **what to produce for one specific instance**. The first generalizes; the second is dead weight.

```markdown
# ❌ Specific answer — useful only for THIS exact task
Join the `orders` table to `customers` on `customer_id`, filter where
`region = 'EMEA'`, and sum the `amount` column.

# ✅ Reusable method — works for any analytical query
1. Read the schema from `references/schema.yaml` to find relevant tables.
2. Join tables using the `_id` foreign key convention.
3. Apply any filters from the user's request as WHERE clauses.
4. Aggregate numeric columns as needed and format as a markdown table.
```

The exception: **output format templates and "never do X" constraints** are legitimately specific. The principle is that the *approach* should generalize even when individual constraints are specific.

---

## §9. The Patterns — Reusable Body Structures

Use these patterns when they fit. Not every skill needs all of them.

### 9.1 Gotchas section (the highest-leverage pattern)

The single highest-signal content in any skill is its **gotchas** list — concrete corrections to mistakes the agent will make without being told. These are not general advice ("handle errors carefully"); they are environment-specific facts that defy reasonable assumptions.

```markdown
## Gotchas

- The `users` table uses soft deletes. Queries must include
  `WHERE deleted_at IS NULL` or results will include deactivated accounts.
- The user ID is `user_id` in the database, `uid` in the auth service,
  and `accountId` in the billing API. All three refer to the same value.
- The `/health` endpoint returns 200 as long as the web server is running,
  even if the database connection is down. Use `/ready` for full health.
- React 19's `useEffect` runs twice in StrictMode dev. Tests using
  effect-spies must account for this or use `useEffectEvent`.
```

**Iterating on gotchas is the single best way to improve a skill over time.** Every time you correct an agent's mistake, ask: would the next agent make the same mistake? If yes, it's a gotcha.

Keep gotchas in `SKILL.md` itself, not in a reference file. Reference files are loaded *when the body says to load them*; gotchas need to be visible **before** the agent encounters the situation.

### 9.2 Templates for output format

When you need a specific format, provide a literal template. Models pattern-match against concrete structures more reliably than they follow prose descriptions.

```markdown
## Report structure

ALWAYS use this exact template:

# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```

For flexible output, provide the template as "a sensible default, but use your best judgment based on the analysis."

### 9.3 Checklists for multi-step workflows

For complex tasks with dependencies or validation gates, give the agent a checklist to track progress.

```markdown
## PDF form filling workflow

Copy this checklist and check off items as you complete them:

Task Progress:
- [ ] Step 1: Analyze the form (run analyze_form.py)
- [ ] Step 2: Create field mapping (edit fields.json)
- [ ] Step 3: Validate mapping (run validate_fields.py)
- [ ] Step 4: Fill the form (run fill_form.py)
- [ ] Step 5: Verify output (run verify_output.py)
```

### 9.4 Validation loops

`Do work → run validator → fix errors → repeat until validation passes`. This pattern enormously improves output quality on any task that has a notion of "correct."

```markdown
## Editing workflow

1. Make your edits.
2. Run validation: `python scripts/validate.py output/`
3. If validation fails:
   - Review the error message.
   - Fix the issues.
   - Run validation again.
4. Only proceed when validation passes.
```

The "validator" doesn't have to be a script. A reference checklist, a reference document, or a self-check ("re-read your output and verify each constraint") can all serve.

### 9.5 Plan-validate-execute

For batch operations, destructive operations, or complex validations: have the agent first produce an **intermediate plan** in a structured format, validate the plan against a source of truth, and only then execute.

```markdown
## PDF batch fill

1. Extract form fields: `python scripts/analyze_form.py input.pdf` → `form_fields.json`
2. Create `field_values.json` mapping each field name to its intended value.
3. Validate: `python scripts/validate_fields.py form_fields.json field_values.json`
4. If validation fails, revise `field_values.json` and re-validate.
5. Fill the form: `python scripts/fill_form.py input.pdf field_values.json output.pdf`
```

The validation script should produce **specific, actionable errors**:
> "Field 'signature_date' not found. Available fields: customer_name, order_total, signature_date_signed."

Vague errors ("validation failed") leave the agent guessing.

### 9.6 Conditional workflow

When a skill has multiple branches, route the agent explicitly:

```markdown
## Document modification workflow

1. Determine the modification type:
   - **Creating new content?** → Follow "Creation workflow" below.
   - **Editing existing content?** → Follow "Editing workflow" below.

2. Creation workflow:
   - Use docx-js library.
   - Build document from scratch.

3. Editing workflow:
   - Unpack existing document.
   - Modify XML directly.
   - Validate after each change.
```

If a branch becomes large, push it into a separate file (Tier 3) and have the body say *when* to read it.

### 9.7 Bundling reusable scripts

If you find yourself describing the same parsing logic, validation logic, or chart-rendering logic in multiple skills (or watching agents reinvent it on every run), bundle it as a script and have the skill execute it. Scripts:

- Save tokens (script code never enters context)
- Save time (no code generation per run)
- Are more reliable than re-generated code
- Ensure consistency across uses

Reference them with `python ${CLAUDE_SKILL_DIR}/scripts/X.py`. Make execution intent explicit:

```markdown
- "Run `analyze_form.py` to extract fields" — execute
- "See `analyze_form.py` for the field-extraction algorithm" — read as reference
```

### 9.8 Visual analysis

When inputs can be rendered as images (forms, charts, screenshots), have the agent convert and analyze visually. This unlocks the model's vision capabilities for layout-heavy tasks.

---

## §10. Cross-Platform Compatibility

Authoring a skill that works on Anthropic surfaces *and* Hermes *and* OpenClaw is possible if you respect the lowest common denominator and use platform-specific extensions only as additions.

### 10.1 The lowest-common-denominator rule

A maximally-portable skill uses **only**:

- `name` (matches folder, lowercase, hyphens, ≤64)
- `description` (≤1,024, third person, what + when)
- A markdown body following §5

That skill loads on Claude Code, claude.ai, the Anthropic API, OpenClaw, and most third-party clients without modification. Anything beyond those two fields is a platform-specific opt-in.

### 10.2 The dual-format pattern (Anthropic + Hermes in one file)

For skills that must work on both Anthropic surfaces and Hermes, use a single frontmatter with a nested Hermes block:

```yaml
---
name: my-skill
description: Standard cross-platform description with what and when. Use when [triggers].
license: MIT
metadata:
  version: "1.0.0"
  hermes:
    platforms: [macos, linux]
    tags: [Category, Subcategory]
    requires_toolsets: [web]
    config:
      - key: my.setting
        default: "sensible-default"
        prompt: "Display prompt"
required_environment_variables:
  - name: MY_API_KEY
    prompt: "Enter your API key"
    help: "Get one at https://example.com"
    required_for: "API access"
---
```

Anthropic clients ignore unknown frontmatter fields. Hermes reads its `metadata.hermes:` and the top-level Hermes-specific fields (`required_environment_variables`, `required_credential_files`). The result: one canonical file, two surfaces.

### 10.3 Path discipline (Unix-style only)

Use forward slashes in **all** paths, even when authoring on Windows:

```
# ✅ GOOD
scripts/helper.py
references/guide.md

# ❌ BREAKS on Unix
scripts\helper.py
references\guide.md
```

Backslashes are valid Windows separators but Unix interprets them as escape characters. Forward slashes work everywhere.

### 10.4 Per-surface skill locations (cheat-sheet)

| Surface | Personal scope | Project scope |
|---|---|---|
| Claude Code | `~/.claude/skills/<name>/SKILL.md` | `.claude/skills/<name>/SKILL.md` |
| claude.ai | Settings → Features → upload zip | n/a |
| Claude API | `POST /v1/skills` (workspace-wide) | n/a |
| Hermes | `skills/category/<name>/` | `optional-skills/category/<name>/` |
| OpenClaw | `~/.openclaw/workspace/skills/<name>/` | `<workspace>/skills/<name>/` |
| Codex / Cursor / Antigravity | `~/.agents/skills/<name>/` | `.agents/skills/<name>/` |

Symlinking from a single canonical repo (the pattern `agent-skills` follows) lets you maintain one source of truth across all surfaces.

### 10.5 Runtime constraints to design around

| Surface | Network | Package install | Filesystem |
|---|---|---|---|
| claude.ai | Varies (admin-controlled) | npm/PyPI/GitHub | Sandbox |
| Claude API | **None** | None (pre-installed only) | Container |
| Claude Code | Full | Local-only recommended | User's machine |
| Hermes | Configurable backends (local, Docker, Modal) | Per-backend | Per-backend |

If you write a skill that depends on network calls or fresh `pip install`, it will fail on the Claude API. Bundle dependencies into the skill itself, or document the constraint in `compatibility:`.

### 10.6 MCP tool references

If your skill uses MCP tools, **always use fully-qualified tool names** to avoid "tool not found" errors when multiple MCP servers are connected:

```markdown
Use the BigQuery:bigquery_schema tool to retrieve table schemas.
Use the GitHub:create_issue tool to create issues.
```

Format: `ServerName:tool_name`.

---

## §11. The Nine Skill Archetypes (Anthropic's Internal Taxonomy)

Anthropic's internal skill catalog clusters into nine archetypes. The best skills fit cleanly into **one** of them; multi-archetype skills are usually doing too much.

| # | Archetype | Examples |
|---|---|---|
| 1 | **Library & API Reference** | Internal SDK docs, CLI gotchas, framework conventions |
| 2 | **Product Verification** | Playwright tests, tmux session capture, video recording, smoke tests |
| 3 | **Data Fetching & Analysis** | Dashboard queries, cohort comparisons, monitoring stack hooks (Grafana, Datadog) |
| 4 | **Business Process Automation** | Standups, ticket creation, weekly recap, recurring batch jobs |
| 5 | **Code Scaffolding & Templates** | Org-pattern boilerplate, framework-correct stubs |
| 6 | **Code Quality & Review** | Adversarial review, style enforcement, test-coverage discipline |
| 7 | **CI/CD & Deployment** | Babysit PRs, deploy services, cherry-pick to prod, release notes |
| 8 | **Runbooks** | Symptom → investigation → structured incident report |
| 9 | **Infrastructure Ops** | Cleanup orphaned resources, dep upgrades, cost-spike investigation |

When scoping a new skill, name the archetype out loud first. If the answer is "it's a mix of 4 and 7," that's a smell — split it.

---

## §12. The Discipline — Build Evaluations BEFORE Writing the Skill

This section adapts the Iron Law from `superpowers:writing-skills` and the official Anthropic best-practices doc into one rigorous workflow. **Skip this only at your peril.**

### 12.1 The Iron Law

> **No skill ships without a failing baseline test first.**

If you wrote the body before you watched an agent fail without it, you don't know what the skill is teaching, you only know what *you think* it's teaching. Those are different.

### 12.2 The five-step iterative workflow

1. **Identify gaps.** Run an agent on representative tasks **without** the skill. Document the specific failures verbatim — what choices did it make, what rationalizations did it use, what did it miss?
2. **Create three evaluations.** Concrete tasks the skill should solve. Specify expected behaviors as a checklist.
3. **Establish baseline.** Measure the agent's performance on the three evals without the skill. This is your "RED" state.
4. **Write the minimum SKILL.md** that addresses the documented failures. Don't add content for hypothetical cases.
5. **Verify.** Re-run the evals **with** the skill loaded. The agent should now comply. This is your "GREEN" state. Iterate until bulletproof.

### 12.3 The Claude A / Claude B pattern

The most effective dev cycle uses **two** agent instances:

- **Claude A** is your collaborator. You work with it to design and refine the skill. Claude A understands what other agents need and helps you write good instructions.
- **Claude B** is the test subject. A fresh instance with the skill loaded that you give real tasks to. Watch where it struggles, succeeds, or makes unexpected choices.

The cycle:

1. Work with Claude A on a real task (no skill yet). Provide context, corrections, preferences.
2. Ask Claude A to extract the reusable pattern into a SKILL.md.
3. Test on Claude B (fresh instance, skill loaded) on related tasks.
4. Bring observations back to Claude A — "Claude B forgot the test-account filter; how do we make that more prominent?"
5. Refine. Re-test on Claude B. Repeat.

This is more effective than authoring the skill yourself because Claude A has direct knowledge of agent failure modes and Claude B reveals gaps your domain expertise hides from you.

### 12.4 Test on every model you'll deploy to

Skills act as additions to the underlying model. **What works on Opus may underperform on Haiku.** Test the skill on every Claude model (Haiku, Sonnet, Opus) and on Hermes/OpenClaw if you target those surfaces.

A common failure: skill works perfectly on Opus, ships, then a Haiku-driven session ignores it because the description trigger isn't strong enough for the smaller model. Strengthen the description and re-test.

### 12.5 Three types of test scenario

| Skill type | Test approach |
|---|---|
| **Discipline-enforcing** (rules, requirements) | Pressure scenarios — does the agent comply under stress, time pressure, sunk cost? Add explicit counters for each rationalization observed. |
| **Technique** (how-to guides) | Application scenarios — can the agent apply the technique to novel cases? Variations? Edge cases? |
| **Pattern** (mental models) | Recognition scenarios — does the agent recognize when the pattern applies? Counter-examples? |
| **Reference** (API docs, lookups) | Retrieval scenarios — can the agent find the right info? Are common use cases covered? |

### 12.6 The rationalization table (for discipline skills)

Every excuse the agent makes for skipping the rule goes in a table. Build the table incrementally as you observe new excuses, and include explicit counters in the skill body.

Example table — "common excuses for skipping testing" (paste this into discipline skills as-is):

| Excuse | Reality |
|---|---|
| "Skill is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "It's just a reference" | References can have gaps and unclear sections. Test retrieval. |
| "Testing is overkill" | Untested skills always have issues. 15 min testing saves hours. |
| "I'll test if problems emerge" | Problems = agents can't use skill. Test BEFORE deploying. |
| "Too tedious to test" | Less tedious than debugging in production. |
| "I'm confident it's good" | Overconfidence guarantees issues. Test anyway. |
| "Academic review is enough" | Reading ≠ using. Test application. |
| "No time to test" | Untested skill wastes more time fixing later. |

### 12.7 Red flags — STOP and restart

These thoughts mean you are rationalizing skipping the discipline:

- "I already manually tested it"
- "The body is fine, I don't need to re-baseline"
- "It's a small change"
- "Tests-after-shipping achieve the same goal"
- "This is different because…"
- "I'll add the test later"
- "I'm confident it works"

**All of these mean: stop. Run the baseline. Write the minimum. Verify GREEN.**

### 12.8 Refactor — close every loophole

After the first GREEN, run the agent through more pressure scenarios. If it finds a new rationalization, add an explicit counter. Re-test. Repeat until you cannot break it.

> Violating the letter of the rules is violating the spirit of the rules. Spirit-vs-letter arguments are themselves a rationalization. Cut them off explicitly in the body.

---

## §13. Spending Context Wisely (The Token Economy)

The context window is a **public good**. Every token in your skill competes with conversation history, system prompts, other skills' metadata, the user's actual request, and tool definitions. A skill that wastes tokens degrades every other skill in the session.

### 13.1 The "Claude is already smart" axiom

Default assumption: the agent already knows the basics of every common technology, library, language, and concept. **You are adding domain-specific or project-specific knowledge it does not have.**

Cut everything that explains things the agent already knows.

### 13.2 The audit pass

After drafting a SKILL.md, do an audit pass with three questions on every paragraph:

1. Does the agent really need this? (If no, delete.)
2. Can I assume the agent already knows this? (If yes, delete.)
3. Does this paragraph justify its token cost? (If no, delete or move to Tier 3.)

Be ruthless. The body should feel **almost too sparse** when you're done — that's the right level. If it feels comfortable and complete, you have probably over-explained.

### 13.3 Token budgets in practice

| Loaded | Token target | Note |
|---|---|---|
| YAML frontmatter (Tier 1) | 50–150 tokens | Counts against every skill in every session |
| SKILL.md body (Tier 2) | <5,000 tokens | Loaded only on activation; aim for <2,500 if possible |
| Combined references files | unlimited | Each file loaded only when body says to |
| Combined scripts | unlimited | Code never enters context — only output |

This skill (Skillception) is the deliberate exception: ~1,800 lines × ~25 tokens/line ≈ 45,000 tokens on activation. Justified because it is a study reference invoked rarely; *not* a pattern to imitate for tactical skills.

### 13.4 Skills vs. MCP — token math you can quote

Adding an MCP server typically advertises 10K–50K tokens of schema on connection (the GitHub MCP commonly cited at ~50K). That cost is paid every session, whether you use the server or not, before you've issued a single request.

Adding a skill costs ~100 tokens per skill at startup; the body loads only when activated. **An equivalent capability shipped as a skill rather than an MCP server is 100×–500× cheaper per idle session.** Skills win whenever the capability can be expressed as a procedure rather than a tool surface.

---

## §14. Anti-Patterns Encyclopedia

Every entry: the anti-pattern, why it fails, and the fix.

### 14.1 Description anti-patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Trigger lives in the body | Body only loads after trigger; trigger in body never fires | Move all activation criteria into the description |
| First-person voice | Inconsistent POV breaks discovery in some clients | Third person ("Processes…") |
| Workflow summary in description | Steers agent to follow description instead of body | Describe what + when only; no steps |
| Vague verb ("helps with", "handles") | Description doesn't match user phrasing | Concrete action verb ("extracts", "generates") |
| Keyword stuffing | Lowers signal density; description gets truncated | 3–5 high-signal terms, no filler |
| Missing the "when" | Skill never triggers | Add "Use when [phrasings]" |

### 14.2 Body anti-patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Body >500 lines without justification | Token waste; agent struggles to extract relevant parts | Split into references; or document the trade-off |
| Walls of text | Models lose track in unstructured prose | Headers, numbered steps, tables, code blocks |
| Generic instructions ("make it look good") | Models cannot operationalize | Specific anti-patterns ("avoid uniform spacing") |
| ALWAYS / NEVER without reasoning | Fragile when situation differs from anticipated | Explain *why* — model generalizes from rationale |
| Time-sensitive content in main flow | Goes stale | "Old patterns" section |
| Inconsistent terminology | Confuses both agent and reviewer | Pick one term per concept |
| `@import`-style references in body | `@` syntax only works in CLAUDE.md, not SKILL.md | Use markdown links: `[text](path/file.md)` |
| Cross-skill dependencies | Each skill must be self-contained | Duplicate critical context, or merge skills |
| "When to Use This Skill" section in body | Body loads after trigger; section is dead | Move to description |
| Agent-name in body ("Claude will…") | Skills run on multiple models/clients | Use "the agent" or imperative voice |

### 14.3 File-organization anti-patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Reference chains (`SKILL.md → A.md → B.md → C.md`) | Agents partial-read referenced-from-references; miss content | All references one level deep from SKILL.md |
| Reference file >100 lines without TOC | Agents partial-read; miss content past their preview | Add table of contents at top |
| Windows backslashes in paths | Breaks on Unix | Forward slashes only |
| Bundling node_modules / build artifacts | Multi-MB skills, slow loading, security audit nightmare | `.gitignore` aggressively |
| Folder name ≠ `name` field | Loaders reject | Match exactly |

### 14.4 Script / scaffolding anti-patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Punting errors to the agent (`open(path).read()` no try/except) | Wastes tokens making agent debug | Handle errors in script with helpful messages |
| Voodoo constants (`TIMEOUT = 47`) | Agent (and humans) can't decide whether to change | Self-documenting comments — *why* this value? |
| Magic numbers in prose | Same problem | "The timeout of 30s accounts for slow connections" |
| Assuming packages installed | Skill fails first run | Document dependencies; or bundle with skill |
| Network-dependent scripts on Anthropic API | API has no network access | Document `compatibility:` constraint or restructure |

### 14.5 Process anti-patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Writing skill before baseline | You don't know what it's teaching | Run agent without skill first; document failures |
| Adding "for hypothetical cases" content | Bloat with no demonstrated value | Only address documented failures |
| Skipping eval on Haiku | Skill underperforms on smaller models | Test on every model you deploy to |
| Editing skill without re-testing | Untested changes regress agents | Re-run evals on every edit |

---

## §15. Distribution & Sharing

### 15.1 Scope decision tree

```
Is the skill specific to one project?
├─ YES → .claude/skills/ (project scope, commit to repo)
└─ NO → Does it need to ship with other tools?
    ├─ YES → Plugin (.claude-plugin manifest, marketplace distribution)
    └─ NO → ~/.claude/skills/ (personal scope) and/or your central repo
```

### 15.2 Versioning

Use semantic versioning in `metadata.version:`.

- **MAJOR** — breaking changes to behavior, frontmatter, or activation triggers
- **MINOR** — new features, backward-compatible
- **PATCH** — bug fixes, documentation updates, gotcha additions

Document deprecations in a `## Old patterns` section. Give 30 days before deleting deprecated content from skills others depend on.

### 15.3 Publishing channels

| Channel | When to use |
|---|---|
| GitHub repo (your own) | Default. One canonical source, others install via `npx skills add` or symlink |
| Plugin marketplace (Claude Code) | When the skill is part of a larger plugin that includes hooks, agents, commands |
| Anthropic Skills Hub (`anthropics/skills`) | Aspirational — open-source skills with broad utility |
| Hermes Hub (`hermes skills publish`) | If targeting Hermes specifically |
| Internal company registry | At scale (>50 employees), curate centrally |

### 15.4 The "small team vs. scale" pattern

- **Small team:** check skills into the project repo. Iterate freely. Don't formalize until you have 20+ skills.
- **At scale:** stand up an internal plugin marketplace; introduce review workflow; let skills grow organically before curating.

> "The best skills started as a few lines and one gotcha, then got better as Claude hit new edge cases." — Anthropic internal

---

## §16. Security

Skills are **executable instructions**. Treat them like installing software, not like reading documentation.

### 16.1 Audit checklist for third-party skills

Before adding any skill from an unknown source:

- [ ] Read the **entire** SKILL.md, including all referenced files
- [ ] Read every file in `scripts/`, `references/`, `assets/`
- [ ] Look for unexpected network calls, file access patterns, exfiltration paths
- [ ] Check for prompt-injection patterns (instructions to ignore previous context)
- [ ] Check for destructive shell commands (`rm -rf`, fork bombs, history rewrites)
- [ ] Check for credential or token harvesting (env-var reads, `~/.ssh/` access)
- [ ] Check for unusual `allowed-tools` requests
- [ ] Check `compatibility:` and `requires_*` claims for plausibility
- [ ] Review version history if available

### 16.2 Threat model

| Threat | Mitigation |
|---|---|
| Tool misuse — skill instructs agent to invoke tools harmfully | Audit `allowed-tools`; deny by default |
| Data exfiltration — skill leaks sensitive data to external systems | Block network in untrusted skills; review all `fetch`/`curl`/HTTP calls |
| Prompt injection — fetched content contains malicious instructions | Treat any fetched URL as untrusted; sanitize before using as input |
| Supply chain — compromised dependency in scripts/ | Pin versions, audit lockfiles, no global installs |
| Privilege escalation — skill assumes more access than user intended | Constrain via `permissions` settings, not trust in skill content |

### 16.3 Hermes trust tiers

Hermes ships a four-tier trust model worth replicating:

- **builtin** — ships with the host (always trusted)
- **official** — from a curated optional-skills repo (no third-party warning)
- **trusted** — from named trusted publishers (e.g., `openai/skills`, `anthropics/skills`)
- **community** — non-dangerous findings can be `--force`d; dangerous findings blocked

Apply the same tiering to your own catalog: only the `builtin` tier should run unaudited.

---

## §17. The Pre-Ship Checklist (apply on every skill, every release)

### Frontmatter
- [ ] `name` matches folder name exactly
- [ ] `name` lowercase a-z, digits, hyphens; ≤64 chars; not `claude` or `anthropic`
- [ ] `description` ≤1,024 chars, third person, what + when, ≥3 trigger keywords
- [ ] `description` does not summarize workflow; does not contain XML
- [ ] If using Claude Code-specific fields, intentional and documented

### Body
- [ ] ≤500 lines (or trade-off documented in comment)
- [ ] No "When to Use This Skill" section (it's in description)
- [ ] Imperative voice throughout
- [ ] Reasoning given for non-obvious rules; no naked ALWAYS/NEVER
- [ ] Consistent terminology
- [ ] Concrete examples for every non-trivial pattern
- [ ] Gotchas section present
- [ ] Quality expectations repeated for quality-driven skills

### File organization
- [ ] References one level deep from SKILL.md
- [ ] Reference files >100 lines have a TOC
- [ ] All paths use forward slashes
- [ ] No build artifacts, node_modules, or secrets bundled

### Calibration
- [ ] Each section's freedom level matches its fragility
- [ ] Defaults provided; alternatives demoted to escape hatches
- [ ] Procedures (reusable methods) preferred over declarations

### Testing
- [ ] Three evaluations created
- [ ] Baseline run **without** skill captured (RED state)
- [ ] Verification run **with** skill captured (GREEN state)
- [ ] Tested on every model you'll deploy to (Haiku, Sonnet, Opus)
- [ ] Rationalization table updated with any new excuses observed
- [ ] At least one full Claude A / Claude B iteration completed

### Distribution
- [ ] `metadata.version` incremented per semver
- [ ] Breaking changes documented in `## Old patterns`
- [ ] License declared
- [ ] Compatibility claims accurate
- [ ] Security audit completed (for skills you'll share)

### Discipline
- [ ] No untested changes left in the file as "reference"
- [ ] No "I'll test it later" deferrals — verified GREEN before merging
- [ ] Commit message describes the failure the skill fixes, not just "added skill"

---

## §18. Quick Reference Card

### 18.1 The numbers

| Quantity | Value |
|---|---|
| `name` max length | 64 chars |
| `description` max length | 1,024 chars |
| Combined `description` + `when_to_use` cap (Claude Code listing) | 1,536 chars |
| SKILL.md body recommended max | 500 lines / 5,000 tokens |
| Reference file TOC threshold | 100 lines |
| Reference depth max | 1 level from SKILL.md |
| Tier 1 (metadata) typical cost | ~100 tokens / skill |
| Tier 2 (body) typical cost | <5,000 tokens / activation |
| MCP comparison (GitHub MCP schema) | ~50,000 tokens / session |
| CLAUDE.md target | <200 lines (60 preferred) |
| Skill threshold rule of thumb | repeated >1× / day |

### 18.2 The hard rules (memorize)

1. `name` = lowercase a-z + digits + hyphens, no leading/trailing/consecutive hyphens, ≤64 chars, matches folder.
2. `description` = third person, ≤1,024 chars, contains both **what** and **when** with concrete trigger keywords.
3. Description is the trigger — body never overrides description-driven discovery.
4. SKILL.md ≤500 lines unless deliberately documented otherwise.
5. References one level deep, with TOC if >100 lines.
6. Forward slashes in all paths.
7. Imperative voice.
8. Reasoning over rigidity.
9. No reserved words (`claude`, `anthropic`) in `name`.
10. No `@import` in SKILL.md (works only in CLAUDE.md).

### 18.3 The reflexes (apply automatically)

- Wrote ALWAYS / NEVER in caps? Reframe with reasoning.
- Listed three options? Pick one as default; demote the rest.
- Wrote "When to Use This Skill" in body? Move to description.
- Body crossing 500 lines? Split or document trade-off.
- About to ship without baseline test? Stop. Run baseline.
- Found a new agent failure? Add to gotchas.
- Skill not triggering? Description is too vague; add concrete trigger phrases.
- Skill triggers too often? Description is too broad; tighten.

### 18.4 Skill triage flowchart

```
User has a recurring problem.
  │
  ▼
Is the work repeated >1× / day?
  ├─ NO → don't write a skill yet; revisit when frequency justifies it
  └─ YES ↓
Is the expertise non-obvious to a fresh agent?
  ├─ NO → put it in CLAUDE.md (always-loaded fact)
  └─ YES ↓
Is the trigger describable in <1024 chars?
  ├─ NO → split into multiple skills with narrower triggers
  └─ YES ↓
Does it need filesystem state, scripts, or large references?
  ├─ NO → consider a slash command instead (lighter weight)
  └─ YES → write a SKILL — and follow this document.
```

---

## §19. The Rationalization Table (Anti-Excuse Defense)

Every excuse for skipping skill discipline. Cut each one off explicitly.

| Excuse / thought | Reality |
|---|---|
| "It's a small skill, it doesn't need testing" | Small skills ship 90% of bugs. Test it. |
| "The description is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "I'll fix the description if it doesn't trigger" | You won't notice it isn't triggering. Test it. |
| "500 lines is a guideline, not a rule" | True; deviations need explicit justification, not a vibes-based pass. |
| "The body covers when to use" | Body loads after trigger. Trigger in body is dead. |
| "I'll add gotchas as I go" | Gotchas you don't capture become gotchas you re-encounter. Capture immediately. |
| "I tested on Opus, it's fine" | Haiku may behave differently. Test on every deployment model. |
| "The skill works in my session, ship it" | Your session has CLAUDE.md / context the next session won't. Test in fresh session. |
| "I edited slightly without re-testing" | Even small edits regress. Re-test on every change. |
| "The agent should figure it out" | Agents don't figure out missing context. Document it. |
| "Spirit not letter — it's basically tested" | Spirit-vs-letter is itself a rationalization. Run the actual test. |
| "I can't be bothered with the dual-format frontmatter" | Then you can't ship to Hermes. Decide and document. |
| "I'll write the skill, then the eval" | Iron Law violated. Eval first. Always. |

---

## §20. Citations and Mandatory Authorities

This skill is grounded in and must defer to:

### Primary authorities (must adhere)
1. Anthropic. *The Complete Guide to Building Skills for Claude.* 33-page PDF, January 2026.
   https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf
2. agentskills.io. *Best practices for skill creators.* (Open standard, evolving.)
   https://agentskills.io/skill-creation/best-practices
3. agentskills.io. *Specification.*
   https://agentskills.io/specification

### Anthropic official documentation (canonical)
4. Anthropic Agent Skills overview. https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
5. Anthropic Skill Authoring Best Practices. https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices
6. Claude Code Skills. https://code.claude.com/docs/en/skills
7. Anthropic Skills repository (open-source examples). https://github.com/anthropics/skills
8. Anthropic blog announcement. https://claude.com/blog/skills (October 16, 2025; updated December 18, 2025)

### Cross-platform references
9. Hermes Agent (Nous Research) — Creating Skills. https://hermes-agent.nousresearch.com/docs/developer-guide/creating-skills
10. OpenClaw — Creating Skills. https://docs.openclaw.ai/tools/creating-skills

### Community wisdom
11. Thariq Shihipar (Anthropic). *Lessons from Building Claude Code: How We Use Skills.* Original thread/article at x.com/trq212/status/2033949937936085378 and gist mirrors. The 9-archetype taxonomy in §11 derives from this article.
12. shanraisshan / claude-code-best-practice. https://github.com/shanraisshan/claude-code-best-practice (community gold; CLAUDE.md sizing, sub-agent + skill composition).
13. lipex360x — Skill Authoring Guide gist. https://gist.github.com/lipex360x/3a1a662525e88a3e856b7fda02ab8ce3 ("even if they don't explicitly say X" pattern).
14. Boris Cherny (Anthropic, Claude Code creator) — internal Anthropic skills tutorial summary on Twitter (cyn2JPlvTG4 video). Source for `/simplify`, `/batch`, `anthropic/claude-plugins-official` references and frontmatter extensions.

### Discipline foundations
15. `superpowers:writing-skills` (Iron Law, RED-GREEN-REFACTOR for documentation, rationalization-table pattern).
16. `superpowers:test-driven-development` (the underlying discipline this skill imports).

> Any conflict between this document and items (1)–(3) above resolves in favor of items (1)–(3). Re-read those first if uncertain. The rest of this document distills, organizes, and operationalizes their guidance with cross-platform extensions and discipline machinery from the community sources.

---

## §21. Final Word

Skills are how you turn a generally capable agent into a *specific* one — your codebase's specialist, your domain's expert, your runbook's executor. Authoring a skill is a discipline, not a sprint.

The five non-negotiables, restated:

1. **Description is the trigger** — third person, what + when, concrete keywords.
2. **Body ≤500 lines** unless you have documented why this skill is the exception.
3. **Add what the agent doesn't know** — cut everything else.
4. **References one level deep** with TOCs over 100 lines.
5. **No skill ships without a baseline test** — RED before GREEN.

Everything else in this document is in service of those five. When in doubt, return to them.

> *"A skill is an employee, not a file."*

Treat your skills like you'd treat your best onboarding: bounded, documented, tested, refined every time you observe a failure. Future-you will thank present-you for the rigor.

— *Skillception v1.0.0 — May 2026 — zaydiscold/agent-skills*
