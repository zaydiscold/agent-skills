# Agent Skills Catalog

A single source of truth for my personal AI agent skills — one repo, one folder per skill, installable anywhere.

Every skill lives in [`skills/`](./skills) as a self-contained folder with its own `SKILL.md`, and follows the [Anthropic Skill Authoring Guidelines](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/skills) (conciseness, progressive disclosure, exacting triggers). Works across Claude Code, Cursor/Cline, and Google Gemini Antigravity.

## Available skills

| Skill | What it does | Upstream |
|-------|--------------|----------|
| [`bird`](./skills/bird) | Read, search, and browse Twitter/X from any agent via the `bird` CLI — paste an x.com link and it reads it directly. | [bird-skill](https://github.com/zaydiscold/bird-skill) |
| [`codex-orchestrator-antigravity`](./skills/codex-orchestrator-antigravity) | Orchestrate parallel OpenAI Codex CLI agents over tmux for multi-step coding pipelines and agent-swarm execution. | [codex-orchestrator-antigravity-skill](https://github.com/zaydiscold/codex-orchestrator-antigravity-skill) |
| [`critique`](./skills/critique) | Multi-perspective critique of anything in any scope — spawns independent critic agents (code-autist, security, PM/delivery, adversarial red-team, design, logician, editor, pre-mortem…), each writes a structured report, then synthesizes consensus-vs-tension into one verdict: add / remove / change / keep. | _original_ |
| [`electron-app-development`](./skills/electron-app-development) | End-to-end Electron desktop expertise — architecture, security (contextBridge/IPC/fuses), packaging, code signing, notarization, and auto-update across mac/Windows/Linux. | _original_ |
| [`hermes-memory-optimization`](./skills/hermes-memory-optimization) | Tighten Hermes agent memory (`MEMORY.md` / `USER.md`) through signal-vs-noise analysis and structured user interviews. | _original_ |
| [`jane-street-house-style`](./skills/jane-street-house-style) | Audit and refactor code to Jane Street's house style — correctness-by-types, "make illegal states unrepresentable", errors-as-values, brevity. Literal OCaml rules (Base/Core, `.mli`, `[@@deriving]`, `ppx_js_style`, ocamlformat) with a `/jane` command; ported principles for TS/Rust/Python/Go. | _original_ |
| [`last365days`](./skills/last365days) | Persistent long-term research tracker — builds dated Markdown timelines per topic/person across Reddit, X, YouTube, TikTok, Polymarket, and the web. | [last365days-skill](https://github.com/zaydiscold/last365days-skill) |
| [`nasa-coding-standards`](./skills/nasa-coding-standards) | Audit and auto-refactor code against NASA JPL's "Power of 10" safety-critical rules (C/C++, Python, JS, TS, Go). | [nasa-coding-standards-skill](https://github.com/zaydiscold/nasa-coding-standards-skill) |
| [`skillception`](./skills/skillception) | The meta-skill — author, refactor, and audit agent skills (Claude Code, Agent SDK, Codex, Cursor, Antigravity, Hermes) the right way. | _original_ |

## Install

### Option A — `npx skills` (zero setup, recommended)

Add the whole catalog to every agent on your machine:

```bash
npx skills add zaydiscold/agent-skills --all
```

…or just one skill:

```bash
npx skills add zaydiscold/agent-skills --skill bird
```

### Option B — clone + symlink

Clone once and let the installer symlink every skill into whichever agent
directories you already have. Symlinks mean a future `git pull` updates every
agent at once.

```bash
git clone https://github.com/zaydiscold/agent-skills.git
cd agent-skills
bash install.sh
```

`install.sh` flags:

| Command | Targets |
|---------|---------|
| `bash install.sh` | every agent dir that already exists |
| `bash install.sh --claude` | Claude Code (`~/.claude/skills`) |
| `bash install.sh --cursor` | Cursor / base (`~/.agents/skills`) |
| `bash install.sh --antigravity` | Gemini Antigravity (`~/.gemini/antigravity/skills`) |
| `bash install.sh --all` | creates + links into all three |

Re-running is safe: existing symlinks are refreshed, and real directories you
placed yourself are never overwritten.

## Repo layout

```
agent-skills/
├── skills/
│   ├── bird/                          SKILL.md + references/
│   ├── codex-orchestrator-antigravity/
│   ├── critique/                       SKILL.md + references/
│   ├── electron-app-development/
│   ├── hermes-memory-optimization/
│   ├── jane-street-house-style/       SKILL.md + references/ + /jane command
│   ├── last365days/
│   ├── nasa-coding-standards/
│   └── skillception/
├── install.sh                         symlink installer
├── ideas.md                           skill backlog
└── README.md
```

Every skill folder is independently valid: drop any one of them into a
`skills/` directory on its own and it works.

## Why a monorepo?

Several of these skills are also maintained as standalone repos (see the
**Upstream** column) for clean, independent sharing. Aggregating them here means
a fresh machine inherits the entire toolkit from a single `git clone` — and a
single `git pull` keeps every agent in sync.
