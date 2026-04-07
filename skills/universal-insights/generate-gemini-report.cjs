#!/usr/bin/env node
/**
 * Gemini CLI Insights Report Generator
 * 
 * Explores ~/.gemini/ for session data and generates an HTML report
 * with stats and session breakdown.
 */

const fs = require('fs');
const path = require('path');

const GEMINI_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '', '.gemini');
const OUTPUT_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Desktop/agent-skills/universal-insights/reports/gemini-insights.html');
const ADAPTER_PATH = path.join(process.env.HOME || process.env.USERPROFILE || '', 'universal-session-adapter/dist/adapters/gemini.js');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color] || ''}${message}${colors.reset}`);
}

// Check if universal adapter exists
function checkAdapter() {
  try {
    fs.accessSync(ADAPTER_PATH);
    return true;
  } catch {
    return false;
  }
}

// Load Gemini Adapter if available
async function loadAdapter() {
  if (!checkAdapter()) {
    log('Gemini adapter not found at ' + ADAPTER_PATH, 'yellow');
    return null;
  }
  
  try {
    const { GeminiAdapter } = require(ADAPTER_PATH);
    return new GeminiAdapter();
  } catch (err) {
    log(`Failed to load adapter: ${err.message}`, 'red');
    return null;
  }
}

// Explore ~/.gemini/ directory structure
function exploreGeminiDir() {
  const structure = {
    exists: false,
    historyExists: false,
    tmpExists: false,
    subdirs: [],
    jsonFiles: [],
    totalSize: 0
  };

  try {
    fs.accessSync(GEMINI_DIR);
    structure.exists = true;

    // Check for key subdirectories
    const historyDir = path.join(GEMINI_DIR, 'history');
    const tmpDir = path.join(GEMINI_DIR, 'tmp');

    try {
      fs.accessSync(historyDir);
      structure.historyExists = true;
      const entries = fs.readdirSync(historyDir, { withFileTypes: true });
      structure.historyCount = entries.filter(e => e.isDirectory()).length;
    } catch { /* no history */ }

    try {
      fs.accessSync(tmpDir);
      structure.tmpExists = true;
      const entries = fs.readdirSync(tmpDir, { withFileTypes: true });
      structure.tmpCount = entries.filter(e => e.isDirectory()).length;
    } catch { /* no tmp */ }

    // Find all JSON files
    function scanDir(dir, basePath = '') {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.join(basePath, entry.name);
          
          if (entry.isDirectory() && entry.name !== '.git') {
            scanDir(fullPath, relPath);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            const stats = fs.statSync(fullPath);
            structure.jsonFiles.push({
              path: relPath,
              size: stats.size,
              modified: stats.mtime
            });
            structure.totalSize += stats.size;
          }
        }
      } catch { /* skip */ }
    }

    scanDir(GEMINI_DIR);

  } catch {
    log('~/.gemini/ directory not found', 'red');
  }

  return structure;
}

// Find and parse session files
function findSessions() {
  const sessions = [];
  const tmpDir = path.join(GEMINI_DIR, 'tmp');

  try {
    const projectDirs = fs.readdirSync(tmpDir, { withFileTypes: true })
      .filter(e => e.isDirectory());

    for (const projDir of projectDirs) {
      const chatsDir = path.join(tmpDir, projDir.name, 'chats');
      
      try {
        fs.accessSync(chatsDir);
        const chatFiles = fs.readdirSync(chatsDir, { withFileTypes: true })
          .filter(e => e.isFile() && e.name.startsWith('session-') && e.name.endsWith('.json'));

        for (const chatFile of chatFiles) {
          const filePath = path.join(chatsDir, chatFile.name);
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(content);
            
            const stats = fs.statSync(filePath);
            sessions.push({
              ...data,
              fileName: chatFile.name,
              filePath: path.join(projDir.name, 'chats', chatFile.name),
              fileSize: stats.size,
              modified: stats.mtime,
              projectHash: projDir.name
            });
          } catch (err) {
            log(`Failed to parse ${chatFile.name}: ${err.message}`, 'yellow');
          }
        }
      } catch { /* no chats dir */ }
    }
  } catch (err) {
    log(`Error scanning sessions: ${err.message}`, 'red');
  }

  return sessions;
}

// Find logs files
function findLogs() {
  const logs = [];
  const tmpDir = path.join(GEMINI_DIR, 'tmp');

  try {
    const projectDirs = fs.readdirSync(tmpDir, { withFileTypes: true })
      .filter(e => e.isDirectory());

    for (const projDir of projectDirs) {
      const logsPath = path.join(tmpDir, projDir.name, 'logs.json');
      
      try {
        fs.accessSync(logsPath);
        const content = fs.readFileSync(logsPath, 'utf-8');
        const data = JSON.parse(content);
        const stats = fs.statSync(logsPath);
        
        logs.push({
          projectHash: projDir.name,
          entryCount: Array.isArray(data) ? data.length : 0,
          fileSize: stats.size,
          modified: stats.mtime
        });
      } catch { /* no logs */ }
    }
  } catch { /* no tmp */ }

  return logs;
}

// Calculate session statistics
function calculateStats(sessions) {
  if (sessions.length === 0) {
    return null;
  }

  const messageCounts = sessions.map(s => (s.messages || []).length);
  const totalMessages = messageCounts.reduce((a, b) => a + b, 0);
  
  const userMessages = sessions.map(s => 
    (s.messages || []).filter(m => m.type === 'user').length
  ).reduce((a, b) => a + b, 0);
  
  const modelMessages = sessions.map(s => 
    (s.messages || []).filter(m => m.type === 'model').length
  ).reduce((a, b) => a + b, 0);
  
  const errorMessages = sessions.map(s => 
    (s.messages || []).filter(m => m.type === 'error').length
  ).reduce((a, b) => a + b, 0);

  const dates = sessions
    .map(s => s.startTime ? new Date(s.startTime) : null)
    .filter(d => d && !isNaN(d));
  
  const oldestDate = dates.length > 0 ? new Date(Math.min(...dates)) : null;
  const newestDate = dates.length > 0 ? new Date(Math.max(...dates)) : null;

  const projectGroups = {};
  for (const s of sessions) {
    const hash = s.projectHash || 'unknown';
    if (!projectGroups[hash]) projectGroups[hash] = [];
    projectGroups[hash].push(s);
  }

  return {
    sessionCount: sessions.length,
    totalMessages,
    userMessages,
    modelMessages,
    errorMessages,
    avgMessagesPerSession: (totalMessages / sessions.length).toFixed(1),
    oldestSession: oldestDate,
    newestSession: newestDate,
    projectCount: Object.keys(projectGroups).length,
    totalSize: sessions.reduce((sum, s) => sum + (s.fileSize || 0), 0)
  };
}

// Generate HTML report
function generateHTML(structure, sessions, logs, stats, adapterUsed) {
  const now = new Date().toISOString();
  const hasData = sessions.length > 0;

  let sessionsHTML = '';
  if (hasData) {
    // Sort sessions by start time (newest first)
    const sortedSessions = [...sessions].sort((a, b) => {
      const da = a.startTime ? new Date(a.startTime) : new Date(0);
      const db = b.startTime ? new Date(b.startTime) : new Date(0);
      return db - da;
    });

    sessionsHTML = sortedSessions.map(s => {
      const msgCount = (s.messages || []).length;
      const userCount = (s.messages || []).filter(m => m.type === 'user').length;
      const modelCount = (s.messages || []).filter(m => m.type === 'model').length;
      const errorCount = (s.messages || []).filter(m => m.type === 'error').length;
      
      const startTime = s.startTime ? new Date(s.startTime).toLocaleString() : 'Unknown';
      const duration = s.startTime && s.lastUpdated 
        ? Math.round((new Date(s.lastUpdated) - new Date(s.startTime)) / 1000)
        : 0;

      return `
        <div class="session-card">
          <div class="session-header">
            <h3>${s.sessionId ? s.sessionId.slice(0, 8) : 'Unknown'}</h3>
            <span class="badge ${msgCount > 0 ? 'active' : 'empty'}">${msgCount} messages</span>
          </div>
          <div class="session-meta">
            <div><strong>Project:</strong> ${s.projectHash ? s.projectHash.slice(0, 16) : 'Unknown'}...</div>
            <div><strong>Started:</strong> ${startTime}</div>
            <div><strong>Duration:</strong> ${duration}s</div>
            <div><strong>Size:</strong> ${(s.fileSize / 1024).toFixed(1)} KB</div>
          </div>
          <div class="message-breakdown">
            <span class="msg-tag user">${userCount} user</span>
            <span class="msg-tag model">${modelCount} model</span>
            ${errorCount > 0 ? `<span class="msg-tag error">${errorCount} errors</span>` : ''}
          </div>
          <div class="file-path">${s.filePath || 'N/A'}</div>
        </div>
      `;
    }).join('');
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gemini CLI Insights Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      line-height: 1.6;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      background: linear-gradient(135deg, #1f6feb 0%, #388bfd 100%);
      padding: 40px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    header h1 {
      font-size: 2.5em;
      color: #fff;
      margin-bottom: 10px;
    }
    header p {
      color: rgba(255,255,255,0.8);
      font-size: 1.1em;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: 600;
    }
    .badge.active { background: #238636; color: #fff; }
    .badge.empty { background: #30363d; color: #8b949e; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 24px;
      text-align: center;
      transition: transform 0.2s, border-color 0.2s;
    }
    .stat-card:hover {
      transform: translateY(-4px);
      border-color: #58a6ff;
    }
    .stat-value {
      font-size: 2.5em;
      font-weight: 700;
      color: #58a6ff;
      margin-bottom: 8px;
    }
    .stat-label {
      color: #8b949e;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .section {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 10px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section h2 {
      color: #f0f6fc;
      font-size: 1.4em;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #30363d;
    }
    .directory-structure {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.9em;
      background: #0d1117;
      padding: 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    .directory-structure .dir { color: #58a6ff; }
    .directory-structure .file { color: #a371f7; }
    .sessions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 20px;
    }
    .session-card {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
      transition: border-color 0.2s;
    }
    .session-card:hover {
      border-color: #1f6feb;
    }
    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .session-header h3 {
      font-family: monospace;
      color: #f0f6fc;
      font-size: 1.1em;
    }
    .session-meta {
      font-size: 0.85em;
      color: #8b949e;
      margin-bottom: 12px;
    }
    .session-meta div { margin-bottom: 4px; }
    .message-breakdown {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .msg-tag {
      font-size: 0.75em;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .msg-tag.user { background: #1f6feb; color: #fff; }
    .msg-tag.model { background: #238636; color: #fff; }
    .msg-tag.error { background: #da3633; color: #fff; }
    .file-path {
      font-family: monospace;
      font-size: 0.75em;
      color: #6e7681;
      word-break: break-all;
    }
    .no-data {
      text-align: center;
      padding: 60px 20px;
      color: #8b949e;
    }
    .no-data h3 {
      font-size: 1.5em;
      margin-bottom: 16px;
      color: #f0f6fc;
    }
    .adapter-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 0.85em;
    }
    .adapter-status.used {
      background: #238636;
      color: #fff;
    }
    .adapter-status.not-used {
      background: #9e8c6a;
      color: #000;
    }
    .discovery-note {
      background: #0d1117;
      border-left: 4px solid #1f6feb;
      padding: 16px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .discovery-note h4 {
      color: #58a6ff;
      margin-bottom: 8px;
    }
    footer {
      text-align: center;
      padding: 20px;
      color: #6e7681;
      font-size: 0.85em;
      border-top: 1px solid #30363d;
      margin-top: 40px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔮 Gemini CLI Insights</h1>
      <p>Session data analysis report generated on ${new Date().toLocaleString()}</p>
      <div style="margin-top: 16px;">
        <span class="adapter-status ${adapterUsed ? 'used' : 'not-used'}">
          ${adapterUsed ? '✓ Universal Adapter Used' : '⚠ Built-in Parser Used'}
        </span>
      </div>
    </header>

    ${hasData ? `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${stats.sessionCount}</div>
        <div class="stat-label">Total Sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.totalMessages}</div>
        <div class="stat-label">Total Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.avgMessagesPerSession}</div>
        <div class="stat-label">Avg Messages/Session</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.projectCount}</div>
        <div class="stat-label">Projects</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${(stats.totalSize / 1024 / 1024).toFixed(2)}</div>
        <div class="stat-label">Data Size (MB)</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.errorMessages}</div>
        <div class="stat-label">Error Messages</div>
      </div>
    </div>

    <div class="section">
      <h2>📊 Data Discovery Summary</h2>
      <div class="discovery-note">
        <h4>Data Sources Found:</h4>
        <p><strong>~/.gemini/tmp/*/chats/session-*.json</strong> - Contains ${sessions.length} chat session files with message history</p>
        <p><strong>~/.gemini/tmp/*/logs.json</strong> - Contains ${logs.length} log files with command history</p>
        <p><strong>~/.gemini/history/</strong> - Contains ${structure.historyCount || 0} project directories (git-based session tracking)</p>
        <p><strong>~/.gemini/settings.json</strong> - User preferences and MCP server configuration</p>
        <p><strong>~/.gemini/projects.json</strong> - Project path mappings</p>
      </div>
      
      <h3 style="margin-top: 20px; color: #f0f6fc;">Session Time Range</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 12px;">
        <div style="background: #0d1117; padding: 16px; border-radius: 8px;">
          <div style="color: #8b949e; font-size: 0.85em;">Oldest Session</div>
          <div style="color: #f0f6fc; font-size: 1.2em; margin-top: 4px;">
            ${stats.oldestSession ? stats.oldestSession.toLocaleString() : 'N/A'}
          </div>
        </div>
        <div style="background: #0d1117; padding: 16px; border-radius: 8px;">
          <div style="color: #8b949e; font-size: 0.85em;">Newest Session</div>
          <div style="color: #f0f6fc; font-size: 1.2em; margin-top: 4px;">
            ${stats.newestSession ? stats.newestSession.toLocaleString() : 'N/A'}
          </div>
        </div>
      </div>

      <h3 style="margin-top: 20px; color: #f0f6fc;">Message Breakdown</h3>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 12px;">
        <div style="background: #0d1117; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.8em; color: #1f6feb;">${stats.userMessages}</div>
          <div style="color: #8b949e; font-size: 0.85em;">User Messages</div>
        </div>
        <div style="background: #0d1117; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.8em; color: #238636;">${stats.modelMessages}</div>
          <div style="color: #8b949e; font-size: 0.85em;">Model Responses</div>
        </div>
        <div style="background: #0d1117; padding: 16px; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.8em; color: #da3633;">${stats.errorMessages}</div>
          <div style="color: #8b949e; font-size: 0.85em;">Errors</div>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>📁 Directory Structure</h2>
      <div class="directory-structure">
<span class="dir">~/.gemini/</span><br>
├── <span class="dir">history/</span> - ${structure.historyCount || 0} project directories<br>
│   └── (git repositories for project context)<br>
├── <span class="dir">tmp/</span> - ${structure.tmpCount || 0} temp directories<br>
│   └── <span class="dir">[project-hash]/</span><br>
│       ├── <span class="dir">chats/</span> - Session JSON files<br>
│       │   └── <span class="file">session-YYYY-MM-DD...json</span><br>
│       └── <span class="file">logs.json</span> - Command history<br>
├── <span class="file">settings.json</span> - User preferences<br>
├── <span class="file">projects.json</span> - Project mappings<br>
├── <span class="file">state.json</span> - Application state<br>
└── <span class="file">oauth_creds.json</span> - Auth tokens
      </div>
    </div>

    <div class="section">
      <h2>💬 Session Breakdown (${sessions.length} sessions)</h2>
      <div class="sessions-grid">
        ${sessionsHTML}
      </div>
    </div>
    ` : `
    <div class="no-data">
      <h3>No Gemini CLI Session Data Found</h3>
      <p>The ~/.gemini/ directory was searched but no session files were found.</p>
      <div class="section" style="margin-top: 30px; text-align: left;">
        <h2>Search Locations</h2>
        <div class="directory-structure">
<span class="dir">~/.gemini/</span> - ${structure.exists ? 'EXISTS' : 'NOT FOUND'}<br>
├── <span class="dir">history/</span> - ${structure.historyExists ? 'EXISTS' : 'NOT FOUND'}<br>
├── <span class="dir">tmp/</span> - ${structure.tmpExists ? 'EXISTS' : 'NOT FOUND'}<br>
└── <span class="file">*.json</span> - ${structure.jsonFiles.length} files found
        </div>
        
        <h3 style="margin-top: 20px;">About Gemini CLI Session Storage</h3>
        <p style="margin-top: 12px; color: #8b949e;">
          Gemini CLI stores session data differently than other AI assistants. The key locations are:
        </p>
        <ul style="margin: 12px 0 0 20px; color: #8b949e;">
          <li><strong>~/.gemini/tmp/[project-hash]/chats/</strong> - Contains session-*.json files with message history</li>
          <li><strong>~/.gemini/tmp/[project-hash]/logs.json</strong> - Contains command history entries</li>
          <li><strong>~/.gemini/history/</strong> - Git repositories tracking project state</li>
          <li><strong>~/.gemini/settings.json</strong> - User configuration including MCP servers</li>
        </ul>
        <p style="margin-top: 12px; color: #8b949e;">
          If you have never used Gemini CLI or have cleared its data, these directories may be empty.
        </p>
      </div>
    </div>
    `}

    <footer>
      <p>Generated by Gemini CLI Insights Report Generator</p>
      <p style="margin-top: 4px;">${now}</p>
    </footer>
  </div>
</body>
</html>`;
}

// Main execution
async function main() {
  log('🔮 Gemini CLI Insights Report Generator', 'blue');
  log('='.repeat(50), 'blue');
  
  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    log(`Created output directory: ${outputDir}`, 'green');
  }

  // Explore directory structure
  log('\n📁 Exploring ~/.gemini/ directory...', 'blue');
  const structure = exploreGeminiDir();
  
  if (!structure.exists) {
    log('~/.gemini/ directory does not exist!', 'red');
  } else {
    log(`✓ Found ${structure.jsonFiles.length} JSON files`, 'green');
    log(`✓ History directory: ${structure.historyExists ? 'EXISTS' : 'NOT FOUND'}`, structure.historyExists ? 'green' : 'yellow');
    log(`✓ Tmp directory: ${structure.tmpExists ? 'EXISTS' : 'NOT FOUND'}`, structure.tmpExists ? 'green' : 'yellow');
  }

  // Try to load adapter
  log('\n🔌 Loading Gemini adapter...', 'blue');
  const adapter = await loadAdapter();
  let adapterUsed = false;
  
  if (adapter) {
    log(`✓ Loaded ${adapter.name}`, 'green');
    adapterUsed = true;
  } else {
    log('⚠ Using built-in parser (adapter not available)', 'yellow');
  }

  // Find sessions
  log('\n🔍 Scanning for session files...', 'blue');
  const sessions = findSessions();
  log(`✓ Found ${sessions.length} sessions`, 'green');

  // Find logs
  log('\n📝 Scanning for log files...', 'blue');
  const logs = findLogs();
  log(`✓ Found ${logs.length} log files`, 'green');

  // Calculate stats
  const stats = calculateStats(sessions);
  if (stats) {
    log('\n📊 Statistics:', 'blue');
    log(`  - Sessions: ${stats.sessionCount}`, 'reset');
    log(`  - Total Messages: ${stats.totalMessages}`, 'reset');
    log(`  - Projects: ${stats.projectCount}`, 'reset');
    log(`  - Data Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`, 'reset');
  }

  // Generate HTML
  log('\n🎨 Generating HTML report...', 'blue');
  const html = generateHTML(structure, sessions, logs, stats, adapterUsed);
  
  fs.writeFileSync(OUTPUT_PATH, html, 'utf-8');
  log(`✓ Report saved to: ${OUTPUT_PATH}`, 'green');

  log('\n✅ Done!', 'green');
  log(`\nOpen the report:`, 'blue');
  log(`  file://${OUTPUT_PATH}`, 'reset');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
