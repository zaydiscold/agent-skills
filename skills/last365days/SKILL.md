---
name: last365days
description: Use when the user requests long-term tracking, a research timeline, a persistent profile, or invokes last365 for a person/topic to save structured history.
metadata:
  author: zaydk
  version: 1.2.2
---

# last365days: Persistent Research Tracker

Deep research identical to `last30days` — but saved to a persistent, dated Markdown file per profile. Over time, it builds a massive timeline summarizing what's new.

Files saved to: `~/Desktop/last365days/`

## Quick Start
1. User: `last365days Anthropic`
2. Parse intent and match `Anthropic.md`.
3. Run `last30days.py "Anthropic"` to generate report.
4. Supplement with WebSearch.
5. Pipe synthesized key patterns into `persist.py append`.

## Reference Navigation
- `references/file-format.md` — Profile Markdown schema and same-day logic
- `references/operations.md` — Browse, diff, export, or debug workflows (do not read during normal research)

## Parse Intent & Check History

**If no topic provided**, list existing profiles and stop:
```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py list
```

**If topic provided**, match it against history:
```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py match "<RAW_TOPIC>"
```
- `"exact" / "high"`: Use profile. "Found existing profile. Appending."
- `"medium"`: Read it using `persist.py read "<slug>"`. Ask user to confirm appending or create new.
- `No matches`: Create new.

If history exists, load context:
```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py history "<slug>"
```

## Resolve X Handle
Do a quick WebSearch: `{TOPIC} X twitter handle site:x.com`. If verified, pass as `--x-handle={handle}`.

## Run Research Engine
Run the `last30days` script wrapper:
```bash
LAST30DAYS_OUTPUT_DIR="${LAST365DAYS_OUTPUT_DIR:-$HOME/.local/share/last365days/out}" \
python3 "${CLAUDE_SKILL_DIR}/scripts/last30days.py" "<TOPIC>" --emit=compact --no-native-web
```
Pass flags if requested: `--days=N`, `--quick`, `--deep`, `--x-handle=HANDLE`.
Read the entire output.

## WebSearch Supplement
Supplement the script output with focused Web Search targeting `recommendations`, `news`, or `prompting` keywords. Exclude x.com/reddit.com.

## Synthesis & Presentation
Present findings to the user.
- **What changed since {last_date}** (if history exists)
- **What I learned** (3-6 findings)
- **Key patterns** (2-4 cross-platform themes)
- **Source stats**

## Persist Results
Save your `What I learned` and `Key patterns` synthesis to the profile:
```bash
cat << 'SYNTHESIS_EOF' | python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py append "<SLUG>" --title "<Display Name>"
YOUR FULL SYNTHESIS TEXT HERE
SYNTHESIS_EOF
```
*Note: persist.py automatically reads source stats from `report.json`.*

## Next Steps
Offer 2-3 specific suggestions based on the topic. If history exists, suggest comparing changes since the earliest date.
