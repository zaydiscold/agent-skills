---
name: bird
description: Use when user shares x.com/twitter.com URLs, asks to "read tweet", "search twitter", "check mentions", "timeline", "bird", or any tweet-related actions. Read tweets, search, and browse Twitter/X timelines via bird CLI. Do NOT use for general web browsing or non-Twitter sites.
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

### Post a tweet (requires confirmation)
User: "Tweet 'Hello world'"
```
I will run: `bird tweet "Hello world"`
Proceed? (yes/no)
```

## Sequential Workflow: Execute Bird Command

CRITICAL: Follow this exact sequence with validation at each gate.

### Step 1: Resolve Executable
**Action**: Ensure `bird` CLI exists
**Validation**: `command -v bird` or check `$HOME/.local/bin/bird`
**Rollback**: Auto-install from GitHub release

```bash
if command -v bird >/dev/null 2>&1; then
  BIRD_CMD="bird"
elif [ -x "$HOME/.local/bin/bird" ]; then
  export PATH="$HOME/.local/bin:$PATH"
  BIRD_CMD="$HOME/.local/bin/bird"
else
  curl -fsSL https://github.com/zaydiscold/bird/releases/download/v0.8.0/bird -o /tmp/bird && \
    chmod +x /tmp/bird && \
    mkdir -p "$HOME/.local/bin" && \
    mv /tmp/bird "$HOME/.local/bin/bird" && \
    export PATH="$HOME/.local/bin:$PATH"
  BIRD_CMD="$HOME/.local/bin/bird"
fi
```

### Step 2: Verify CLI Health
**Action**: Run `$BIRD_CMD check --plain`
**Validation**: Output contains "Ready" or valid auth check
**Rollback**: If fails, re-run install; if still fails, report "CLI installation failed"

### Step 3: Verify Authentication
**Action**: Confirm Twitter session is valid
**Validation**: `$BIRD_CMD whoami --plain` returns `@username`
**Rollback**: Try Chrome profile fallback; if all fail, instruct user to re-auth in browser

```bash
if ! $BIRD_CMD whoami --plain 2>/dev/null | grep -q "@"; then
  for profile in "Default" "Profile 1" "Profile 2" "Profile 3"; do
    if $BIRD_CMD --chrome-profile "$profile" check --plain 2>/dev/null | grep -q "Ready"; then
      mkdir -p "$HOME/.config/bird"
      echo "{ chromeProfile: \"$profile\", cookieSource: [\"chrome\"] }" > "$HOME/.config/bird/config.json5"
      break
    fi
  done
fi
```

### Step 4: Execute User Command
**Action**: Run requested bird operation
**Validation**: Exit code 0, valid JSON/text output
**Rollback**: On error, classify per Troubleshooting and retry if appropriate

### Step 5: Present Results
**Action**: Format output for user
**Validation**: User understands the content
**Rollback**: Offer raw output if summary is unclear

## URL Normalization

CRITICAL - Validate URLs before processing:
- **Accept ONLY**: `x.com`, `twitter.com`, `mobile.twitter.com`
- **Normalize to**: `https://x.com/<path>`
- **Strip tracking**: `utm_*`, `s`, `ref`, `t` query params
- **Reject early**: Non-Twitter URLs with clear error message

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `unauthorized / 401` | Expired/missing cookies | Run `bird check`, re-auth in browser |
| `rate limit` | Too many requests | Wait 60s, retry once, then stop |
| `not found` | Deleted tweet or bad URL | Verify URL, inform user if deleted |
| `private/protected` | Account requires permission | Explain limitation, suggest following |
| `Safari vs Chrome mismatch` | Cookie source changed | Use `--chrome-profile` flag |
| `exec: bird not found` | CLI not installed | Run auto-install from Preflight |
| `error 226` | x-client-transaction-id invalid | Update to bird v0.8.0+ |

## Write-Action Confirmation Protocol

For `tweet`, `reply`, `follow`, `unbookmark`:

1. **Restate intent**: "I will run: `bird tweet \"Your text here\"`"
2. **Ask confirmation**: "Proceed? (yes/no)"
3. **Execute only on `yes`**
4. **Report result**: Show tweet URL/ID on success
5. **On `no`**: Stop, ask for revised intent

See `references/write-actions.md` for complete protocol.

## Reference Navigation

**Load only when needed** — these are detailed references, not required for basic operation:
- `references/search-operators.md` — Search syntax and filters (load if user asks for complex search)
- `references/write-actions.md` — Tweeting, replying, following (load before any write operation)
- `references/troubleshooting.md` — Detailed error remediation (load if auth or errors persist)
