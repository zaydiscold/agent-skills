# Claude Code /insights Command - Deep Research Analysis

## Overview
The `/insights` command in Claude Code generates comprehensive usage analytics and personalized insights from session history. It reads Claude's JSONL session logs, extracts structured "facets" via AI analysis, aggregates data, and produces an interactive HTML report.

## Data Sources

### 1. Session Storage Location
```typescript
// ~/.claude/projects/<project-name>/<session-id>.jsonl
function getProjectsDir(): string {
  return join(getClaudeConfigHomeDir(), 'projects')
}
```

### 2. Session File Format (JSONL)
Each session is stored as newline-delimited JSON with entries like:
```typescript
interface LogEntry {
  type: 'user' | 'assistant' | 'system' | 'attachment' | 'queue-operation' | 'file-history-snapshot'
  uuid: string
  parentUuid?: string
  timestamp: string
  sessionId: string
  message?: {
    role: 'user' | 'assistant'
    content: string | ContentBlock[]
    model?: string
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  projectPath?: string
  summary?: string
  firstPrompt?: string
  created: Date
  modified: Date
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'thinking'; thinking: string }
```

### 3. Data Read Process
```typescript
// From sessionStorage.ts - key functions:
async function loadAllLogsFromSessionFile(filePath: string): Promise<LogOption[]>
async function getSessionFilesWithMtime(): Promise<Array<{ filePath: string; mtime: Date }>>
function getSessionIdFromLog(log: LogOption): string | null
```

## Analysis Pipeline

### Phase 1: Session Metadata Extraction (Non-AI)
```typescript
function extractToolStats(log: LogOption): {
  toolCounts: Record<string, number>
  languages: Record<string, number>
  gitCommits: number
  gitPushes: number
  inputTokens: number
  outputTokens: number
  userInterruptions: number
  userResponseTimes: number[]
  toolErrors: number
  toolErrorCategories: Record<string, number>
  usesTaskAgent: boolean
  usesMcp: boolean
  usesWebSearch: boolean
  usesWebFetch: boolean
  linesAdded: number
  linesRemoved: number
  filesModified: Set<string>
  messageHours: number[]
  userMessageTimestamps: string[]
}
```

Key metrics computed without AI:
- **Tool usage**: Counts per tool (Edit, Write, Bash, WebSearch, etc.)
- **Languages**: Inferred from file extensions (.ts → TypeScript, etc.)
- **Git activity**: Detected via `git commit`/`git push` in Bash commands
- **Code changes**: Line diffs calculated using `diffLines` library
- **Response times**: Time between assistant message and next user message (2s-1hr range)
- **Interruptions**: Detected via "[Request interrupted by user" markers
- **Tool errors**: Categorized by error message patterns (Command Failed, Edit Failed, etc.)
- **Multi-clauding detection**: Tracks overlapping session activity

### Phase 2: Facet Extraction (AI-Powered)

**Model Used**: Claude Opus (getDefaultOpusModel())

**Prompt Structure**:
```typescript
const FACET_EXTRACTION_PROMPT = `Analyze this Claude Code session and extract structured facets.

CRITICAL GUIDELINES:

1. **goal_categories**: Count ONLY what the USER explicitly asked for.
   - DO NOT count Claude's autonomous codebase exploration
   - DO NOT count work Claude decided to do on its own
   - ONLY count when user says "can you...", "please...", "I need..."

2. **user_satisfaction_counts**: Base ONLY on explicit user signals.
   - "Yay!", "great!", "perfect!" → happy
   - "thanks", "looks good" → satisfied
   - "ok, now let's..." → likely_satisfied
   - "that's not right" → dissatisfied
   - "this is broken" → frustrated

3. **friction_counts**: Be specific about what went wrong.
   - misunderstood_request: Claude interpreted incorrectly
   - wrong_approach: Right goal, wrong solution method
   - buggy_code: Code didn't work correctly
   - user_rejected_action: User said no/stop to a tool call

4. If very short or just warmup, use warmup_minimal for goal_category

SESSION:
`
```

**Output Schema** (JSON):
```typescript
interface SessionFacets {
  session_id: string
  underlying_goal: string           // What user fundamentally wanted
  goal_categories: Record<string, number>  // e.g., {debug_investigate: 2, implement_feature: 1}
  outcome: 'fully_achieved' | 'mostly_achieved' | 'partially_achieved' | 'not_achieved' | 'unclear_from_transcript'
  user_satisfaction_counts: Record<string, number>  // happy, satisfied, likely_satisfied, dissatisfied, frustrated, unsure
  claude_helpfulness: 'unhelpful' | 'slightly_helpful' | 'moderately_helpful' | 'very_helpful' | 'essential'
  session_type: 'single_task' | 'multi_task' | 'iterative_refinement' | 'exploration' | 'quick_question'
  friction_counts: Record<string, number>
  friction_detail: string
  primary_success: 'none' | 'fast_accurate_search' | 'correct_code_edits' | 'good_explanations' | 'proactive_help' | 'multi_file_changes' | 'good_debugging'
  brief_summary: string
  user_instructions_to_claude?: string[]  // Extracted explicit instructions
}
```

**Transcript Formatting for AI**:
```typescript
function formatTranscriptForFacets(log: LogOption): string {
  // Format: Session ID, Date, Project, Duration
  // Then [User]: message content (truncated to 500 chars)
  // [Assistant]: content (truncated to 300 chars)
  // [Tool: tool_name]: for tool usage
}
```

**Summarization for Long Sessions**:
- If transcript > 30k chars, split into 25k chunks
- Summarize each chunk in parallel using AI
- Combine summaries with session header

**Caching**:
- Facets cached to: `~/.claude/usage-data/facets/<session_id>.json`
- Session metadata cached to: `~/.claude/usage-data/session-meta/<session_id>.json`
- Cache keyed by session_id, regenerates if missing

### Phase 3: Data Aggregation

```typescript
interface AggregatedData {
  total_sessions: number
  sessions_with_facets: number
  date_range: { start: string; end: string }
  total_messages: number
  total_duration_hours: number
  total_input_tokens: number
  total_output_tokens: number
  tool_counts: Record<string, number>
  languages: Record<string, number>
  git_commits: number
  git_pushes: number
  projects: Record<string, number>
  goal_categories: Record<string, number>
  outcomes: Record<string, number>
  satisfaction: Record<string, number>
  helpfulness: Record<string, number>
  session_types: Record<string, number>
  friction: Record<string, number>
  success: Record<string, number>
  session_summaries: Array<{ id: string; date: string; summary: string; goal?: string }>
  // Extended stats
  total_interruptions: number
  total_tool_errors: number
  tool_error_categories: Record<string, number>
  user_response_times: number[]
  median_response_time: number
  avg_response_time: number
  sessions_using_task_agent: number
  sessions_using_mcp: number
  sessions_using_web_search: number
  sessions_using_web_fetch: number
  total_lines_added: number
  total_lines_removed: number
  total_files_modified: number
  days_active: number
  messages_per_day: number
  message_hours: number[]
  multi_clauding: {
    overlap_events: number
    sessions_involved: number
    user_messages_during: number
  }
}
```

### Phase 4: Parallel Insight Generation

**7 AI Sections Run in Parallel** (all using Claude Opus):

```typescript
const INSIGHT_SECTIONS: InsightSection[] = [
  {
    name: 'project_areas',
    prompt: `Analyze usage data and identify project areas. Return JSON with areas[].`,
    maxTokens: 8192
  },
  {
    name: 'interaction_style',
    prompt: `Describe user's interaction style. Use second person 'you'. Return JSON with narrative and key_pattern.`,
    maxTokens: 8192
  },
  {
    name: 'what_works',
    prompt: `Identify what's working well. Use 'you'. Return JSON with impressive_workflows[].`,
    maxTokens: 8192
  },
  {
    name: 'friction_analysis',
    prompt: `Identify friction points. Use 'you'. Return JSON with categories[].`,
    maxTokens: 8192
  },
  {
    name: 'suggestions',
    prompt: `Suggest improvements. Reference specific CC features (MCP, Skills, Hooks, Headless, Task Agents). Return JSON with claude_md_additions[], features_to_try[], usage_patterns[].`,
    maxTokens: 8192
  },
  {
    name: 'on_the_horizon',
    prompt: `Identify future opportunities. Think BIG - autonomous workflows. Return JSON with opportunities[].`,
    maxTokens: 8192
  },
  {
    name: 'fun_ending',
    prompt: `Find a memorable qualitative moment. Return JSON with headline and detail.`,
    maxTokens: 8192
  }
]
```

**At a Glance Section** (generated after parallel sections complete):
Uses outputs from all other sections to generate 4-part summary:
1. **What's working** - User's unique style and impactful things
2. **What's hindering** - (a) Claude's limitations, (b) user-side friction
3. **Quick wins** - Specific features to try
4. **Ambitious workflows** - Future possibilities with better models

## Report Generation

### HTML Structure
- **Header**: Title, session/message count, date range
- **Nav TOC**: Links to all sections
- **Stats Row**: Sessions, messages, hours, commits
- **At a Glance**: 4-part summary with links
- **What You Work On**: Project areas with session counts
- **How You Use Claude Code**: Narrative analysis
- **Impressive Things You Did**: Big wins
- **Where Things Go Wrong**: Friction categories with examples
- **Features to Try**: CLAUDE.md additions, CC features
- **New Ways to Use Claude Code**: Usage patterns with copyable prompts
- **On the Horizon**: Future opportunities
- **Fun Ending**: Memorable moment

### Visual Elements
- Bar charts for tool usage, outcomes, satisfaction, friction
- Response time histogram (buckets: 2-10s, 10-30s, 30s-1m, 1-2m, 2-5m, 5-15m, >15m)
- Time of day chart (Morning, Afternoon, Evening, Night)
- Color-coded sections (green for wins, red for friction, yellow for highlights)

### Interactive Features
- Collapsible sections for team feedback
- Copy buttons for code snippets and prompts
- Timezone selector for time-of-day chart
- "Copy All Checked" for CLAUDE.md additions

## Label Mapping (Human-Readable Names)
```typescript
const LABEL_MAP: Record<string, string> = {
  // Goal categories
  debug_investigate: 'Debug/Investigate',
  implement_feature: 'Implement Feature',
  fix_bug: 'Fix Bug',
  write_script_tool: 'Write Script/Tool',
  refactor_code: 'Refactor Code',
  configure_system: 'Configure System',
  create_pr_commit: 'Create PR/Commit',
  analyze_data: 'Analyze Data',
  understand_codebase: 'Understand Codebase',
  write_tests: 'Write Tests',
  write_docs: 'Write Docs',
  deploy_infra: 'Deploy/Infra',
  warmup_minimal: 'Cache Warmup',
  // ... more for friction, satisfaction, session types, outcomes, helpfulness
}
```

## Key Implementation Details

1. **Deduplication**: Sessions with multiple branches (retries) are deduplicated by keeping the branch with most user messages

2. **Multi-Clauding Detection**: Uses sliding window algorithm to detect pattern: session1 → session2 → session1 within 30-minute window

3. **Response Time Filtering**: Only counts gaps > 2 seconds (real think time) and < 1 hour

4. **Language Detection**: Maps file extensions to languages using EXTENSION_TO_LANGUAGE map

5. **Tool Error Categorization**: Pattern matching on error messages:
   - "exit code" → Command Failed
   - "rejected" → User Rejected
   - "string to replace not found" → Edit Failed
   - "modified since read" → File Changed
   - etc.

6. **Caching Strategy**: 
   - Session metadata: Computed and cached (fast)
   - Facets: AI-extracted and cached (expensive)
   - Report: Generated fresh each time (combines cached data)

## API Usage

**Analysis Model**: Claude Opus (best quality for facet extraction)
**Insights Model**: Claude Opus (best quality for narrative insights)

**Approximate Token Usage per Session**:
- Facet extraction: ~4k tokens (input: transcript up to 30k chars, output: JSON facets)
- Per section insight: ~8k tokens (input: aggregated data, output: JSON section)
- For 50 sessions: ~200k tokens for facets + ~56k tokens for 7 sections = ~256k tokens total

---

## Universal Insights - Cross-Agent Extension Ideas

Based on this research, to extend `/insights` to work across multiple agents:

### Data Sources to Support

| Agent | Format | Location |
|-------|--------|----------|
| Claude Code | JSONL | `~/.claude/projects/<name>/<uuid>.jsonl` |
| Cursor | SQLite | `~/.cursor/chats/<hash>/<id>/store.db` |
| Gemini CLI | JSON | `~/.gemini/tmp/<hash>/chats/session-*.json` |
| Codex | JSONL | `~/.codex/history.jsonl` |
| Antigravity | Protobuf | `~/.gemini/antigravity/conversations/*.pb` |

### Normalized Schema
All formats should convert to a common Session type with:
- sessionId, agent, startTime, endTime
- messages[] with role, content, timestamp, metadata
- project context (cwd, project name)
- computed stats (message counts, tool usage)

### Analysis Adaptations
1. **Facet Extraction Prompt**: Modify to mention "AI agent" instead of "Claude Code"
2. **Tool Name Mapping**: Normalize tool names across agents (e.g., Edit→edit, Bash→bash)
3. **Section Prompts**: Adapt "CC FEATURES REFERENCE" section for universal features
4. **Report Template**: Add agent breakdown section showing usage across different agents

### New Possibilities
- Cross-agent pattern detection (which agent used for which tasks)
- Unified session timeline across all agents
- Agent-specific recommendations
- Migration suggestions ("You use Cursor for X, but Claude is better at Y")
