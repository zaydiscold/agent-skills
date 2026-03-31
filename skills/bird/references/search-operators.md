# Search operators

Use with `bird search "..."`.

- `from:@handle` — tweets by a specific user
- `to:@handle` — replies to a specific user
- `"exact phrase"` — exact match
- `filter:links` — only tweets containing links
- `filter:media` — only tweets with images/video
- `since:YYYY-MM-DD until:YYYY-MM-DD` — date range
- `min_retweets:N` / `min_faves:N` — engagement thresholds
- `-keyword` — exclude a term

Recommended defaults:
- start with `-n 12`
- offer larger batches only if user asks for more
