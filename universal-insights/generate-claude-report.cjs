#!/usr/bin/env node
/**
 * Claude Code Insights Report Generator
 * Uses the universal-session-adapter to parse Claude Code sessions
 * and generates a beautiful HTML report with statistics and visualizations.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================
const CLAUDE_PROJECTS_DIR = path.join(process.env.HOME || '~', '.claude', 'projects');
const REPORT_OUTPUT_PATH = path.join(process.env.HOME || '~', 'Desktop', 'agent-skills', 'universal-insights', 'reports', 'claude-insights.html');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// ============================================================================
// DATA EXTRACTION
// ============================================================================

/**
 * Parse a single JSONL file and extract session data
 */
function parseJSONLFile(filePath) {
  const entries = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const entry = JSON.parse(line);
      entries.push({
        entry,
        line: i + 1
      });
    } catch (err) {
      // Skip corrupted lines
    }
  }
  
  return entries;
}

/**
 * Determine message role from content
 */
function getMessageRole(content, type) {
  if (type === 'queue-operation') return 'system';
  if (content?.startsWith('/') || content?.startsWith('$')) return 'system';
  if (type === 'user' || type === 'prompt') return 'user';
  if (type === 'assistant') return 'assistant';
  if (type === 'tool_use' || type === 'tool_result') return 'tool';
  return 'assistant';
}

/**
 * Determine content type
 */
function getContentType(content, type) {
  if (type === 'tool_use' || type === 'tool_result') return 'tool_call';
  if (content?.startsWith('/') || content?.startsWith('$')) return 'command';
  if (/error|exception|failed|stack trace/i.test(content || '')) return 'error';
  if (/```[\w]*\n/.test(content || '')) return 'code';
  return 'text';
}

/**
 * Extract tool name from tool use content
 */
function extractToolName(content) {
  if (!content) return null;
  
  // Try to extract tool name from various patterns
  const patterns = [
    /"name":"([^"]+)"/,  // JSON tool_use
    /^([A-Z][a-zA-Z]+)::/,  // Tool:: format
    /tool[:\s]+([A-Z][a-zA-Z]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

/**
 * Scan all session files and extract metadata
 */
function scanClaudeSessions() {
  console.log(`${colors.cyan}Scanning Claude sessions...${colors.reset}`);
  
  if (!fs.existsSync(CLAUDE_PROJECTS_DIR)) {
    console.log(`${colors.red}Claude projects directory not found: ${CLAUDE_PROJECTS_DIR}${colors.reset}`);
    return null;
  }
  
  const sessions = [];
  const projectGroups = new Map();
  const toolUsage = new Map();
  let totalMessages = 0;
  let totalErrors = 0;
  let totalCommands = 0;
  let totalCodeBlocks = 0;
  
  // Find all JSONL files recursively
  function findJSONLFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findJSONLFiles(fullPath, files);
      } else if (entry.name.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
    return files;
  }
  
  const jsonlFiles = findJSONLFiles(CLAUDE_PROJECTS_DIR);
  console.log(`${colors.green}Found ${jsonlFiles.length} session files${colors.reset}`);
  
  for (const filePath of jsonlFiles) {
    try {
      const entries = parseJSONLFile(filePath);
      if (entries.length === 0) continue;
      
      const sessionId = path.basename(filePath, '.jsonl');
      const relativePath = path.relative(CLAUDE_PROJECTS_DIR, filePath);
      const projectPath = relativePath.split(path.sep)[0];
      
      // Extract timestamps
      const timestamps = [];
      const messages = [];
      let userMsgCount = 0;
      let assistantMsgCount = 0;
      let errorCount = 0;
      let commandCount = 0;
      let codeBlockCount = 0;
      let firstPrompt = '';
      
      for (const { entry } of entries) {
        // Get timestamp
        let ts = null;
        if (entry.timestamp) {
          if (typeof entry.timestamp === 'number') {
            ts = entry.timestamp;
          } else if (typeof entry.timestamp === 'string') {
            ts = new Date(entry.timestamp).getTime();
          }
        }
        if (ts && !isNaN(ts)) {
          timestamps.push(ts);
        }
        
        // Get content - handle both string and array/object formats
        let content = '';
        if (entry.display) {
          content = typeof entry.display === 'string' ? entry.display : JSON.stringify(entry.display);
        } else if (entry.message?.content) {
          content = typeof entry.message.content === 'string' ? entry.message.content : JSON.stringify(entry.message.content);
        } else if (entry.content) {
          content = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
        } else if (entry.text) {
          content = typeof entry.text === 'string' ? entry.text : JSON.stringify(entry.text);
        }
        
        // Extract first prompt
        if (!firstPrompt && content && content.length > 10 && !content.startsWith('/')) {
          firstPrompt = content.substring(0, 100);
        }
        
        // Determine role and type
        const role = getMessageRole(content, entry.type);
        const contentType = getContentType(content, entry.type);
        
        if (role === 'user') userMsgCount++;
        if (role === 'assistant') assistantMsgCount++;
        if (contentType === 'error') errorCount++;
        if (contentType === 'command') commandCount++;
        
        // Count code blocks
        if (content) {
          const codeMatches = content.match(/```[\w]*\n[\s\S]*?```/g);
          if (codeMatches) codeBlockCount += codeMatches.length;
        }
        
        // Extract tool usage
        if (entry.type === 'tool_use' || entry.message?.content?.some?.(c => c.type === 'tool_use')) {
          const toolName = extractToolName(JSON.stringify(entry));
          if (toolName) {
            toolUsage.set(toolName, (toolUsage.get(toolName) || 0) + 1);
          }
        }
        
        messages.push({
          role,
          contentType,
          content: content?.substring(0, 200) || '',
          timestamp: ts
        });
      }
      
      // Calculate session stats
      const validTimestamps = timestamps.filter(t => !isNaN(t));
      const minTs = validTimestamps.length > 0 ? Math.min(...validTimestamps) : null;
      const maxTs = validTimestamps.length > 0 ? Math.max(...validTimestamps) : null;
      const durationMs = minTs && maxTs ? maxTs - minTs : 0;
      
      const session = {
        id: sessionId,
        projectPath: projectPath.replace(/^-Users-/, ''), // Clean up path
        filePath: filePath,
        messageCount: entries.length,
        userMessageCount: userMsgCount,
        assistantMessageCount: assistantMsgCount,
        durationMs: durationMs,
        durationHours: durationMs / (1000 * 60 * 60),
        createdAt: minTs ? new Date(minTs).toISOString() : null,
        updatedAt: maxTs ? new Date(maxTs).toISOString() : null,
        firstPrompt: firstPrompt,
        errorCount: errorCount,
        commandCount: commandCount,
        codeBlockCount: codeBlockCount,
        messages: messages.slice(0, 20) // Keep first 20 messages for display
      };
      
      sessions.push(session);
      
      // Aggregate by project
      if (!projectGroups.has(session.projectPath)) {
        projectGroups.set(session.projectPath, {
          name: session.projectPath,
          sessionCount: 0,
          totalMessages: 0,
          totalDuration: 0,
          lastActivity: null
        });
      }
      
      const project = projectGroups.get(session.projectPath);
      project.sessionCount++;
      project.totalMessages += session.messageCount;
      project.totalDuration += session.durationMs;
      if (session.updatedAt && (!project.lastActivity || new Date(session.updatedAt) > new Date(project.lastActivity))) {
        project.lastActivity = session.updatedAt;
      }
      
      // Update totals
      totalMessages += session.messageCount;
      totalErrors += errorCount;
      totalCommands += commandCount;
      totalCodeBlocks += codeBlockCount;
      
    } catch (err) {
      console.log(`${colors.yellow}Warning: Could not parse ${filePath}: ${err.message}${colors.reset}`);
    }
  }
  
  // Sort sessions by date (newest first)
  sessions.sort((a, b) => {
    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bTime - aTime;
  });
  
  // Calculate date range
  const allTimestamps = sessions
    .filter(s => s.createdAt)
    .map(s => new Date(s.createdAt).getTime());
  
  const dateRange = {
    start: allTimestamps.length > 0 ? new Date(Math.min(...allTimestamps)) : null,
    end: allTimestamps.length > 0 ? new Date(Math.max(...allTimestamps)) : null
  };
  
  // Calculate total hours
  const totalDurationMs = sessions.reduce((sum, s) => sum + s.durationMs, 0);
  const totalHours = totalDurationMs / (1000 * 60 * 60);
  
  // Convert project groups to array and sort by activity
  const projects = Array.from(projectGroups.values())
    .sort((a, b) => b.totalMessages - a.totalMessages);
  
  // Top tools
  const topTools = Array.from(toolUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  return {
    sessions,
    projects,
    stats: {
      totalSessions: sessions.length,
      totalMessages,
      totalErrors,
      totalCommands,
      totalCodeBlocks,
      totalHours: Math.round(totalHours * 10) / 10,
      avgMessagesPerSession: sessions.length > 0 ? Math.round(totalMessages / sessions.length) : 0,
      dateRange,
      toolUsage: topTools
    }
  };
}

// ============================================================================
// HTML GENERATION
// ============================================================================

function generateHTML(data) {
  const { sessions, projects, stats } = data;
  
  // Format date range
  const dateRangeStr = stats.dateRange.start && stats.dateRange.end
    ? `${stats.dateRange.start.toLocaleDateString()} - ${stats.dateRange.end.toLocaleDateString()}`
    : 'N/A';
  
  // Generate tool usage chart data
  const toolLabels = stats.toolUsage.map(([name]) => name).join(', ');
  const toolValues = stats.toolUsage.map(([, count]) => count).join(', ');
  const maxToolValue = Math.max(...stats.toolUsage.map(([, count]) => count), 1);
  
  // Generate project list HTML
  const projectListHTML = projects.slice(0, 10).map((project, index) => `
    <div class="project-card" style="--rank: ${index}">
      <div class="project-rank">#${index + 1}</div>
      <div class="project-info">
        <div class="project-name">${escapeHtml(project.name)}</div>
        <div class="project-stats">
          <span>${project.sessionCount} sessions</span>
          <span>${project.totalMessages.toLocaleString()} messages</span>
          ${project.lastActivity ? `<span>Last: ${formatDate(project.lastActivity)}</span>` : ''}
        </div>
      </div>
      <div class="project-bar" style="width: ${(project.totalMessages / projects[0].totalMessages * 100).toFixed(1)}%"></div>
    </div>
  `).join('');
  
  // Generate recent sessions table HTML
  const recentSessionsHTML = sessions.slice(0, 20).map(session => `
    <tr>
      <td class="session-id">${session.id.substring(0, 8)}...</td>
      <td class="project-name">${escapeHtml(session.projectPath)}</td>
      <td class="message-count">${session.messageCount.toLocaleString()}</td>
      <td class="duration">${formatDuration(session.durationMs)}</td>
      <td class="date">${session.createdAt ? formatDate(session.createdAt) : 'N/A'}</td>
      <td class="preview" title="${escapeHtml(session.firstPrompt)}">${escapeHtml(session.firstPrompt.substring(0, 50))}${session.firstPrompt.length > 50 ? '...' : ''}</td>
    </tr>
  `).join('');
  
  // Generate tool usage bars
  const toolUsageHTML = stats.toolUsage.map(([name, count]) => `
    <div class="tool-item">
      <div class="tool-name">${escapeHtml(name)}</div>
      <div class="tool-bar-container">
        <div class="tool-bar" style="width: ${(count / maxToolValue * 100).toFixed(1)}%"></div>
        <span class="tool-count">${count}</span>
      </div>
    </div>
  `).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Insights</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --accent-primary: #58a6ff;
      --accent-secondary: #238636;
      --accent-tertiary: #da3633;
      --accent-warning: #d29922;
      --border-color: #30363d;
      --card-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }
    
    /* Header */
    header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
    }
    
    header h1 {
      font-size: 2rem;
      font-weight: 600;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    header h1::before {
      content: "◆";
      color: var(--accent-primary);
    }
    
    .subtitle {
      color: var(--text-secondary);
      margin-top: 0.5rem;
      font-size: 0.9rem;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 1.5rem;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--card-shadow);
    }
    
    .stat-icon {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: var(--text-primary);
    }
    
    .stat-label {
      color: var(--text-secondary);
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .stat-card.sessions { border-left: 3px solid var(--accent-primary); }
    .stat-card.messages { border-left: 3px solid var(--accent-secondary); }
    .stat-card.hours { border-left: 3px solid var(--accent-warning); }
    .stat-card.projects { border-left: 3px solid #a371f7; }
    .stat-card.errors { border-left: 3px solid var(--accent-tertiary); }
    .stat-card.commands { border-left: 3px solid #3fb950; }
    
    /* Main Grid */
    .main-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-bottom: 2rem;
    }
    
    @media (max-width: 1024px) {
      .main-grid {
        grid-template-columns: 1fr;
      }
    }
    
    /* Section Cards */
    .section-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
    }
    
    .section-header {
      background: var(--bg-tertiary);
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border-color);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .section-content {
      padding: 1.5rem;
    }
    
    /* Tool Usage */
    .tool-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .tool-item {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    
    .tool-name {
      width: 120px;
      font-size: 0.875rem;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .tool-bar-container {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    
    .tool-bar {
      height: 20px;
      background: linear-gradient(90deg, var(--accent-primary), #79c0ff);
      border-radius: 4px;
      transition: width 0.5s ease;
      min-width: 4px;
    }
    
    .tool-count {
      font-size: 0.875rem;
      color: var(--text-secondary);
      min-width: 30px;
    }
    
    /* Projects */
    .project-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      border-radius: 8px;
      margin-bottom: 0.5rem;
      background: var(--bg-tertiary);
      position: relative;
      overflow: hidden;
    }
    
    .project-bar {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      background: rgba(88, 166, 255, 0.1);
      transition: width 0.5s ease;
    }
    
    .project-rank {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--accent-primary);
      width: 40px;
      z-index: 1;
    }
    
    .project-info {
      flex: 1;
      z-index: 1;
    }
    
    .project-name {
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;
    }
    
    .project-stats {
      font-size: 0.75rem;
      color: var(--text-secondary);
      display: flex;
      gap: 1rem;
      margin-top: 0.25rem;
    }
    
    /* Sessions Table */
    .sessions-section {
      grid-column: 1 / -1;
    }
    
    .table-container {
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    
    th {
      text-align: left;
      padding: 0.75rem 1rem;
      color: var(--text-secondary);
      font-weight: 500;
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
    }
    
    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-primary);
    }
    
    tr:hover td {
      background: var(--bg-tertiary);
    }
    
    .session-id {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }
    
    .message-count {
      text-align: center;
      font-weight: 500;
    }
    
    .duration {
      color: var(--text-secondary);
    }
    
    .date {
      color: var(--text-secondary);
      white-space: nowrap;
    }
    
    .preview {
      max-width: 300px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-secondary);
    }
    
    /* Footer */
    footer {
      text-align: center;
      padding: 2rem;
      color: var(--text-secondary);
      font-size: 0.875rem;
      border-top: 1px solid var(--border-color);
    }
    
    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: var(--text-secondary);
    }
    
    .empty-state-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    
    /* Animations */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .stat-card, .section-card {
      animation: fadeIn 0.5s ease forwards;
    }
    
    .stat-card:nth-child(1) { animation-delay: 0.1s; }
    .stat-card:nth-child(2) { animation-delay: 0.2s; }
    .stat-card:nth-child(3) { animation-delay: 0.3s; }
    .stat-card:nth-child(4) { animation-delay: 0.4s; }
    .stat-card:nth-child(5) { animation-delay: 0.5s; }
    .stat-card:nth-child(6) { animation-delay: 0.6s; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Claude Code Insights</h1>
      <div class="subtitle">Generated on ${new Date().toLocaleString()} | Data range: ${dateRangeStr}</div>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card sessions">
        <div class="stat-icon">📁</div>
        <div class="stat-value">${stats.totalSessions.toLocaleString()}</div>
        <div class="stat-label">Total Sessions</div>
      </div>
      
      <div class="stat-card messages">
        <div class="stat-icon">💬</div>
        <div class="stat-value">${stats.totalMessages.toLocaleString()}</div>
        <div class="stat-label">Total Messages</div>
      </div>
      
      <div class="stat-card hours">
        <div class="stat-icon">⏱️</div>
        <div class="stat-value">${stats.totalHours.toFixed(1)}</div>
        <div class="stat-label">Total Hours</div>
      </div>
      
      <div class="stat-card projects">
        <div class="stat-icon">📂</div>
        <div class="stat-value">${projects.length.toLocaleString()}</div>
        <div class="stat-label">Projects</div>
      </div>
      
      <div class="stat-card commands">
        <div class="stat-icon">⚡</div>
        <div class="stat-value">${stats.totalCommands.toLocaleString()}</div>
        <div class="stat-label">Commands</div>
      </div>
      
      <div class="stat-card errors">
        <div class="stat-icon">⚠️</div>
        <div class="stat-value">${stats.totalErrors.toLocaleString()}</div>
        <div class="stat-label">Errors</div>
      </div>
    </div>
    
    <div class="main-grid">
      <div class="section-card">
        <div class="section-header">
          <span>🔧</span> Top Tool Usage
        </div>
        <div class="section-content">
          ${stats.toolUsage.length > 0 ? `
            <div class="tool-list">
              ${toolUsageHTML}
            </div>
          ` : '<div class="empty-state"><div class="empty-state-icon">📊</div>No tool usage data available</div>'}
        </div>
      </div>
      
      <div class="section-card">
        <div class="section-header">
          <span>📂</span> Top Projects
        </div>
        <div class="section-content">
          ${projectListHTML || '<div class="empty-state"><div class="empty-state-icon">📁</div>No projects found</div>'}
        </div>
      </div>
    </div>
    
    <div class="section-card sessions-section">
      <div class="section-header">
        <span>📋</span> Recent Sessions
      </div>
      <div class="section-content">
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Project</th>
                <th>Messages</th>
                <th>Duration</th>
                <th>Created</th>
                <th>First Prompt</th>
              </tr>
            </thead>
            <tbody>
              ${recentSessionsHTML || '<tr><td colspan="6" class="empty-state">No sessions found</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <footer>
      Generated by Claude Code Insights Reporter • ${sessions.length} sessions analyzed
    </footer>
  </div>
</body>
</html>`;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '-';
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  console.log(`${colors.bold}${colors.cyan}Claude Code Insights Report Generator${colors.reset}\n`);
  
  // Scan sessions
  const data = scanClaudeSessions();
  
  if (!data || data.sessions.length === 0) {
    console.log(`${colors.red}No sessions found. Exiting.${colors.reset}`);
    process.exit(1);
  }
  
  // Print summary
  console.log(`\n${colors.bold}Summary:${colors.reset}`);
  console.log(`  ${colors.green}✓${colors.reset} Sessions: ${data.stats.totalSessions}`);
  console.log(`  ${colors.green}✓${colors.reset} Messages: ${data.stats.totalMessages.toLocaleString()}`);
  console.log(`  ${colors.green}✓${colors.reset} Projects: ${data.projects.length}`);
  console.log(`  ${colors.green}✓${colors.reset} Total Hours: ${data.stats.totalHours.toFixed(1)}`);
  
  if (data.stats.toolUsage.length > 0) {
    console.log(`\n${colors.bold}Top Tools:${colors.reset}`);
    data.stats.toolUsage.slice(0, 5).forEach(([name, count]) => {
      console.log(`  • ${name}: ${count}`);
    });
  }
  
  // Generate HTML
  console.log(`\n${colors.cyan}Generating HTML report...${colors.reset}`);
  const html = generateHTML(data);
  
  // Ensure directory exists
  const reportDir = path.dirname(REPORT_OUTPUT_PATH);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Write report
  fs.writeFileSync(REPORT_OUTPUT_PATH, html, 'utf-8');
  
  console.log(`${colors.green}✓ Report saved to: ${REPORT_OUTPUT_PATH}${colors.reset}`);
  console.log(`\n${colors.bold}Open the report in your browser:${colors.reset}`);
  console.log(`  file://${REPORT_OUTPUT_PATH}`);
}

// Run
main();
