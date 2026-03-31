# Codex Orchestrator Installation

Perform this manual pre-flight check if `codex-agent` is absolutely not launching.

## 1. Install CLI
Installs `bun`, `tmux`, the `@openai/codex` CLI, and configures everything.
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/kingbootoshi/codex-orchestrator/main/plugins/codex-orchestrator/scripts/install.sh)
```

## 2. Authenticate
```bash
codex --login
```

## 3. Health Check
```bash
export PATH="$HOME/.codex-orchestrator/bin:$PATH" && codex-agent health
```
Expected output:
```
tmux: OK
codex: codex-cli x.x.x
Status: Ready
```
