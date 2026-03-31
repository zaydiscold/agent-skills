---
name: codex-orchestrator-antigravity
description: Orchestrate OpenAI Codex agents via tmux sessions from Antigravity. Use when user says "spawn codex", "codex agent", "delegate to codex", or for any multi-step coding task that benefits from parallel execution.
metadata:
  author: zaydk
  version: 1.1.0
  upstream: https://github.com/kingbootoshi/codex-orchestrator
---

# Codex Orchestrator — Antigravity Adaptation

**Adapted from** [kingbootoshi/codex-orchestrator](https://github.com/kingbootoshi/codex-orchestrator). All credit for the underlying engine, `bun`/`tmux` orchestration, and Codex integration goes to Bootoshi.

You (Antigravity) act as the strategic orchestrator. Codex agents handle the deep coding execution. You handle planning, PRDs, synthesis, and communication.

## CRITICAL: PATH Prefix

Every `codex-agent` command MUST be prefixed with the `export PATH=` block. Antigravity's `run_command` spawns fresh shell sessions that do not inherit your login shell's PATH.

```bash
# ✅ Correct — always prefix
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "do something" -s read-only
```

## Quick Start & Orchestration Loop

1. **Spawn**: Send the agent off to work. Receive the `<jobId>`.
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Investigate auth flow" -r high --map -s read-only
```

2. **Await**: Block the shell until the agent finishes its turn.
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn <jobId>
```

3. **Read**: View the raw output and status of the run.
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent status <jobId>
```

4. **Interact**: Gracefully close or ask a follow up.
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send <jobId> "/quit"
```

*Note on parallelism:* You can deploy multiple agents simultaneously by launching Step 1 repeatedly, and then `await-turn`ing all of them one by one in Step 2.

## Reference Navigation

- `references/commands.md` — Full flags reference, timing expectations, JSON schemas, and error recovery.
- `references/install.md` — Installation steps and health check.

## The Factory Pipeline

Use the factory pipeline for complex tasks. Treat the user as the final approver, and Codex as your heavy-lifting engineering team.

1. **Ideation**: You + User discuss and clarify the scope.
2. **Research**: Codex agents (`-s read-only`), parallel runs across multiple vectors.
3. **PRD**: You synthesize research and write PRD to `docs/prds/`. User approves.
4. **Implementation**: Codex agents (`-s workspace-write`).
5. **Review**: Codex agents (`-s read-only`). Look for logic errors and security bugs.
6. **Testing**: Codex agents (`-s workspace-write`).
