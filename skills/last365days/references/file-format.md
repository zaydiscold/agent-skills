# File Format Convention

Each profile file follows this structure. Entries are separated by `---` horizontal rules. Each entry is a dated `## YYYY-MM-DD` section with subsections for synthesis, sources, and notable items.

```
# Person Name

## 2026-03-05

### Synthesis
[LLM-generated synthesis — what was learned, key patterns, what changed]

### Sources
- Reddit: N threads | N upvotes | N comments
- X: N posts | N likes | N reposts
[etc. — auto-generated from report.json]

### Notable Items
- @handle (N likes): excerpt...
- r/sub (N pts): title...
[etc. — top sources by engagement]

*Research window: YYYY-MM-DD to YYYY-MM-DD*

---

## 2026-04-05
[next entry appended below, same structure]
```

## Same-Day Entries

When a second research run happens on the same day, persist.py appends a sub-entry instead of creating a duplicate date header:

```
## 2026-03-05

### Synthesis
[first run of the day]

---

#### Update at 14:30

### Synthesis
[second run of the day]

---
```

## Field Details

- **Synthesis**: The LLM-generated analysis including "What I learned", key patterns, and (if history exists) "What Changed" comparison
- **Sources**: Auto-generated from `report.json` — shows count and aggregate engagement per platform
- **Notable Items**: Top 3 items per platform ranked by engagement (likes, score, views)
- **Research window**: Date range covered by the bundled research engine
