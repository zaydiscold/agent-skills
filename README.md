# Personal AI Agent Skills Catalog

A canonical source of truth for my personal AI agent skills. This is a **Monorepo Catalog** designed for one-click installation across all agent environments (Google Gemini Antigravity, Claude Code, Cursor/Cline).

All skills follow the [Anthropic Skill Authoring Guidelines](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/skills) (Conciseness, Progressive Disclosure, Exacting Triggers).

## Available Skills

| Skill | Description | Upstream Source |
|-------|-------------|-----------------|
| **`bird`** | Twitter/X CLI integration. Read timelines, search, and safely execute write actions with preflight Safari auth fallbacks. | [bird-skill](https://github.com/zaydiscold/bird-skill) |
| **`last365days`** | A persistent research tracker. Searches Reddit, X, YouTube, TikTok, Polymarket, and the web, and compiles a running historical timeline per topic. | [last365days-skill](https://github.com/zaydiscold/last365days-skill) |
| **`nasa-coding-standards`** | Complete auditor and auto-refactor agent for NASA JPL's "Power of 10" safety-critical coding rules (supports C/C++ and interpreted languages). | [nasa-coding-standards-skill](https://github.com/zaydiscold/nasa-coding-standards-skill) |
| **`codex-orchestrator-antigravity`** | Antigravity wrapper for `codex-orchestrator`. Spawns parallel Codex read/write agents via tmux to handle entire product pipelines. | [codex-orchestrator-antigravity-skill](https://github.com/zaydiscold/codex-orchestrator-antigravity-skill) |

## Quick Install across all platforms

Clone this repo once, and the included script will symlink the entire catalog to all 3 agent platforms simultaneously.

```bash
git clone https://github.com/zaydiscold/agent-skills.git ~/Desktop/agent-skills
cd ~/Desktop/agent-skills
bash docs/install-skills.txt
```

This will automatically link to:
- `~/.agents/skills/` (Base tracking for Cursor)
- `~/.claude/skills/` (Claude Code)
- `~/.gemini/antigravity/skills/` (Google Gemini Antigravity)

## Why a Monorepo?

While skills are individually developed and maintained in their standalone Repositories (for clean independent sharing), they are aggregated here. This ensures that a new Macbook can instantly inherit all intelligence capabilities via a single git clone.
