---
name: bird
description: Read tweets, search, and browse Twitter/X timelines via bird CLI. Use when user shares x.com/twitter.com URLs, asks to "read tweet", "search twitter", "check mentions", "timeline", "bird", or any tweet-related actions. Do NOT use for general web browsing or non-Twitter sites.
metadata:
  author: zaydk
  version: 1.2.0
  upstream: https://github.com/zaydiscold/bird
  compatibility: "Requires bird CLI 0.8.0+. macOS/Linux with Safari or Chrome cookies."
---

# Bird — Twitter/X CLI

Read tweets, search, and browse timelines directly via `bird` CLI using Bash. All commands use deterministic execution with explicit confirmation for write operations.

## Quick Reference

| Action | Command |
| ------ | ------- |
| Read Tweet | `bird read <url>` |
| Read Thread | `bird thread <url>` |
| Search | `bird search "query" -n 12` |
| Mentions | `bird mentions` |
| Feed | `bird home` |
| User Timeline | `bird user @handle` |

## Reference Navigation

For detailed documentation, consult (only load when needed):
- `references/search-operators.md` — Search syntax and filters
- `references/write-actions.md` — Tweeting, replying, and following (confirmation required)
- `references/troubleshooting.md` — Error remediation and auth issues

## Core Behavior

- **ALWAYS use `bird` CLI directly** with Bash/terminal. Do NOT use browser tools or WebFetch for Twitter content.
- Keep behavior deterministic: run one command, report output.
- Prefer concise summaries unless raw output explicitly requested.
- **NEVER fabricate tweet content**. Only report exactly what `bird` returns.
- Write actions (`tweet`, `reply`, `follow`, `unbookmark`) require explicit user confirmation per `references/write-actions.md`.

## Preflight & Auth Gating

CRITICAL: Run this sequence before the first bird command each turn:

### 1. Resolve bird executable
```bash
if command -v bird >/dev/null 2>&1; then
  BIRD_CMD="bird"
elif [ -x "$HOME/.local/bin/bird" ]; then
  export PATH="$HOME/.local/bin:$PATH"
  BIRD_CMD="$HOME/.local/bin/bird"
else
  # Auto-install if missing
  curl -fsSL https://github.com/zaydiscold/bird/releases/download/v0.8.0/bird -o /tmp/bird && \
    chmod +x /tmp/bird && \
    mkdir -p "$HOME/.local/bin" && \
    mv /tmp/bird "$HOME/.local/bin/bird" && \
    export PATH="$HOME/.local/bin:$PATH"
  BIRD_CMD="$HOME/.local/bin/bird"
fi
```

### 2. Verify CLI and Auth
```bash
# Check CLI health
$BIRD_CMD check --plain

# Verify auth (Safari preferred, Chrome fallback)
if ! $BIRD_CMD whoami --plain 2>/dev/null | grep -q "@"; then
  # Try Chrome profiles if Safari fails
  for profile in "Default" "Profile 1" "Profile 2" "Profile 3"; do
    if $BIRD_CMD --chrome-profile "$profile" check --plain 2>/dev/null | grep -q "Ready"; then
      mkdir -p "$HOME/.config/bird"
      echo "{ chromeProfile: \"$profile\", cookieSource: [\"chrome\"] }" > "$HOME/.config/bird/config.json5"
      break
    fi
  done
fi
```

## URL Normalization

CRITICAL - Validate URLs before processing:
- **Accept ONLY**: `x.com`, `twitter.com`, `mobile.twitter.com`
- **Normalize to**: `https://x.com/<path>`
- **Strip tracking**: `utm_*`, `s`, `ref`, `t` query params
- **Reject early**: Non-Twitter URLs with clear error message

## Examples

### Read a tweet
User: "Check this tweet https://x.com/elonmusk/status/123456"
```bash
bird read "https://x.com/elonmusk/status/123456"
```

### Search with operators
User: "Search twitter for AI announcements from OpenAI this week"
```bash
bird search "from:OpenAI AI announcement since:2025-04-01" -n 15
```
*See `references/search-operators.md` for full query syntax*

### Read full thread
User: "Show me the whole thread"
```bash
bird thread "https://x.com/handle/status/123456"
```

### Check mentions
User: "Do I have any twitter notifications?"
```bash
bird mentions -n 10
```

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `unauthorized / 401` | Expired/missing cookies | Run `bird check`, re-auth in browser |
| `rate limit` | Too many requests | Wait 60s, retry once, then stop |
| `not found` | Deleted tweet or bad URL | Verify URL, inform user if deleted |
| `private/protected` | Account requires permission | Explain limitation, suggest following |
| `Safari vs Chrome mismatch` | Cookie source changed | Use `--chrome-profile` flag |
| `exec: bird not found` | CLI not installed | Run auto-install from Preflight |

## Write-Action Confirmation Protocol

For `tweet`, `reply`, `follow`, `unbookmark`:

1. **Restate intent**: "I will run: `bird tweet \"Your text here\"`"
2. **Ask confirmation**: "Proceed? (yes/no)"
3. **Execute only on `yes`**
4. **Report result**: Show tweet URL/ID on success
5. **On `no`**: Stop, ask for revised intent

See `references/write-actions.md` for complete protocol.
