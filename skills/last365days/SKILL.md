---
name: last365days
description: Persistent long-term research tracker that builds dated Markdown timelines for topics/people. Use when user says "track this over time", "research timeline", "last365", "persistent profile", "save research history", or requests multi-session tracking on a topic. Do NOT use for one-off quick searches without persistence.
metadata:
  author: zaydk
  version: 1.4.0
  upstream: https://github.com/zaydk/last365days
  compatibility: "Requires Python 3.10+. Uses last30days.py as research engine."
---

# last365days: Persistent Research Tracker

Deep research with persistent storage — each topic gets a dated Markdown profile that grows over time. Builds a massive timeline showing what's new since you last checked.

## Output Location
Files saved to: `~/Desktop/last365days/` or `$LAST365DAYS_OUTPUT_DIR`

## Quick Reference

| Task | Command Pattern |
|------|-----------------|
| Research + Save | `last365days <TOPIC>` |
| List Profiles | `persist.py list` |
| Read History | `persist.py history <slug>` |
| Match Topic | `persist.py match "<topic>"` |

## Reference Navigation

Load only when needed:
- `references/file-format.md` — Profile Markdown schema and same-day deduplication logic
- `references/operations.md` — Browse, diff, export workflows (debug/advanced)

## Workflow: Iterative Research with Quality Gates

This skill uses **iterative refinement** — research quality improves with validation loops.

### Phase 1: Context Gathering
**Goal**: Load prior history (if exists) to avoid duplication

**Step 1: Parse Intent**
- If no topic → `persist.py list` → stop
- If topic → `persist.py match "<topic>"`

| Match | Action |
|-------|--------|
| `exact`/`high` | Load history → proceed to Phase 2 |
| `medium` | Ask user: append to `<slug>` or create new? |
| `none` | Create new profile → Phase 2 |

**Validation Gate**: Confirm profile selection with user before proceeding

### Phase 2: Research Execution
**Goal**: Gather comprehensive data

**Step 2: Resolve X Handle** (if applicable)
- Quick WebSearch for `{TOPIC} twitter x.com`
- If verified handle found, pass `--x-handle=<handle>`

**Step 3: Run last30days Engine**
```bash
LAST30DAYS_OUTPUT_DIR="${LAST365DAYS_OUTPUT_DIR:-$HOME/.local/share/last365days/out}" \
python3 "${CLAUDE_SKILL_DIR}/scripts/last30days.py" "<TOPIC>" \
  --emit=compact --no-native-web \
  ${X_HANDLE:+--x-handle="$X_HANDLE"} \
  ${DAYS:+--days="$DAYS"} \
  ${QUICK:+--quick} \
  ${DEEP:+--deep}
```

**Validation Gate**: Check exit code 0, output not empty
**Rollback**: If script fails, run with `--quick` flag; if still fails, report error and stop

**Step 4: WebSearch Supplement**
Target: `recommendations`, `news`, `announcements`, `release`
Exclude: `x.com`, `reddit.com` (already covered)

### Phase 3: Quality Check Loop
**Goal**: Ensure synthesis meets quality threshold

**Initial Quality Criteria**:
- [ ] At least 3 distinct findings
- [ ] At least 2 cross-platform patterns
- [ ] Source diversity (not all from same site)
- [ ] Novel information (not duplicate of prior history)

**If quality < threshold**:
1. Identify gaps ("only 2 findings, need more")
2. Run targeted WebSearch on missing angles
3. Re-synthesize
4. Re-validate
5. **Max 3 iterations** — stop if quality doesn't improve

### Phase 4: Synthesis & Presentation
Structure:
1. **What changed since {last_date}** (if prior history)
2. **What I learned** (3-6 findings)
3. **Key patterns** (2-4 cross-platform themes)
4. **Source stats** (auto-read from `report.json`)

### Phase 5: Persist Results
**Goal**: Save to profile with metadata

```bash
cat << 'SYNTHESIS_EOF' | python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py append "<SLUG>" --title "<Display Name>"
<YOUR SYNTHESIS HERE>

## Key Findings
1. ...
2. ...

## Patterns
1. ...
2. ...
SYNTHESIS_EOF
```

**Validation Gate**: Verify file was written (`persist.py read <slug>`)
**Rollback**: If persist fails, output synthesis to user anyway with note
## Examples

### Track a company over time
User: `research Anthropic and save it`
```bash
# Step 1: Match topic
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py match "Anthropic"
# Result: exact match found → loading Anthropic.md history

# Step 2: Run research with last30days
LAST30DAYS_OUTPUT_DIR="${LAST365DAYS_OUTPUT_DIR:-$HOME/.local/share/last365days/out}" \
python3 "${CLAUDE_SKILL_DIR}/scripts/last30days.py" "Anthropic" --emit=compact --no-native-web

# Step 3: Synthesize and append
cat << 'EOF' | python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py append "anthropic" --title "Anthropic"
## 2025-04-07 Research Update

### What Changed Since 2025-03-15
- New: Claude 3.7 Sonnet released with extended thinking
- Update: Computer use API now generally available

### Key Findings
1. Launched "research mode" with 64k token extended thinking
2. MCP protocol adoption accelerating across AI tools
3. New pricing tiers for high-volume API users

### Patterns
- Release cycle accelerating (quarterly major updates)
- Developer tooling prioritized over consumer features
EOF

# Output to user: "Updated anthropic.md — 4 new findings since March 15"
```

### Research a person
User: `track research on Simon Willison`
```bash
# Match: "simon-willison" not found → creating new profile

# Run research
python3 "${CLAUDE_SKILL_DIR}/scripts/last30days.py" "Simon Willison" --emit=compact

# Create profile
cat << 'EOF' | python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py append "simon-willison" --title "Simon Willison"
## 2025-04-07 — First Research

### Key Findings
1. Released datasette-lite 0.3 with WASM improvements
2. Blogging about LLM tokenization edge cases
3. New tool: llm-fragments for context window management

### Patterns
- Consistent weekly blog posts on niche technical topics
- Tools focused on data exploration and LLM interaction
EOF

# Output: "Created simon-willison.md — will track updates over time"
```

### List what you're tracking
User: `what topics am I tracking?`
```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py list

# Output:
# 1. anthropic — Last updated: 2025-04-07 (5 entries total)
# 2. simon-willison — Last updated: 2025-04-07 (1 entry)
# 3. openai — Last updated: 2025-03-28 (3 entries total)
```

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `No such file` | persist.py not found | Check `${CLAUDE_SKILL_DIR}` is set |
| `report.json not found` | last30days failed | Check script output, retry |
| Same-day duplicate | Running twice in one day | persist.py auto-deduplicates same-day entries |
| Empty synthesis | No new findings | Report "No significant changes since last check" |

## Next Steps Pattern
After presenting, offer 2-3 specific actions:
1. Suggest comparing changes since earliest date (if history exists)
2. Recommend related topics to track
3. Offer to set up monitoring/alerts
