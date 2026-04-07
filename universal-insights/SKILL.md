---
name: universal-insights
description: Generate cross-agent analytics and insights reports from AI coding sessions. Use when user says "/insights", "analyze my agent usage", "claude stats", "cursor insights", or requests analytics on their AI coding patterns across Claude Code, Cursor, Codex, Gemini, or Antigravity.
metadata:
  author: zaydk
  version: 1.0.0
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

- `references/adapters.md` — Session adapter implementations per agent
- `reports/` — Generated HTML/Markdown report examples
- `src/` — Implementation source (read only if debugging)

## Workflow

### Step 1: Parse User Intent

**Default** (no args): Generate comprehensive report across all agents
```bash
cd ~/Desktop/agent-skills/universal-insights && node generate-claude-report.cjs
```

**Specific agent**: Use adapter flag
```bash
node generate-cursor-insights.cjs
node generate-codex-report.cjs
node generate-gemini-report.cjs
```

**Time range**: Pass `--days`
```bash
node generate-claude-report.cjs --days 7
```

**Output format**:
```bash
# HTML (default, interactive)
node generate-claude-report.cjs --format html

# Markdown
node generate-claude-report.cjs --format md
```

### Step 2: Data Collection

Each report generator:
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

### Step 3: Facet Extraction

For each session, AI extracts:
- `underlying_goal` — What user wanted
- `goal_categories` — Task types (counted)
- `outcome` — achieved/mostly/partially/not
- `user_satisfaction` — happy/satisfied/frustrated
- `friction_counts` — Error types encountered
- `agent_helpfulness` — Rating
- `brief_summary` — One-sentence recap

Cached to avoid re-analyzing sessions.

### Step 4: Insight Generation

Parallel AI generation of 7 report sections:
1. **At a Glance** — 4-part summary card
2. **What You Work On** — Goal categories, top projects
3. **How You Use AI Agents** — Session patterns, success rates
4. **Impressive Things You Did** — Highlight reel
5. **Where Things Go Wrong** — Friction analysis
6. **Features to Try** — Recommendations
7. **New Ways to Work** — Workflow suggestions

### Step 5: Report Rendering

**Format selected based on context:**

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
```bash
cd ~/Desktop/agent-skills/universal-insights
node generate-claude-report.cjs --format html --output ~/Desktop/insights-$(date +%Y%m%d).html
echo "Report saved to ~/Desktop/insights-$(date +%Y%m%d).html"
```

### Claude Code only
User: "just my claude stats"
```bash
node generate-claude-report.cjs --format md
```

### Last 7 days, markdown
User: "weekly summary in markdown"
```bash
node generate-claude-report.cjs --days 7 --format md --output ~/Desktop/weekly.md
```

### Compare all agents
User: "compare my usage across all AI tools"
```bash
# Generate all reports
node generate-claude-report.cjs --output ~/Desktop/claude-insights.html
node generate-cursor-insights.cjs --output ~/Desktop/cursor-insights.html
node generate-codex-report.cjs --output ~/Desktop/codex-insights.html
node generate-gemini-report.cjs --output ~/Desktop/gemini-insights.html

echo "Cross-agent reports saved to ~/Desktop/"
```

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