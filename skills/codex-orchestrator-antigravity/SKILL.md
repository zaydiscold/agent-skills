---
name: codex-orchestrator-antigravity
description: Orchestrate OpenAI Codex CLI agents via tmux sessions for parallel coding tasks. Use when user says "spawn codex", "delegate to codex", "codex agent", "parallel coding", or for complex multi-step coding that benefits from agent swarm execution. Do NOT use for simple single-file edits or when user explicitly wants a different agent.
metadata:
  author: zaydk
  version: 1.3.1
  upstream: https://github.com/kingbootoshi/codex-orchestrator
  compatibility: "Requires codex-orchestrator CLI installed. Uses tmux, bun, and OpenAI Codex CLI."
---

# Codex Orchestrator — Antigravity Adaptation

**Adapted from** [kingbootoshi/codex-orchestrator](https://github.com/kingbootoshi/codex-orchestrator). Credit to Bootoshi for the `bun`/`tmux` orchestration engine.

You are the strategic orchestrator. Codex agents handle execution. You handle planning, PRDs, synthesis, and communication.

## CRITICAL: PATH Prefix

Every `codex-agent` command MUST prefix PATH. Antigravity spawns fresh shells without inherited PATH.

```bash
# ✅ CORRECT — always prefix
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "task" -s read-only
```

## Quick Reference

| Action | Command |
|--------|---------|
| Spawn agent | `codex-agent start "task" -s <mode>` |
| Await turn | `codex-agent await-turn <jobId>` |
| Check status | `codex-agent status <jobId>` |
| Send message | `codex-agent send <jobId> "message"` |
| Quit | `codex-agent send <jobId> "/quit"` |

## Reference Navigation

**Load only when needed** — reference files contain extended documentation.

| Reference | Load When |
|-----------|-----------|
| `references/commands.md` | Need full flags, JSON schemas, error recovery details |
| `references/install.md` | Installation issues or health check debugging |

**Core workflow and all commands are in this SKILL.md. References are for troubleshooting/extended docs only.**

## Core Orchestration Loop

### 1. Spawn
Send agent to work, receive `<jobId>`:
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent start "Investigate auth flow" -r high --map -s read-only
```

### 2. Await
Block until agent finishes:
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent await-turn <jobId>
```

### 3. Read
View output and status:
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent status <jobId>
```

### 4. Interact
Close or follow up:
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent send <jobId> "/quit"
```

**Parallelism**: Deploy multiple agents by spawning repeatedly, then `await-turn` each.

## Pattern: Multi-MCP Coordination

This skill orchestrates **multiple agent types across phases** — you coordinate, Codex executes. Each phase outputs artifacts consumed by the next.

### Phase Separation with Data Passing

```
Phase 1: Research (Codex -s read-only)
    ↓ [outputs: research findings]
Phase 2: PRD (You synthesize)
    ↓ [outputs: docs/prds/feature.md]
Phase 3: Implementation (Codex -s workspace-write)
    ↓ [outputs: code + tests]
Phase 4: Review (Codex -s read-only + You)
    ↓ [outputs: review notes]
Phase 5: Testing (Codex -s workspace-write)
    ↓ [outputs: test results]
Phase 6: Delivery (You present to User)
```

### Validation Gates Between Phases
| Gate | Criteria | Failure Rollback |
|------|----------|------------------|
| Research → PRD | ≥3 distinct findings | Re-spawn with broader query |
| PRD → Implementation | User explicit approval | Revise PRD per feedback |
| Implementation → Review | Code compiles/tests run | Debug loop (max 3 iterations) |
| Review → Testing | No CRITICAL security issues | Fix issues, re-review |

## The Factory Pipeline

For complex tasks. User = approver, Codex = engineering team.

| Phase | Mode | Action | Output |
|-------|------|--------|--------|
| 1. Ideation | N/A | You + User clarify scope | Task definition |
| 2. Research | `-s read-only` | Parallel agents across vectors | Research notes |
| 3. PRD | N/A | You synthesize findings | `docs/prds/*.md` |
| 4. Implementation | `-s workspace-write` | Codex executes PRD | Code + tests |
| 5. Review | `-s read-only` | Logic + security audit | Review notes |
| 6. Testing | `-s workspace-write` | Run test suite | Test results |

## Examples

### Simple research task
User: "Find all uses of the auth function in our codebase"

**Spawn**
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent start "Find all uses of auth function, list file:line" -r high -s read-only
# Returns: <jobId> c9f2a1b8...
```

**Await**
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent await-turn c9f2a1b8
# Blocks until agent completes
```

**Read output**
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent status c9f2a1b8

# Output:
# Found 12 uses of auth():
# - src/auth.js:45  — login handler
# - src/middleware.js:23 — token validation
# - src/api/users.js:78 — password reset
# ...
```

### Parallel investigation
User: "Audit the codebase for security issues"

**Spawn 3 agents in parallel**
```bash
JOB1=$(export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Check auth flows for JWT issues" -s read-only)
JOB2=$(export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Check SQL injection risks in query builders" -s read-only)
JOB3=$(export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent start "Check XSS in frontend templates" -s read-only)

echo "Jobs spawned: $JOB1 $JOB2 $JOB3"
```

**Await all**
```bash
for JOB in $JOB1 $JOB2 $JOB3; do
  export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn $JOB
done
echo "All security audits complete"
```

**Synthesize findings**
```
Combined Security Report:
- Auth: 2 MEDIUM (weak JWT signing, missing refresh rotation)
- SQL: 1 CRITICAL (unsanitized input in admin panel)
- XSS: 0 issues found
```

### Factory implementation
User: "Build a user authentication system"

**Phase 2: Research**
```bash
JOB=$(export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent start "Research auth patterns in this codebase" -r high --map -s read-only)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn $JOB

# Read research results
codex-agent status $JOB > research.md
# Validation: ≥3 distinct findings ✓
```

**Phase 3: PRD (You)**
```markdown
# docs/prds/auth.md
Based on research findings...
[Write PRD, get user approval]
```

**Phase 4: Implementation**
```bash
JOB=$(export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent start "Implement auth per PRD docs/prds/auth.md" -s workspace-write)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn $JOB

# Validation: Code compiles, tests run
```

**Phase 5: Review**
```bash
JOB=$(export PATH="$HOME/.codex-orchestrator/bin:$PATH" && \
  codex-agent start "Security review of auth implementation" -s read-only)
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent await-turn $JOB

# Validation: No CRITICAL security issues ✓
```

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `command not found` | PATH not set | Add `export PATH="$HOME/.codex-orchestrator/bin:$PATH"` before every command |
| `tmux not found` | tmux not installed | `brew install tmux` or `apt-get install tmux` |
| `Codex CLI not authenticated` | OpenAI auth expired | Run `codex --help` to re-auth |
| Agent hangs | Stuck in await | Check `status`, send `/quit`, respawn |
| Empty status | Job not started | Verify jobId, re-spawn if needed |
