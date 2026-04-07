#!/usr/bin/env node
/**
 * Codex Insights Report Generator
 * Parses ~/.codex/ session files and generates an HTML report
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const CODEX_DIR = path.join(process.env.HOME, '.codex');
const OUTPUT_DIR = path.join(process.env.HOME, 'Desktop/agent-skills/universal-insights/reports');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'codex-insights.html');

// ============================================================================
// Data Parsing Functions
// ============================================================================

async function findAllSessionFiles() {
  const files = [];
  
  // Check main directories
  const dirsToScan = [
    path.join(CODEX_DIR, 'archived_sessions'),
    path.join(CODEX_DIR, 'sessions'),
    CODEX_DIR
  ];
  
  for (const dir of dirsToScan) {
    if (!fs.existsSync(dir)) continue;
    
    try {
      const entries = await readdir(dir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          const fullPath = path.join(entry.parentPath || dir, entry.name);
          files.push(fullPath);
        }
      }
    } catch (err) {
      // Directory might not exist
    }
  }
  
  return files;
}

function parseJSONL(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const entries = [];
  
  for (let i = 0; i < lines.length; i++) {
    try {
      const entry = JSON.parse(lines[i]);
      entries.push({ entry, line: i + 1 });
    } catch (err) {
      // Skip malformed lines
    }
  }
  
  return entries;
}

function normalizeTimestamp(ts) {
  if (!ts) return null;
  
  // Handle Unix timestamp in seconds (Codex format)
  if (typeof ts === 'number' && ts < 10000000000) {
    return { iso: new Date(ts * 1000).toISOString(), ms: ts * 1000 };
  }
  // Handle Unix timestamp in milliseconds
  if (typeof ts === 'number' && ts > 10000000000) {
    return { iso: new Date(ts).toISOString(), ms: ts };
  }
  // Handle ISO string
  if (typeof ts === 'string') {
    const date = new Date(ts);
    if (!isNaN(date.getTime())) {
      return { iso: date.toISOString(), ms: date.getTime() };
    }
  }
  return null;
}

function detectContentType(content) {
  if (!content) return 'text';
  
  const text = String(content);
  if (text.match(/error|exception|failed|failure/i)) return 'error';
  if (text.match(/^\s*[$#>]\s+/m)) return 'command';
  if (text.match(/```|function|class|const|let|var|import|export/)) return 'code';
  return 'text';
}

function detectCodeBlocks(content) {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }
  return blocks;
}

function extractToolCalls(entries) {
  const tools = [];
  
  for (const { entry } of entries) {
    const type = entry?.type;
    const payload = entry?.payload || {};
    
    if (type === 'response_item' && payload?.type === 'function_call') {
      tools.push({
        name: payload.name || 'unknown',
        arguments: payload.arguments || '{}',
        timestamp: entry.timestamp
      });
    }
    
    // Extract from other event types
    if (type === 'event_msg' && payload?.type === 'tool_call') {
      tools.push({
        name: payload.name || 'unknown',
        arguments: JSON.stringify(payload.arguments || {}),
        timestamp: entry.timestamp
      });
    }
  }
  
  return tools;
}

function extractTokenUsage(entries) {
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let lastUsage = null;
  
  for (const { entry } of entries) {
    if (entry?.type === 'token_count' && entry?.payload?.info?.total_token_usage) {
      const usage = entry.payload.info.total_token_usage;
      totalInput = Math.max(totalInput, usage.input_tokens || 0);
      totalOutput = Math.max(totalOutput, usage.output_tokens || 0);
      totalCached = Math.max(totalCached, usage.cached_input_tokens || 0);
      lastUsage = usage;
    }
  }
  
  return {
    input: totalInput,
    output: totalOutput,
    cached: totalCached,
    total: totalInput + totalOutput,
    last: lastUsage
  };
}

// ============================================================================
// Session Parsing
// ============================================================================

async function parseSessionFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    if (!content.trim()) {
      return { success: false, error: 'Empty file', path: filePath };
    }
    
    const entries = parseJSONL(content);
    const stats = fs.statSync(filePath);
    
    // Determine session type
    const firstEntry = entries[0]?.entry;
    const isStructuredLog = entries.some(e => 
      ['session_meta', 'event_msg', 'response_item', 'turn_context', 'token_count'].includes(e.entry?.type)
    );
    
    // Extract session metadata
    let sessionId = 'unknown';
    let sessionTitle = null;
    let projectPath = null;
    let model = null;
    let agentVersion = null;
    let createdAt = stats.mtime.toISOString();
    let updatedAt = stats.mtime.toISOString();
    
    // Try to get session id from filename
    const filenameMatch = path.basename(filePath).match(/rollout-([^-]+)/);
    if (filenameMatch) {
      sessionId = filenameMatch[1];
    }
    
    // Look for session metadata
    for (const { entry } of entries) {
      if (entry?.type === 'session_meta' && entry?.payload) {
        sessionId = entry.payload.id || sessionId;
        projectPath = entry.payload.cwd || projectPath;
        agentVersion = entry.payload.cli_version || agentVersion;
        model = entry.payload.model || model;
        if (entry.payload.timestamp) {
          const ts = normalizeTimestamp(entry.payload.timestamp);
          if (ts) createdAt = ts.iso;
        }
        break;
      }
    }
    
    // Count message types
    let userMessages = 0;
    let assistantMessages = 0;
    let toolCalls = 0;
    let errors = 0;
    let turnCount = 0;
    const messages = [];
    
    for (const { entry } of entries) {
      const type = entry?.type;
      const payload = entry?.payload || {};
      
      if (type === 'event_msg') {
        if (payload.type === 'user_message') {
          userMessages++;
          messages.push({ role: 'user', content: payload.message || '', timestamp: entry.timestamp });
        } else if (payload.type === 'agent_message' || payload.type === 'assistant_message') {
          assistantMessages++;
          messages.push({ role: 'assistant', content: payload.message || '', timestamp: entry.timestamp });
        } else if (payload.type === 'task_started') {
          turnCount++;
        }
      }
      
      if (type === 'response_item' && payload?.type === 'message') {
        const role = payload.role;
        const content = payload.content;
        let text = '';
        
        if (Array.isArray(content)) {
          text = content.map(c => c.text || '').join('');
        } else {
          text = String(content || '');
        }
        
        if (role === 'user') {
          userMessages++;
          messages.push({ role: 'user', content: text, timestamp: entry.timestamp });
        } else if (role === 'assistant') {
          assistantMessages++;
          messages.push({ role: 'assistant', content: text, timestamp: entry.timestamp });
        }
      }
      
      if (type === 'response_item' && payload?.type === 'function_call') {
        toolCalls++;
      }
    }
    
    // Calculate duration from timestamps
    const timestamps = entries
      .map(e => normalizeTimestamp(e.entry?.timestamp))
      .filter(t => t !== null)
      .map(t => t.ms);
    
    let durationMs = 0;
    if (timestamps.length > 1) {
      durationMs = Math.max(...timestamps) - Math.min(...timestamps);
    }
    
    // Get token usage
    const tokenUsage = extractTokenUsage(entries);
    
    // Get tool calls
    const tools = extractToolCalls(entries);
    
    // Count content types
    const contentTypes = { text: 0, code: 0, command: 0, error: 0, image: 0 };
    let codeBlocks = 0;
    
    for (const msg of messages) {
      const type = detectContentType(msg.content);
      contentTypes[type]++;
      const blocks = detectCodeBlocks(msg.content);
      codeBlocks += blocks.length;
    }
    
    // Get session title from index if available
    const sessionIndexPath = path.join(CODEX_DIR, 'session_index.jsonl');
    if (fs.existsSync(sessionIndexPath)) {
      try {
        const indexContent = await readFile(sessionIndexPath, 'utf-8');
        const indexEntries = parseJSONL(indexContent);
        for (const { entry } of indexEntries) {
          if (entry?.id === sessionId && entry?.thread_name) {
            sessionTitle = entry.thread_name;
            break;
          }
        }
      } catch (e) {
        // Ignore index errors
      }
    }
    
    return {
      success: true,
      session: {
        id: sessionId,
        title: sessionTitle || path.basename(filePath, '.jsonl'),
        path: filePath,
        size: stats.size,
        createdAt,
        updatedAt,
        projectPath,
        model,
        agentVersion,
        isStructuredLog,
        entryCount: entries.length,
        stats: {
          userMessages,
          assistantMessages,
          totalMessages: userMessages + assistantMessages,
          toolCalls,
          turnCount,
          errors,
          durationMs,
          durationMinutes: Math.round(durationMs / 60000 * 10) / 10,
          codeBlocks,
          tokenUsage,
          contentTypes
        },
        messages: messages.slice(0, 50), // Keep only first 50 for report
        tools
      }
    };
    
  } catch (err) {
    return { success: false, error: err.message, path: filePath };
  }
}

// ============================================================================
// HTML Report Generation
// ============================================================================

function generateHTML(sessions, stats, errors) {
  const formatDate = (iso) => {
    if (!iso) return 'Unknown';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };
  
  const formatDuration = (ms) => {
    if (!ms || ms < 1000) return '< 1s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };
  
  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  };
  
  const formatNumber = (n) => {
    if (n === undefined || n === null) return '0';
    return n.toLocaleString();
  };

  // Build tool usage chart data
  const toolCounts = {};
  for (const session of sessions) {
    for (const tool of session.tools || []) {
      toolCounts[tool.name] = (toolCounts[tool.name] || 0) + 1;
    }
  }
  const topTools = Object.entries(toolCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  // Build daily activity data
  const dailyActivity = {};
  for (const session of sessions) {
    const date = session.createdAt?.split('T')[0] || 'Unknown';
    if (!dailyActivity[date]) {
      dailyActivity[date] = { sessions: 0, messages: 0 };
    }
    dailyActivity[date].sessions++;
    dailyActivity[date].messages += session.stats?.totalMessages || 0;
  }
  const sortedDates = Object.keys(dailyActivity).sort();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codex Insights Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --text-primary: #e6edf3;
      --text-secondary: #7d8590;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-purple: #a371f7;
      --accent-orange: #d29922;
      --accent-red: #f85149;
      --border-color: #30363d;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
    }
    
    .header {
      background: var(--bg-secondary);
      border-bottom: 1px solid var(--border-color);
      padding: 24px 32px;
    }
    
    .header h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .header .subtitle {
      color: var(--text-secondary);
      font-size: 14px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px 32px;
    }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    
    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      transition: transform 0.2s, border-color 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      border-color: var(--accent-blue);
    }
    
    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--accent-blue);
    }
    
    .stat-value.green { color: var(--accent-green); }
    .stat-value.purple { color: var(--accent-purple); }
    .stat-value.orange { color: var(--accent-orange); }
    .stat-value.red { color: var(--accent-red); }
    
    .section {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      margin-bottom: 24px;
      overflow: hidden;
    }
    
    .section-header {
      background: var(--bg-tertiary);
      padding: 16px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .section-header h2 {
      font-size: 16px;
      font-weight: 600;
    }
    
    .section-body {
      padding: 20px;
    }
    
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    
    .chart-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
    }
    
    .chart-container h3 {
      font-size: 14px;
      color: var(--text-secondary);
      margin-bottom: 16px;
    }
    
    .session-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .session-item {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
    }
    
    .session-info h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .session-info .session-meta {
      font-size: 12px;
      color: var(--text-secondary);
    }
    
    .session-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
    }
    
    .session-stat {
      text-align: center;
    }
    
    .session-stat .value {
      font-weight: 600;
      color: var(--accent-blue);
    }
    
    .session-stat .label {
      color: var(--text-secondary);
      font-size: 10px;
      text-transform: uppercase;
    }
    
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }
    
    .badge-blue { background: rgba(88, 166, 255, 0.2); color: var(--accent-blue); }
    .badge-green { background: rgba(63, 185, 80, 0.2); color: var(--accent-green); }
    .badge-purple { background: rgba(163, 113, 247, 0.2); color: var(--accent-purple); }
    .badge-orange { background: rgba(210, 153, 34, 0.2); color: var(--accent-orange); }
    
    .tool-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .tool-tag {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 12px;
    }
    
    .tool-tag .count {
      color: var(--accent-blue);
      font-weight: 600;
      margin-left: 4px;
    }
    
    .errors-section {
      background: rgba(248, 81, 73, 0.1);
      border: 1px solid var(--accent-red);
    }
    
    .error-item {
      color: var(--accent-red);
      font-size: 13px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
    }
    
    .error-item:last-child {
      border-bottom: none;
    }
    
    .insights-list {
      list-style: none;
    }
    
    .insights-list li {
      padding: 8px 0;
      border-bottom: 1px solid var(--border-color);
      font-size: 14px;
    }
    
    .insights-list li:before {
      content: "•";
      color: var(--accent-blue);
      margin-right: 8px;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--text-secondary);
    }
    
    .empty-state h3 {
      color: var(--text-primary);
      margin-bottom: 8px;
    }
    
    @media (max-width: 768px) {
      .container { padding: 16px; }
      .charts-grid { grid-template-columns: 1fr; }
      .session-item { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🤖 Codex Insights Report</h1>
    <div class="subtitle">Generated on ${new Date().toLocaleString()} • Analyzing data from ~/.codex/</div>
  </div>
  
  <div class="container">
    <!-- Summary Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Sessions</div>
        <div class="stat-value">${formatNumber(stats.totalSessions)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Messages</div>
        <div class="stat-value green">${formatNumber(stats.totalMessages)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tool Calls</div>
        <div class="stat-value purple">${formatNumber(stats.totalToolCalls)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Tokens</div>
        <div class="stat-value orange">${formatNumber(stats.totalTokens)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Data Size</div>
        <div class="stat-value">${formatBytes(stats.totalSize)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Session Time</div>
        <div class="stat-value">${formatDuration(stats.avgDurationMs)}</div>
      </div>
    </div>
    
    <!-- Charts -->
    <div class="charts-grid">
      <div class="chart-container">
        <h3>📊 Activity Over Time</h3>
        <canvas id="activityChart"></canvas>
      </div>
      <div class="chart-container">
        <h3>🔧 Top Tools Used</h3>
        <canvas id="toolsChart"></canvas>
      </div>
    </div>
    
    <!-- Content Type Distribution -->
    <div class="section">
      <div class="section-header">
        <h2>📈 Content Type Distribution</h2>
      </div>
      <div class="section-body">
        <div class="stats-grid" style="margin-bottom: 0;">
          <div class="stat-card">
            <div class="stat-label">Text Messages</div>
            <div class="stat-value">${formatNumber(stats.contentTypes?.text || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Code Blocks</div>
            <div class="stat-value green">${formatNumber(stats.contentTypes?.code || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Commands</div>
            <div class="stat-value purple">${formatNumber(stats.contentTypes?.command || 0)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Errors</div>
            <div class="stat-value" style="color: var(--accent-red)">${formatNumber(stats.contentTypes?.error || 0)}</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Tool Usage -->
    <div class="section">
      <div class="section-header">
        <h2>🛠️ Tool Usage Breakdown</h2>
        <span class="badge badge-blue">${Object.keys(toolCounts).length} unique tools</span>
      </div>
      <div class="section-body">
        <div class="tool-list">
          ${topTools.map(([name, count]) => `
            <div class="tool-tag">${name}<span class="count">${count}</span></div>
          `).join('')}
        </div>
      </div>
    </div>
    
    <!-- Key Insights -->
    <div class="section">
      <div class="section-header">
        <h2>💡 Key Insights</h2>
      </div>
      <div class="section-body">
        <ul class="insights-list">
          <li>Most active day: <strong>${stats.mostActiveDay || 'N/A'}</strong> with ${stats.mostActiveDaySessions || 0} sessions</li>
          <li>Most used model: <strong>${stats.mostUsedModel || 'Unknown'}</strong></li>
          <li>Average messages per session: <strong>${Math.round(stats.totalMessages / Math.max(stats.totalSessions, 1) * 10) / 10}</strong></li>
          <li>Structured log sessions: <strong>${stats.structuredLogSessions || 0}</strong> (modern format)</li>
          <li>Most common working directory: <strong>${stats.mostCommonProject || 'Various'}</strong></li>
        </ul>
      </div>
    </div>
    
    <!-- Session List -->
    <div class="section">
      <div class="section-header">
        <h2>📋 Recent Sessions</h2>
        <span class="badge badge-green">${sessions.length} parsed</span>
      </div>
      <div class="section-body">
        <div class="session-list">
          ${sessions.slice(0, 50).map(session => `
            <div class="session-item">
              <div class="session-info">
                <h3>${session.title}</h3>
                <div class="session-meta">
                  ${formatDate(session.createdAt)} • 
                  ${session.projectPath ? `📁 ${path.basename(session.projectPath)}` : '📁 No project'} • 
                  ${session.model || 'Unknown model'} •
                  ${session.isStructuredLog ? '<span class="badge badge-purple">Structured</span>' : '<span class="badge badge-orange">Legacy</span>'}
                </div>
              </div>
              <div class="session-stats">
                <div class="session-stat">
                  <div class="value">${formatNumber(session.stats?.totalMessages)}</div>
                  <div class="label">Messages</div>
                </div>
                <div class="session-stat">
                  <div class="value">${formatNumber(session.stats?.toolCalls)}</div>
                  <div class="label">Tools</div>
                </div>
                <div class="session-stat">
                  <div class="value">${formatDuration(session.stats?.durationMs)}</div>
                  <div class="label">Duration</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        ${sessions.length > 50 ? `
          <div class="empty-state">
            <p>... and ${sessions.length - 50} more sessions</p>
          </div>
        ` : ''}
      </div>
    </div>
    
    <!-- Errors Section -->
    ${errors.length > 0 ? `
      <div class="section errors-section">
        <div class="section-header">
          <h2>⚠️ Parse Errors</h2>
          <span class="badge" style="background: var(--accent-red); color: white;">${errors.length} issues</span>
        </div>
        <div class="section-body">
          ${errors.slice(0, 10).map(err => `
            <div class="error-item">
              <strong>${path.basename(err.path)}:</strong> ${err.error}
            </div>
          `).join('')}
          ${errors.length > 10 ? `<div class="error-item">... and ${errors.length - 10} more errors</div>` : ''}
        </div>
      </div>
    ` : ''}
    
    <!-- Data Discovery -->
    <div class="section">
      <div class="section-header">
        <h2>🔍 Data Discovery Summary</h2>
      </div>
      <div class="section-body">
        <ul class="insights-list">
          <li>Codex home directory: <code>~/.codex/</code></li>
          <li>Session files found: <strong>${stats.totalFiles || 0}</strong></li>
          <li>Archived sessions: <strong>${stats.archivedCount || 0}</strong></li>
          <li>Active sessions: <strong>${stats.activeCount || 0}</strong></li>
          <li>Total data size: <strong>${formatBytes(stats.totalSize)}</strong></li>
          ${stats.dataQuality ? `<li>Data quality: <strong>${stats.dataQuality}</strong></li>` : ''}
        </ul>
      </div>
    </div>
  </div>
  
  <script>
    // Activity Chart
    const activityCtx = document.getElementById('activityChart').getContext('2d');
    new Chart(activityCtx, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(sortedDates.slice(-30))},
        datasets: [{
          label: 'Sessions',
          data: ${JSON.stringify(sortedDates.slice(-30).map(d => dailyActivity[d]?.sessions || 0))},
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.1)',
          tension: 0.4,
          fill: true
        }, {
          label: 'Messages',
          data: ${JSON.stringify(sortedDates.slice(-30).map(d => dailyActivity[d]?.messages || 0))},
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63, 185, 80, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#e6edf3' } }
        },
        scales: {
          x: { ticks: { color: '#7d8590' }, grid: { color: '#30363d' } },
          y: { ticks: { color: '#7d8590' }, grid: { color: '#30363d' } }
        }
      }
    });
    
    // Tools Chart
    const toolsCtx = document.getElementById('toolsChart').getContext('2d');
    new Chart(toolsCtx, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(topTools.map(t => t[0]))},
        datasets: [{
          label: 'Calls',
          data: ${JSON.stringify(topTools.map(t => t[1]))},
          backgroundColor: ['#58a6ff', '#3fb950', '#a371f7', '#d29922', '#f85149', '#79c0ff', '#56d364', '#d2a8ff'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { ticks: { color: '#7d8590' }, grid: { color: '#30363d' } },
          y: { ticks: { color: '#7d8590' }, grid: { color: '#30363d' } }
        }
      }
    });
  </script>
</body>
</html>`;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔍 Scanning ~/.codex/ for session files...');
  
  // Find all session files
  const sessionFiles = await findAllSessionFiles();
  console.log(`📁 Found ${sessionFiles.length} session files`);
  
  // Parse all sessions
  const sessions = [];
  const errors = [];
  
  for (let i = 0; i < sessionFiles.length; i++) {
    const file = sessionFiles[i];
    if (i % 10 === 0) {
      process.stdout.write(`\r⏳ Parsing ${i + 1}/${sessionFiles.length} files...`);
    }
    
    const result = await parseSessionFile(file);
    if (result.success) {
      sessions.push(result.session);
    } else {
      errors.push(result);
    }
  }
  console.log(`\r✅ Parsed ${sessions.length} sessions successfully`);
  if (errors.length > 0) {
    console.log(`⚠️ ${errors.length} files had parse errors`);
  }
  
  // Calculate aggregate stats
  const stats = {
    totalSessions: sessions.length,
    totalFiles: sessionFiles.length,
    totalMessages: 0,
    totalToolCalls: 0,
    totalTokens: 0,
    totalSize: 0,
    avgDurationMs: 0,
    contentTypes: { text: 0, code: 0, command: 0, error: 0, image: 0 },
    archivedCount: sessionFiles.filter(f => f.includes('archived')).length,
    activeCount: sessionFiles.filter(f => f.includes('/sessions/')).length,
    structuredLogSessions: sessions.filter(s => s.isStructuredLog).length
  };
  
  // Project and model tracking
  const projectCounts = {};
  const modelCounts = {};
  const dailySessions = {};
  
  let totalDuration = 0;
  let durationCount = 0;
  
  for (const session of sessions) {
    stats.totalMessages += session.stats?.totalMessages || 0;
    stats.totalToolCalls += session.stats?.toolCalls || 0;
    stats.totalTokens += session.stats?.tokenUsage?.total || 0;
    stats.totalSize += session.size || 0;
    
    // Content types
    const ct = session.stats?.contentTypes || {};
    stats.contentTypes.text += ct.text || 0;
    stats.contentTypes.code += ct.code || 0;
    stats.contentTypes.command += ct.command || 0;
    stats.contentTypes.error += ct.error || 0;
    
    // Duration
    if (session.stats?.durationMs > 0) {
      totalDuration += session.stats.durationMs;
      durationCount++;
    }
    
    // Project
    if (session.projectPath) {
      const proj = path.basename(session.projectPath);
      projectCounts[proj] = (projectCounts[proj] || 0) + 1;
    }
    
    // Model
    if (session.model) {
      modelCounts[session.model] = (modelCounts[session.model] || 0) + 1;
    }
    
    // Daily activity
    const date = session.createdAt?.split('T')[0];
    if (date) {
      dailySessions[date] = (dailySessions[date] || 0) + 1;
    }
  }
  
  stats.avgDurationMs = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
  
  // Find most active day
  const sortedDays = Object.entries(dailySessions).sort((a, b) => b[1] - a[1]);
  stats.mostActiveDay = sortedDays[0]?.[0];
  stats.mostActiveDaySessions = sortedDays[0]?.[1];
  
  // Find most common project
  const sortedProjects = Object.entries(projectCounts).sort((a, b) => b[1] - a[1]);
  stats.mostCommonProject = sortedProjects[0]?.[0];
  
  // Find most used model
  const sortedModels = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);
  stats.mostUsedModel = sortedModels[0]?.[0];
  
  // Sort sessions by date
  sessions.sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });
  
  // Generate HTML
  console.log('🎨 Generating HTML report...');
  const html = generateHTML(sessions, stats, errors);
  
  // Write output
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, html);
  console.log(`✅ Report written to: ${OUTPUT_FILE}`);
  console.log(`📊 Summary:`);
  console.log(`   • ${stats.totalSessions} sessions analyzed`);
  console.log(`   • ${stats.totalMessages} total messages`);
  console.log(`   • ${stats.totalToolCalls} tool calls`);
  console.log(`   • ${formatBytes(stats.totalSize)} of data`);
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
