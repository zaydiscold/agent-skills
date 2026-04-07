---
name: hermes-memory-optimization
description: Optimize Hermes memory files (MEMORY.md and USER.md) through signal/noise analysis and deep user interviews. Distinguish operational facts from fluff, and build meaningful user profiles.
triggers:
  - optimize memory files
  - clean up memory
  - user profile interview
  - signal vs noise memory
  - critique memory files
  - karpathy style memory
  - USER.md optimization
  - MEMORY.md cleanup
  - reduce memory bloat
version: 1.0.0
metadata:
  hermes:
    tags: [hermes, memory, optimization, user-profile, signal-noise]
    related_skills: [hermes-docs, soul-creator]
---

# Hermes Memory Optimization

## Overview

Hermes uses two bounded memory files:
- **MEMORY.md** (2,200 char limit) — Agent's notes about environment, conventions, learned patterns
- **USER.md** (1,375 char limit) — User's profile, preferences, communication style, identity

These are injected into every session. **Signal-to-noise ratio matters** — wasted tokens on fluff means less room for operational facts.

## The Core Problem

Most memory files mix:
- **Signal**: Actionable, surprising, error-prone details
- **Noise**: Observable behavior, generic platitudes, things the model will pick up anyway

**Example of noise:**
```
"User expects skills to be used when available (assumes skill availability)."
```
This is observable from behavior. Doesn't need encoding.

**Example of signal:**
```
"SF move in <1 month, job hunting AI healthcare biotech."
```
This is operational context that shapes priorities.

## Signal/Noise Framework (Karpathy-style)

### MEMORY.md: Agent's Operational Memory

**High signal (keep):**
- Security research protocols (paid red team, tools, documentation rules)
- Specific file paths and locations (~/Desktop/agent-skills, ~/.hermes/sessions/)
- API keys and config locations (if stable)
- Critical behavioral rules ("confirm before destructive actions")
- Session/transcript locations
- Tool availability and versions

**Low signal (remove):**
- Detailed tone guidelines (model learns this from conversation)
- API key values themselves (belong in .env, not memory)
- Long quotes about deliverables (observable from interactions)
- Generic platitudes about work style

**Compression heuristic:**
> "After 10 more sessions, which parts will still be surprising or error-preventing?"

### USER.md: User's Identity & Preferences

**High signal (keep):**
- Demographics + current life phase (age, background, career pivot, deadlines)
- Mission-critical objectives (SF move, job hunt, primary project)
- Specific behavioral corrections ("stop saying X")
- Communication defaults (uses "we", ends messages with 🌸)
- Failure modes (struggles with follow-through, overwhelmed by backlog)
- In-person vs async strengths

**Low signal (remove):**
- Work style descriptions observable from behavior
- Generic motivational frameworks
- Duplicate content that's also in MEMORY.md
- Historical figures as mindset models (unless truly operational)

**Key insight:**
USER.md should read like a **life coach's notes** about the person, not a **project manager's notes** about work preferences.

## Deep User Interview Methodology

Don't guess at USER.md content. Interview like a counselor/life coach:

### Phase 1: Identity & Core Values
1. **"When you say [identity claim], who do you actually pattern yourself after?"**
   - e.g., "one of the greats" → who specifically?

2. **"What does [mindset] actually look like day-to-day?"**
   - e.g., "delusionally confident" → what are you doing when in that state?

3. **"What are you genuinely optimistic about? What breaks that optimism?"**

### Phase 2: Current Life Phase & Constraints
4. **"What's the real deadline driving [time pressure]?"**
   - e.g., "SF in <1 month" → lease ending? job start? running from/to something?

5. **"Is [career goal] the dream, or the pivot? What did you want before?"**

6. **"What's your actual hit rate on [current goal]? Where are you stuck?"**

### Phase 3: Systems & Failure Modes
7. **"Why do you struggle with [behavior]? Is it energy, anxiety, distraction?"**
   - e.g., "phone/text follow-through" → what's actually happening when you ghost?

8. **"What backlog? Be specific — tasks, messages, projects?"**

9. **"What makes you 'amazing in-person'? What do people actually say about you in rooms?"**

### Phase 4: Relationship to AI Assistant
10. **"What do you actually need from me? Task execution? Emotional support? Brutal honesty?"**

11. **"When has my default behavior annoyed you? When have I been most/least useful?"**

12. **"What would make you trust me more? What makes you doubt me?"**

### Phase 5: Daily Reality & Energy
13. **"Walk me through yesterday. Wake time, what you actually did, when you felt sharp vs dead."**

14. **"What are you avoiding right now? What keeps getting pushed off?"**

15. **"What energizes vs drains you? Social time? Deep work? Movement? Creation?"**

### Phase 6: The Real Goal & Fear
16. **"5 years from now, where are you? Morning routine, location, people, work?"**

17. **"What's the actual fear? Under all the confidence, what are you scared of?"**

### Output: Compressed User Profile

Convert interview answers into compressed operational facts:

**Before (fluffy):**
```
Zayd, 25, bio background, pivoting from AI program lead to bio+tech/health+AI.
Mindset: delusionally confident, irrationally optimistic, "one of the greats"
(Alexander, Genghis, Edison, Einstein, Kublai, Rumi, Musashi, Newton, Napoleon).
I'm "Delilah" — right hand, "Cortana to Master Chief". Amazing in-person,
struggles phone/text follow-through, overwhelmed by backlog. Uses "we".
End messages with 🌸.
```

**After (signal-dense):**
```
Zayd, 25, bio→AI/health, SF move <1 mo, job hunting. Delusional confidence
mindset. "Cortana to Master Chief" dynamic. In-person strong, async weak.
Uses "we". Ends with 🌸.
```

Same information, 40% fewer tokens.

## Duplication Detection

Always check for content that appears in both files:

| Common Duplicate | Keep In | Remove From |
|------------------|---------|-------------|
| Tool/repo locations | MEMORY.md (environmental) | USER.md |
| API keys/credentials | Neither (.env file) | Both |
| Deliverable expectations | Neither (observable) | Both |
| Work style preferences | Neither (observable) | Both |
| Tone/voice guidelines | SOUL.md (AI personality) | Both |

**Rule:** If it describes the environment → MEMORY.md. If it describes the person → USER.md. If it's about the AI's voice → SOUL.md.

## Compression Heuristics

1. **"So what?" test**: Every sentence must change behavior. If removing it changes nothing, delete it.

2. **Observability test**: If I'd learn this in 3 messages anyway, don't encode it.

3. **Surprise test**: After 10 sessions, will this still prevent errors or surprises? If no, delete.

4. **Operational test**: Does this change what I do or how I do it? If no, delete.

5. **Specificity test**: Are there concrete details (paths, dates, constraints) or just vibes? Vibes get compressed.

## Common Bloat Patterns

**Overweight sections to target:**
- **Tone guidelines** (300+ chars) → Compress to: "Tone: sharp, casual, efficient"
- **Historical figure lists** (100+ chars) → Keep 2-3 max or remove
- **Motivational frameworks** (200+ chars) → One sentence max
- **Detailed work style descriptions** (150+ chars) → One sentence or delete
- **API key values** → Move to .env, replace with "Tavily configured in ~/.config/hermes/.env"

## Implementation Workflow

### Step 1: Read Current State
```
read_file("~/.hermes/memories/MEMORY.md")
read_file("~/.hermes/memories/USER.md")
```

### Step 2: Analyze with Signal/Noise Framework
- Label each section as signal or noise
- Identify duplicates across files
- Flag observables vs operational facts

### Step 3: Conduct Deep Interview (for USER.md)
- Use the 17-question framework above
- Take notes on surprising answers
- Focus on current constraints and failure modes

### Step 4: Draft Compressed Versions
- Apply compression heuristics
- Remove duplicates
- Move API keys to .env

### Step 5: Confirm with User
**Never auto-apply.** Show the plan, get explicit approval.

### Step 6: Execute & Verify
```
patch(path="~/.hermes/memories/MEMORY.md", ...)
patch(path="~/.hermes/memories/USER.md", ...)
```

Verify new sizes:
```
wc -c ~/.hermes/memories/MEMORY.md ~/.hermes/memories/USER.md
```

## Example Transformation

**Before:**
```
MEMORY.md (2,041 chars, 93% full):
§1: Tone: edgy but cute, casual, playful, sarcastic. Can curse but keep it chill...
[500 chars of tone guidance]

§2: User has agent-skills repo at ~/Desktop/agent-skills...

§3: Tavily API key configured: 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
- MCP server: tavily-mcp...
- Config: ~/.config/hermes/config.yaml

§4: Chat sessions at ~/.hermes/sessions/...

§5: User expects synthesized research output...
Quote: "hell no im not reading all that thats your job"

§6: CRITICAL: Before ANY destructive action...
```

**After:**
```
MEMORY.md (1,310 chars, 60% full):
§1: Tone: sharp, casual, efficient. Security research: paid red team at ~/Desktop/Security research/ — hoard info per engagement, never edit old. Tools: Ghidra, IDA, Burp, custom scripts. Chaotic, technical objectivity.

§2: Agent-skills repo: ~/Desktop/agent-skills → zaydiscold/agent-skills (bird CLI, v0.8.0)

§3: Chat sessions: ~/.hermes/sessions/session_YYYYMMDDTTTTT.json → copy to ~/Desktop for viewing

§4: CRITICAL: Confirm before destructive actions. NEVER give time estimates like "2-3 hours" — focus on phases/checkpoints.
```

**Savings:** 730 chars (35% reduction), same operational content.

## Pitfalls to Avoid

1. **Don't auto-delete** — Always confirm compression plan with user first
2. **Don't move API keys to memory** — Use .env or config files
3. **Don't duplicate across files** — One home per fact
4. **Don't encode observables** — "Expects skills to be used" is visible in behavior
5. **Don't over-compress** — "SF move <1 mo" is operational; "delusionally confident" is identity (both worth keeping)

## When to Re-optimize

- After major life changes (new job, move, relationship)
- When approaching character limits (85%+ full)
- When noticing repeated misalignments in assistant behavior
- Quarterly maintenance (like checking a todo list)
