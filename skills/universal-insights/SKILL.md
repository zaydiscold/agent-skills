---
name: universal-insights
description: Generate cross-agent analytics and insights reports from AI coding sessions. Use when user says "/insights", "analyze my agent usage", "claude stats", "cursor insights", or requests analytics on their AI coding patterns across Claude Code, Cursor, Codex, Gemini, or Antigravity.
metadata:
  author: zaydk
  version: 1.2.0
  upstream: https://github.com/zaydk/universal-insights
  compatibility: "Node.js 18+ required. Reads from ~/.claude, ~/.cursor, ~/.codex, ~/.gemini directories."
---

# Universal Insights — Cross-Agent Analytics

Analyze AI coding sessions across multiple agents (Claude Code, Cursor, OpenAI Codex, Gemini, Antigravity) and generate personalized insights reports with actionable recommendations.

## Quick Reference

| Command | Action |
|---------|--------|
| `/insights` | Analyze all agents, HTML report |
| `/insights --agent claude` | Analyze specific agent |
| `/insights --days 7` | Last 7 days only |
| `/insights --format md` | Markdown output |
| `/insights --output ~/path.html` | Save to file |

## Problem-First Framing

This skill is **problem-first**: User describes outcome ("analyze my coding patterns"), skill handles the tools (adapters, AI extraction, report generation). Users never specify which adapter to use — you select based on their request.

## Reference Navigation

**Load only when needed** — reference files contain extended documentation.

| Reference | Load When |
|-----------|-----------|
| `references/adapters.md` | Debugging session parsing issues, adding new agent support |
| `reports/` | Need example output formats for reference |
| `src/` | Debugging generator implementation |

**Core workflow is in this SKILL.md. References are for debugging/development only.**

## Sequential Workflow: Generate Insights Report

CRITICAL: Follow this exact sequence with validation at each gate.

### Step 1: Parse User Intent
**Action**: Determine report scope from user input
**Validation**: Identify agent target, time range, and output format
**Rollback**: Ask clarifying question if intent ambiguous

| User Says | Agent | Time | Format |
|-----------|-------|------|--------|
| "/insights" or "analyze my agent usage" | All | Default (30d) | HTML |
| "just my claude stats" | Claude | Default | Markdown |
| "weekly summary in markdown" | All | 7 days | Markdown |
| "compare all my AI tools" | All (parallel) | Default | HTML |

### Step 2: Select Generator
**Action**: Choose correct report generator based on agent
**Validation**: Generator file exists and is executable
**Rollback**: Report "Generator not found" and stop

```bash
# Generator mapping
CLAUDE → generate-claude-report.cjs
CURSOR → generate-cursor-insights.cjs
CODEX → generate-codex-report.cjs
GEMINI → generate-gemini-report.cjs
```

### Step 3: Execute Report Generation
**Action**: Run generator with parsed arguments
**Validation**: Exit code 0 AND output file created
**Rollback**: Check error message, retry once with `--format md` if HTML fails

```bash
cd ~/Desktop/agent-skills/universal-insights
node generate-claude-report.cjs --format html --output ~/Desktop/insights-$(date +%Y%m%d).html
```

### Step 4: Verify Output
**Action**: Confirm report file exists and has content
**Validation**: File size > 1KB AND contains expected sections
**Rollback**: If verification fails, re-run with `--format md` as fallback

```bash
ls -lh ~/Desktop/insights-*.html
head -50 ~/Desktop/insights-*.html | grep -q "At a Glance"
```

### Step 5: Present Results
**Action**: Summarize findings and provide file path
**Validation**: User can access file path
**Rollback**: If path issue, move to `~/Desktop/` and re-report

## Report Generation Details

### Data Collection Process

Each report generator performs:
1. Discovers agent session files from known paths
2. Runs adapter to normalize session data
3. Extracts semantic facets via AI (cached)
4. Aggregates cross-session metrics

Known session paths:
| Agent | Path |
|-------|------|
| Claude Code | `~/.claude/projects/*/*.jsonl` |
| Cursor | `~/.cursor/chats/*/*/store.db` |
| Codex | `~/.codex/history.jsonl` |
| Gemini | `~/.gemini/tmp/*/chats/session-*.json` |
| Antigravity | `~/.gemini/antigravity/conversations/*.pb` |

### Facet Extraction

For each session, AI extracts:
- `underlying_goal` — What user wanted
- `goal_categories` — Task types (counted)
- `outcome` — achieved/mostly/partially/not
- `user_satisfaction` — happy/satisfied/frustrated
- `friction_counts` — Error types encountered
- `agent_helpfulness` — Rating
- `brief_summary` — One-sentence recap

Cached to avoid re-analyzing sessions.

### Insight Generation

Parallel AI generation of 7 report sections:
1. **At a Glance** — 4-part summary card
2. **What You Work On** — Goal categories, top projects
3. **How You Use AI Agents** — Session patterns, success rates
4. **Impressive Things You Did** — Highlight reel
5. **Where Things Go Wrong** — Friction analysis
6. **Features to Try** — Recommendations
7. **New Ways to Work** — Workflow suggestions

### Format Selection Logic

**Context-Aware Output Selection:**

| User Context | Format | Why |
|--------------|--------|-----|
| "show me" / "view" / no format specified | HTML | Interactive, visual, default |
| "share" / "post" / "email" | Markdown | Portable, readable in text |
| "script" / "automate" / "analyze" | JSON | Programmatic processing |
| "print" / "save as doc" | Markdown → PDF | Document format |

**Format capabilities:**
- **HTML**: Interactive charts, collapsible sections, styled components
- **Markdown**: Plain text, copy-paste friendly, works everywhere
- **JSON**: Raw data, schema-validated, for downstream processing

## Examples

### Default full report
User: `/insights` or "analyze my agent usage"

**Step 1: Parse intent** (user wants comprehensive HTML report, default format)

**Step 2: Generate**
```bash
cd ~/Desktop/agent-skills/universal-insights
node generate-claude-report.cjs --format html --output ~/Desktop/insights-$(date +%Y%m%d).html

# Output:
# Analyzing ~/.claude/projects/...
# Found 24 sessions
# Extracting facets... [████████████████████] 100%
# Generating insights report...
# Report saved to ~/Desktop/insights-20250407.html
```

**Step 3: Present to user**
```
Generated comprehensive insights report for Claude Code:
• 24 sessions analyzed (last 90 days)
• Success rate: 87% (21 achieved / 3 partial)
• Top frustration: API rate limits during debugging
• Report: file:///Users/zaydk/Desktop/insights-20250407.html
```

### Claude Code only
User: "just my claude stats"

**Parse intent:** specific agent (Claude), no format specified → default markdown for terminal readability

```bash
node generate-claude-report.cjs --format md

# Output:
# # Claude Code Usage Report
# ## At a Glance
# - Sessions: 24
# - Total time: ~18 hours
# - Success rate: 87%
# ...
```

### Last 7 days, markdown
User: "weekly summary in markdown"

**Parse intent:** time-constrained (7 days), format=md (for sharing/portability)

```bash
node generate-claude-report.cjs --days 7 --format md --output ~/Desktop/weekly.md

# Output:
# Wrote: /Users/zaydk/Desktop/weekly.md
# Sessions analyzed: 8
# Date range: 2025-03-31 to 2025-04-07
```

### Compare all agents
User: "compare my usage across all AI tools"

**Parse intent:** cross-agent analysis, no format preference → HTML for visual comparison

```bash
# Generate all reports
node generate-claude-report.cjs --output ~/Desktop/claude-insights.html
node generate-cursor-insights.cjs --output ~/Desktop/cursor-insights.html
node generate-codex-report.cjs --output ~/Desktop/codex-insights.html
node generate-gemini-report.cjs --output ~/Desktop/gemini-insights.html

# Output summary
# Generated reports:
# - Claude Code: 24 sessions, 87% success
# - Cursor: 12 sessions, 75% success
# - Codex: 8 sessions, 90% success
# - Gemini: 3 sessions, 33% success
#
# Cross-agent reports saved to ~/Desktop/

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `No sessions found` | Agent not used recently / wrong path | Check session paths exist, verify agent usage |
| `Cannot find module` | Dependencies not installed | `cd universal-insights && npm install` |
| `Anthropic API error` | API key missing/invalid | Check `ANTHROPIC_API_KEY` env var |
| Empty report | Sessions exist but no facets | Delete cache, re-run to trigger re-extraction |
| Slow generation | Many sessions, uncached | First run builds cache; subsequent runs faster |

## Implementation Notes

- Uses Claude API for facet extraction and insight generation
- Caches extracted facets in `~/.cache/universal-insights/`
- Supports incremental updates (only processes new sessions)
- Cross-platform: macOS, Linux, Windows (with path adjustments)

## Report Sections Explained

| Section | Content |
|---------|---------|
| At a Glance | Stats: sessions, time, success rate, top frustration |
| What You Work On | Goal categories pie chart, top 3 projects |
| How You Use AI Agents | Session length distribution, retry patterns |
| Impressive Things You Did | Successful complex tasks, creative solutions |
| Where Things Go Wrong | Error types, specific friction examples |
| Features to Try | Agent-specific feature recommendations |
| New Ways to Work | Workflow pattern suggestions based on your usage |