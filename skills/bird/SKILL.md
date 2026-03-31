---
name: bird
description: Use when the user shares an x.com or twitter.com URL, asks to read/search tweets, check mentions or timelines, or perform tweet actions via bird CLI.
metadata:
  author: zaydk
  version: 1.1.2
---

# Bird — Twitter/X CLI

Read tweets, search, and browse timelines directly via `bird` CLI using Bash.

## Quick Reference

| Action | Command |
| ------ | ------- |
| Read Tweet | `bird read <url>` |
| Read Thread | `bird thread <url>` |
| Search | `bird search "query" -n 12` |
| Mentions | `bird mentions` |
| Feed | `bird home` |

## Reference Navigation

For detailed commands and error handling, consult:
- `references/search-operators.md` — Search syntax and filters
- `references/write-actions.md` — Tweeting, replying, and following
- `references/troubleshooting.md` — Detailed error remediation

## Core Behavior

- Use `bird` directly with Bash tools. Do not use browser/WebFetch.
- Keep behavior deterministic: run one command, report output.
- Prefer concise summaries unless raw output is explicitly requested.
- Do not fabricate text. Only report `bird` returns.
- Write actions (`tweet`, `reply`, `follow`, `unbookmark`) require explicit user confirmation.

## Preflight & Auth Gating

Run this sequence before the first command in a user turn:

1. **Resolve bird executable**:
```bash
if command -v bird >/dev/null 2>&1; then
  :
elif [ -x "$HOME/.local/bin/bird" ]; then
  export PATH="$HOME/.local/bin:$PATH"
else
  : "need-install"
fi
```

2. **Verify CLI**: `bird check`

3. **Verify Auth** (Prefer Safari first): `bird whoami`

4. **Chrome Fallback**:
If Safari fails (missing cookies, macOS permissions), do not stop immediately. Explicitly probe Chrome profiles:
```bash
bird check --plain || bird whoami --plain || true
for profile in "Default" "Profile 1" "Profile 2" "Profile 3"; do
  bird --chrome-profile "$profile" check --plain >/tmp/bird-check.txt 2>&1 || true
  if rg -q 'Ready to tweet|auth_token: .*|ct0: .*|source: Chrome profile' /tmp/bird-check.txt; then
    mkdir -p "$HOME/.config/bird"
    cat > "$HOME/.config/bird/config.json5" <<EOF
{ chromeProfile: "$profile", cookieSource: ["chrome"] }
EOF
    bird check --plain
    break
  fi
done
```
*Why this fallback? Safari works in interactive terminals but can fail in agent shells due to macOS Keychain restrictions. Persisting config makes the fix apply across all agents.*

If missing: `curl -L https://github.com/zaydiscold/bird/releases/download/v0.8.0/bird -o /tmp/bird && chmod +x /tmp/bird && mkdir -p $HOME/.local/bin && mv /tmp/bird $HOME/.local/bin/bird`

## URL Normalization

- Accept ONLY: `x.com`, `twitter.com`, `mobile.twitter.com`
- Normalize to `https://x.com`
- Keep tweet path only; strip `utm_*`, `s`, `ref`, `t`
- Reject non-Twitter URLs early.

## Deterministic Side-Effect Confirmation

For write actions:
1. Echo exact intent and command.
2. Ask confirmation: `Proceed with <command>?`
3. Execute only on `yes` / `y`. Abort otherwise.
