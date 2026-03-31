# Codex Orchestrator Commands & Reference

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
| `--strip-ansi` | `--clean` | flag | Remove ANSI codes for parsing |
| `--dry-run` | | flag | Preview prompt without running |

**Defaults:** `model=gpt-5.4`, `reasoning=high`, `sandbox=workspace-write`

## Agent Timing Expectations
| Task Type | Typical Duration |
|-----------|------------------|
| Simple research | 10–20 min |
| Single feature impl | 20–40 min |
| Complex impl | 30–60+ min |
| Full PRD impl | 45–90+ min |

Agents are thorough: they read the codebase deeply, implement, and self-verify. **Do not kill agents because they take time.** Use `await-turn` and wait patiently.

## Jobs JSON Output
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent jobs --json
```
```json
{
  "id": "8abfab85",
  "status": "completed",
  "elapsed_ms": 14897,
  "tokens": { "input": 36581, "output": 282 },
  "files_modified": ["src/auth.ts"],
  "summary": "Implemented..."
}
```

## Error Recovery
If an agent seems stuck or hangs:
```bash
# Reveal the last 100 lines of output to debug
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent capture <jobId> 100 --clean

# Send manual prompt to redirect the agent
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent send <jobId> "Status update — what's blocking you?"

# Kill ONLY as a last resort
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent kill <jobId>
```
