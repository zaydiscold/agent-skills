# Cursor Insights Report Generator

This directory contains scripts to generate HTML reports from Cursor IDE session data.

## Files

### 1. `generate-cursor-insights.cjs` (Primary Script)
A standalone Node.js script that:
- Searches for Cursor data at `~/.cursor/chats/` and `~/.cursor/`
- Parses SQLite `store.db` files using direct SQLite queries
- Extracts messages from the blob-based storage format
- Generates a comprehensive HTML report at `~/Desktop/agent-skills/universal-insights/reports/cursor-insights.html`

**Usage:**
```bash
node generate-cursor-insights.cjs
```

**Features:**
- Handles hex-encoded blob data from Cursor's SQLite format
- Extracts messages with role, content, and timestamps
- Shows session statistics (message counts, user vs assistant breakdown)
- Displays sample messages from each session
- Gracefully handles missing or corrupted data

### 2. `generate-cursor-insights-with-adapter.cjs` (Adapter Demo)
Demonstrates using the CursorAdapter from `~/universal-session-adapter/`:

**Prerequisites:**
```bash
cd ~/universal-session-adapter
npm run build
```

**Usage:**
```bash
node generate-cursor-insights-with-adapter.cjs
```

**Note:** The adapter may need updates to fully support Cursor's blob-based storage format (blobs + meta tables). The primary script handles this format directly.

## Cursor Data Structure

Cursor stores session data at:
```
~/.cursor/chats/
  ├── [workspace-hash-1]/
  │   ├── [chat-id-1]/
  │   │   └── store.db          # SQLite database
  │   └── [chat-id-2]/
  │       └── store.db
  └── [workspace-hash-2]/
      └── [chat-id-3]/
          └── store.db
```

### store.db Schema

```sql
CREATE TABLE blobs (id TEXT PRIMARY KEY, data BLOB);
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
```

- **blobs table**: Contains message data as BLOBs, where the data is JSON with `role` and `content` fields
- **meta table**: Contains chat metadata including `agentId`, `name`, `mode`, and `createdAt`

## Report Output

The generated HTML report includes:

1. **Summary Statistics**
   - Total sessions found
   - Total messages
   - User messages count
   - Assistant messages count

2. **Session Details**
   - Session name/path
   - Message breakdown by role
   - Sample messages (first 5 from each session)
   - Timestamps

3. **No-Data State**
   If no data is found, the report explains:
   - What locations were searched
   - Expected file structure
   - Recommendations for enabling session logging in Cursor

## Example Output

```
Cursor Insights Report Generator
==================================================

Searching for Cursor data...
  ✓ Found: /Users/xxx/.cursor
  ✓ Found: /Users/xxx/.cursor/chats
  Found 44 store.db files
  Parsing: 02923956-c986-40c2-b355-35070869b027...
    ✓ 9 messages
  ...

Generating HTML report...
  ✓ Report saved to: /Users/xxx/Desktop/agent-skills/universal-insights/reports/cursor-insights.html

==================================================
Summary:
  Sessions found: 44
  Total messages: 59821
  Report location: /Users/xxx/Desktop/agent-skills/universal-insights/reports/cursor-insights.html
  Errors: 0
```

## Troubleshooting

### No data found
- Ensure Cursor is version 0.40 or higher
- Check that chat history is enabled in Cursor settings
- Verify write permissions for `~/.cursor/` directory

### SQLite errors
The script requires `sqlite3` CLI to be available. On macOS:
```bash
brew install sqlite3
```

### Permission denied
Ensure the script has read access to `~/.cursor/`:
```bash
ls -la ~/.cursor/
```
