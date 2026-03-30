---
name: codex-orchestrator-antigravity
description: Orchestrate OpenAI Codex agents via tmux sessions from Google Gemini Antigravity. Adapted from kingbootoshi/codex-orchestrator for Antigravity's run_command tool. Use when user says "spawn codex", "codex agent", "delegate to codex", or for any multi-step coding task that benefits from parallel execution.
platform: antigravity
upstream: https://github.com/kingbootoshi/codex-orchestrator
triggers:
  - codex-orchestrator
  - spawn codex
  - use codex
  - delegate to codex
  - start agent
  - codex agent
  - codex orchestrator
---

# Codex Orchestrator — Antigravity/Gemini Adaptation

> **Adapted from** [kingbootoshi/codex-orchestrator](https://github.com/kingbootoshi/codex-orchestrator)
> Original plugin is designed for Claude Code. This adaptation makes it work in
> [Google Gemini Antigravity](https://deepmind.google/gemini/) via the skill system.

## What Changed From the Original

The original codex-orchestrator is a Claude Code plugin that:
- Uses Claude Code's built-in `Bash` tool with `run_in_background: true`
- Installs via `/plugin install codex-orchestrator`
- References `${CLAUDE_PLUGIN_ROOT}` for install scripts
- Inherits PATH from the user's persistent shell

**Antigravity differences:**
1. Uses `run_command` tool instead of Bash — each call spawns a **fresh shell session** that does NOT inherit your PATH
2. No plugin system — installs as a plain skill via `~/.agents/skills/`
3. No `${CLAUDE_PLUGIN_ROOT}` — uses hardcoded `~/.codex-orchestrator/` path
4. All slash commands replaced with skill trigger keywords

**The critical fix:** Every `codex-agent` call must be prefixed with:
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" &&
```
Without this, `codex-agent` will not be found even if installed.

---

## Overview

You (Antigravity) become the strategic orchestrator. Codex agents handle the deep coding execution.

```
USER - directs the mission
    |
    └── ANTIGRAVITY (Orchestrator / General)
            ├── CODEX agent  ← research, read-only
            ├── CODEX agent  ← implementation, workspace-write
            ├── CODEX agent  ← review, read-only
            └── CODEX agent  ← testing, workspace-write
```

**You** handle: planning, PRDs, synthesis, communication.
**Codex agents** handle: research, implementation, review, testing.

---

## Installation

### Step 1: Install the CLI

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/kingbootoshi/codex-orchestrator/main/plugins/codex-orchestrator/scripts/install.sh)
```

This installs:
- `tmux` (session manager)
- `bun` (JS runtime)
- `@openai/codex` CLI
- The `codex-agent` binary to `~/.codex-orchestrator/bin/`

### Step 2: Authenticate with OpenAI

```bash
codex --login
```

### Step 3: Install this skill

Copy `SKILL.md` into your Antigravity skills directory:

```bash
mkdir -p ~/.agents/skills/codex-orchestrator-antigravity
cp SKILL.md ~/.agents/skills/codex-orchestrator-antigravity/SKILL.md
# Antigravity also reads from:
mkdir -p ~/.gemini/antigravity/skills/codex-orchestrator-antigravity
cp SKILL.md ~/.gemini/antigravity/skills/codex-orchestrator-antigravity/SKILL.md
```

### Step 4: Health Check

```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent health
```

Expected output:
```
tmux: OK
codex: codex-cli x.x.x
Status: Ready
```

---

## CRITICAL: PATH Prefix

**Every `codex-agent` command MUST be prefixed with the PATH export.**

Antigravity's `run_command` spawns fresh shell sessions that do not inherit your login shell's PATH. Without the prefix, `codex-agent` will not be found.

```bash
# ❌ Wrong — will fail with "command not found"
codex-agent start "do something"

# ✅ Correct — always prefix
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "do something"
```

---

## Core Usage

### Spawn an Agent

```bash
# Research (read-only — safe, won't modify files)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Investigate auth flow" --map -s read-only

# Implementation (workspace-write — default)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Implement feature X" --map

# Specific model (e.g. faster/cheaper mini)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Hello world test" -m gpt-5.4-mini -r low -s workspace-write
```

### Monitor Agents

```bash
# All jobs
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent jobs

# Structured JSON (tokens, files modified, summary)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent jobs --json

# Wait for agent's current turn to complete (blocking)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn <jobId>

# Peek at recent output
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent capture <jobId> 100 --clean

# Full output
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent status <jobId>
```

### Communicate with Agents

```bash
# Send a follow-up message mid-task
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send <jobId> "Focus on the database layer"

# Close gracefully when done reading results
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send <jobId> "/quit"

# Emergency stop (last resort)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent kill <jobId>
```

---

## Standard Orchestration Loop

**Step 1: Spawn** (get the job ID)
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Your task" -r high --map -s read-only
```

**Step 2: Await** (block until agent finishes its turn)
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn <jobId>
```

**Step 3: Read + React**
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent status <jobId>
# Then either send follow-up or quit:
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send <jobId> "/quit"
```

---

## Parallel Investigation

Spawn multiple agents in one turn, await all in the next:

```bash
# Spawn all (parallel run_command calls)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Audit auth flow" --map -s read-only     # → jobA
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Review API security" --map -s read-only  # → jobB
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Check data validation" --map -s read-only # → jobC

# Await all
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn $jobA
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn $jobB
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn $jobC

# Read results, then quit each
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send $jobA "/quit"
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send $jobB "/quit"
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send $jobC "/quit"
```

---

## Flags Reference

| Flag | Short | Values | Description |
|------|-------|--------|-------------|
| `--reasoning` | `-r` | low, medium, high, xhigh | Reasoning depth |
| `--sandbox` | `-s` | read-only, workspace-write, danger-full-access | File access level |
| `--file` | `-f` | glob | Include files (repeatable) |
| `--map` | | flag | Include `docs/CODEBASE_MAP.md` |
| `--dir` | `-d` | path | Working directory for agent |
| `--model` | `-m` | string | Model override (default: gpt-5.4) |
| `--fast` | | flag | Use codex-spark (faster/cheaper) |
| `--strip-ansi` / `--clean` | | flag | Remove ANSI codes for parsing |
| `--dry-run` | | flag | Preview prompt without running |

**Defaults:** model=`gpt-5.4`, reasoning=`high`, sandbox=`workspace-write`

---

## The Factory Pipeline

```
USER'S REQUEST
     |
1. IDEATION        → You + User discuss, clarify scope
     |
2. RESEARCH        → Codex agents, read-only, parallel
     |
3. SYNTHESIS       → You filter and combine findings
     |
4. PRD             → You write to docs/prds/, user approves
     |
5. IMPLEMENTATION  → Codex agents, workspace-write
     |
6. REVIEW          → Codex agents, read-only, security + quality
     |
7. TESTING         → Codex agents, workspace-write
```

---

## Agent Timing Expectations

| Task Type | Typical Duration |
|-----------|------------------|
| Simple research | 10–20 min |
| Single feature implementation | 20–40 min |
| Complex implementation | 30–60+ min |
| Full PRD implementation | 45–90+ min |

Agents are thorough: they read the codebase deeply, reason carefully, implement with proper patterns, and self-verify. **Do not kill agents just because they're taking time.** Use `await-turn` and be patient.

---

## Codebase Map

The `--map` flag injects `docs/CODEBASE_MAP.md` into every agent prompt, giving them instant codebase understanding. Generate with [Cartographer](https://github.com/kingbootoshi/cartographer).

Without a map, agents waste time exploring. With one, they start working immediately.

---

## Jobs JSON Output

```json
{
  "id": "8abfab85",
  "status": "completed",
  "elapsed_ms": 14897,
  "tokens": {
    "input": 36581,
    "output": 282,
    "context_window": 258400,
    "context_used_pct": 14.16
  },
  "files_modified": ["src/auth.ts", "src/types.ts"],
  "summary": "Implemented the authentication flow..."
}
```

---

## Error Recovery

```bash
# Agent seems stuck — peek at output
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent capture <jobId> 100 --clean

# Redirect it
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send <jobId> "Status update — what's blocking you?"

# Kill only as last resort
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent kill <jobId>
```

---

## Credits

- Original CLI + Claude Code plugin: [kingbootoshi/codex-orchestrator](https://github.com/kingbootoshi/codex-orchestrator)
- Antigravity adaptation: [zaydiscold](https://github.com/zaydiscold)
