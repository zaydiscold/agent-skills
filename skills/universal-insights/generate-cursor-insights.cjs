#!/usr/bin/env node
/**
 * Cursor Insights Report Generator
 * 
 * This script:
 * 1. Searches for Cursor data at ~/.cursor/chats/ and ~/.cursor/
 * 2. Parses any found SQLite store.db files using blob-based format
 * 3. Generates an HTML report at ~/Desktop/agent-skills/universal-insights/reports/cursor-insights.html
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CURSOR_DIR = path.join(process.env.HOME, '.cursor');
const CHATS_DIR = path.join(CURSOR_DIR, 'chats');
const REPORT_DIR = path.join(process.env.HOME, 'Desktop/agent-skills/universal-insights/reports');
const REPORT_PATH = path.join(REPORT_DIR, 'cursor-insights.html');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Recursively find all store.db files
 */
function findStoreDbFiles(dir, files = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        findStoreDbFiles(fullPath, files);
      } else if (entry.name === 'store.db') {
        files.push(fullPath);
      }
    }
  } catch (err) {
    // Directory doesn't exist or permission denied
  }
  
  return files;
}

/**
 * Read SQLite database and extract data using sqlite3 CLI
 */
function readSqliteDb(dbPath) {
  try {
    // Get all blob data
    const blobData = execSync(
      `sqlite3 "${dbPath}" "SELECT id, data FROM blobs;" 2>/dev/null`,
      { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 }
    );
    
    // Get meta data
    const metaData = execSync(
      `sqlite3 "${dbPath}" "SELECT key, value FROM meta;" 2>/dev/null`,
      { encoding: 'utf-8' }
    );
    
    return { blobData, metaData };
  } catch (err) {
    return null;
  }
}

/**
 * Parse blob data from SQLite output
 */
function parseBlobs(blobBuffer) {
  const messages = [];
  const lines = blobBuffer.toString('utf-8').split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Parse pipe-delimited output: id|data
    const pipeIndex = line.indexOf('|');
    if (pipeIndex === -1) continue;
    
    const id = line.substring(0, pipeIndex);
    const dataHex = line.substring(pipeIndex + 1);
    
    try {
      // Convert hex to string
      let content = '';
      if (dataHex.match(/^[0-9a-fA-F]+$/)) {
        // It's hex encoded
        const buf = Buffer.from(dataHex, 'hex');
        content = buf.toString('utf-8');
      } else {
        content = dataHex;
      }
      
      // Try to parse as JSON
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        // Not valid JSON, treat as text
        parsed = { role: 'unknown', content: content.substring(0, 500) };
      }
      
      // Ensure content is always a string
      let messageContent = parsed.content || parsed.text || parsed.message;
      if (typeof messageContent !== 'string') {
        messageContent = JSON.stringify(messageContent || parsed);
      }
      
      messages.push({
        id,
        role: parsed.role || parsed.type || 'unknown',
        content: messageContent,
        metadata: parsed.metadata || {},
        timestamp: parsed.timestamp || parsed.createdAt || Date.now()
      });
    } catch (err) {
      // Skip invalid entries
    }
  }
  
  return messages;
}

/**
 * Parse meta data from SQLite output
 */
function parseMeta(metaString) {
  const meta = {};
  const lines = metaString.split('\n');
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const pipeIndex = line.indexOf('|');
    if (pipeIndex === -1) continue;
    
    const key = line.substring(0, pipeIndex);
    let value = line.substring(pipeIndex + 1);
    
    // Try to decode hex if needed
    if (value.match(/^[0-9a-fA-F]+$/)) {
      try {
        value = Buffer.from(value, 'hex').toString('utf-8');
      } catch {
        // Keep original
      }
    }
    
    // Try to parse as JSON
    try {
      meta[key] = JSON.parse(value);
    } catch {
      meta[key] = value;
    }
  }
  
  return meta;
}

/**
 * Parse a single store.db file
 */
function parseStoreDb(dbPath) {
  const raw = readSqliteDb(dbPath);
  if (!raw) return null;
  
  const messages = parseBlobs(raw.blobData);
  const meta = parseMeta(raw.metaData);
  
  // Extract session info from path
  const pathParts = dbPath.split(path.sep);
  const chatId = pathParts[pathParts.length - 2] || 'unknown';
  const projectHash = pathParts[pathParts.length - 3] || 'unknown';
  
  return {
    path: dbPath,
    chatId,
    projectHash,
    meta,
    messages,
    stats: {
      messageCount: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant' || m.role === 'ai').length,
      systemMessages: messages.filter(m => m.role === 'system').length,
      otherMessages: messages.filter(m => !['user', 'assistant', 'ai', 'system'].includes(m.role)).length
    }
  };
}

/**
 * Format timestamp
 */
function formatTimestamp(ts) {
  if (!ts) return 'Unknown';
  try {
    const date = new Date(typeof ts === 'number' ? ts : parseInt(ts));
    return date.toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate HTML report
 */
function generateReport(sessions, searchedPaths, errors) {
  const totalSessions = sessions.length;
  const totalMessages = sessions.reduce((sum, s) => sum + s.stats.messageCount, 0);
  const totalUserMessages = sessions.reduce((sum, s) => sum + s.stats.userMessages, 0);
  const totalAssistantMessages = sessions.reduce((sum, s) => sum + s.stats.assistantMessages, 0);
  
  const hasData = totalSessions > 0;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cursor Insights Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
    }
    header h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    header p {
      opacity: 0.9;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      text-align: center;
    }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #667eea;
    }
    .stat-label {
      color: #666;
      font-size: 0.9em;
      margin-top: 5px;
    }
    .content {
      padding: 30px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      color: #667eea;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e0e0e0;
    }
    .session-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border-left: 4px solid #667eea;
    }
    .session-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .session-title {
      font-weight: bold;
      font-size: 1.1em;
      color: #333;
    }
    .session-meta {
      font-size: 0.85em;
      color: #666;
    }
    .message {
      background: white;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 10px;
      border-left: 3px solid #ddd;
    }
    .message.user {
      border-left-color: #4CAF50;
    }
    .message.assistant {
      border-left-color: #2196F3;
    }
    .message.system {
      border-left-color: #FF9800;
    }
    .message-header {
      font-weight: bold;
      margin-bottom: 8px;
      color: #555;
      font-size: 0.9em;
      text-transform: uppercase;
    }
    .message-content {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.9em;
      max-height: 200px;
      overflow-y: auto;
    }
    .message-content code {
      background: #f0f0f0;
      padding: 2px 4px;
      border-radius: 3px;
    }
    .no-data {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }
    .no-data h2 {
      color: #999;
      margin-bottom: 20px;
    }
    .searched-paths {
      background: #f0f0f0;
      padding: 15px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.9em;
      margin-top: 10px;
    }
    .searched-paths li {
      margin: 5px 0;
      list-style: none;
    }
    .recommendations {
      background: #fff3cd;
      border: 1px solid #ffc107;
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
    }
    .recommendations h3 {
      color: #856404;
      margin-bottom: 15px;
    }
    .recommendations ul {
      margin-left: 20px;
    }
    .recommendations li {
      margin: 8px 0;
      color: #856404;
    }
    .error-list {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 8px;
      padding: 15px;
      margin-top: 20px;
    }
    .error-list h3 {
      color: #721c24;
      margin-bottom: 10px;
    }
    .error-list li {
      color: #721c24;
      margin: 5px 0;
      font-family: monospace;
      font-size: 0.9em;
    }
    .timestamp {
      font-size: 0.8em;
      color: #999;
      margin-top: 5px;
    }
    .file-path {
      font-family: monospace;
      font-size: 0.85em;
      color: #666;
      background: #e9ecef;
      padding: 5px 10px;
      border-radius: 4px;
      display: inline-block;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Cursor Insights Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </header>
    
    ${hasData ? `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalSessions}</div>
        <div class="stat-label">Sessions Found</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalMessages}</div>
        <div class="stat-label">Total Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalUserMessages}</div>
        <div class="stat-label">User Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalAssistantMessages}</div>
        <div class="stat-label">Assistant Messages</div>
      </div>
    </div>
    
    <div class="content">
      <div class="section">
        <h2>Session Details</h2>
        ${sessions.map(session => `
          <div class="session-card">
            <div class="session-header">
              <div>
                <div class="session-title">${escapeHtml(session.meta.name || session.meta.agentId || 'Unnamed Session')}</div>
                <div class="file-path">${escapeHtml(session.path)}</div>
              </div>
              <div class="session-meta">
                ${session.stats.messageCount} messages · 
                ${session.stats.userMessages} user · 
                ${session.stats.assistantMessages} assistant
              </div>
            </div>
            ${session.messages.slice(0, 5).map(msg => `
              <div class="message ${escapeHtml(msg.role)}">
                <div class="message-header">${escapeHtml(msg.role)}</div>
                <div class="message-content">${escapeHtml(typeof msg.content === 'string' ? msg.content.substring(0, 300) : JSON.stringify(msg.content).substring(0, 300))}${typeof msg.content === 'string' && msg.content.length > 300 ? '...' : ''}</div>
                <div class="timestamp">${formatTimestamp(msg.timestamp)}</div>
              </div>
            `).join('')}
            ${session.messages.length > 5 ? `<div style="text-align: center; color: #999; padding: 10px;">... and ${session.messages.length - 5} more messages</div>` : ''}
          </div>
        `).join('')}
      </div>
      
      <div class="section">
        <h2>Data Source Locations</h2>
        <ul class="searched-paths">
          ${searchedPaths.map(p => `<li>✓ ${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    </div>
    ` : `
    <div class="content">
      <div class="no-data">
        <h2>No Cursor Session Data Found</h2>
        <p>The script searched for Cursor data but did not find any parseable session files.</p>
        
        <div class="section">
          <h2>Searched Locations</h2>
          <ul class="searched-paths">
            ${searchedPaths.map(p => `<li>${fs.existsSync(p) ? '✓' : '✗'} ${escapeHtml(p)} ${fs.existsSync(p) ? '(exists but no data found)' : '(does not exist)'}</li>`).join('')}
          </ul>
        </div>
        
        <div class="recommendations">
          <h3>Recommendations for Enabling Session Logging in Cursor</h3>
          <ul>
            <li><strong>Ensure Cursor is up to date:</strong> Session logging requires Cursor version 0.40+</li>
            <li><strong>Enable chat history:</strong> Open Cursor Settings → General → Enable "Save chat history"</li>
            <li><strong>Check workspace storage:</strong> Cursor stores data per workspace in <code>~/.cursor/chats/[workspace-hash]/</code></li>
            <li><strong>Use the Agent/Chat feature:</strong> Start new chats using Cmd+L (Mac) or Ctrl+L (Windows/Linux)</li>
            <li><strong>Verify write permissions:</strong> Ensure Cursor has write access to <code>~/.cursor/</code></li>
            <li><strong>Manual export option:</strong> You can export individual chats from the UI using the share button</li>
            <li><strong>Expected file structure:</strong>
              <ul style="margin-top: 5px;">
                <li><code>~/.cursor/chats/[workspace-hash]/[chat-id]/store.db</code> - SQLite database with messages</li>
                <li><code>~/.cursor/chats/[workspace-hash]/[chat-id]/meta.json</code> - Chat metadata</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
    `}
    
    ${errors.length > 0 ? `
    <div class="content">
      <div class="error-list">
        <h3>Errors During Processing</h3>
        <ul>
          ${errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}
        </ul>
      </div>
    </div>
    ` : ''}
  </div>
</body>
</html>`;
  
  return html;
}

/**
 * Main function
 */
async function main() {
  log('Cursor Insights Report Generator', 'cyan');
  log('=' .repeat(50), 'cyan');
  
  // Ensure report directory exists
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    log(`Created directory: ${REPORT_DIR}`, 'green');
  }
  
  const searchedPaths = [];
  const errors = [];
  const sessions = [];
  
  // Search for Cursor data
  log('\nSearching for Cursor data...', 'blue');
  
  // Check ~/.cursor/
  searchedPaths.push(CURSOR_DIR);
  if (fs.existsSync(CURSOR_DIR)) {
    log(`  ✓ Found: ${CURSOR_DIR}`, 'green');
  } else {
    log(`  ✗ Not found: ${CURSOR_DIR}`, 'red');
  }
  
  // Check ~/.cursor/chats/
  searchedPaths.push(CHATS_DIR);
  if (fs.existsSync(CHATS_DIR)) {
    log(`  ✓ Found: ${CHATS_DIR}`, 'green');
    
    // Find all store.db files
    const dbFiles = findStoreDbFiles(CHATS_DIR);
    log(`  Found ${dbFiles.length} store.db files`, 'yellow');
    
    // Parse each store.db
    for (const dbPath of dbFiles) {
      try {
        log(`  Parsing: ${path.basename(path.dirname(dbPath))}...`, 'gray');
        const session = parseStoreDb(dbPath);
        if (session && session.messages.length > 0) {
          sessions.push(session);
          log(`    ✓ ${session.stats.messageCount} messages`, 'green');
        }
      } catch (err) {
        errors.push(`${dbPath}: ${err.message}`);
        log(`    ✗ Error: ${err.message}`, 'red');
      }
    }
  } else {
    log(`  ✗ Not found: ${CHATS_DIR}`, 'red');
  }
  
  // Also check for other potential locations
  const otherPaths = [
    path.join(process.env.HOME, '.cursor/sessions'),
    path.join(process.env.HOME, '.cursor/history'),
    path.join(process.env.HOME, 'Library/Application Support/Cursor'),
  ];
  
  for (const otherPath of otherPaths) {
    searchedPaths.push(otherPath);
    if (fs.existsSync(otherPath)) {
      log(`  ✓ Found additional path: ${otherPath}`, 'green');
    }
  }
  
  // Generate report
  log('\nGenerating HTML report...', 'blue');
  const html = generateReport(sessions, searchedPaths, errors);
  
  fs.writeFileSync(REPORT_PATH, html, 'utf-8');
  log(`  ✓ Report saved to: ${REPORT_PATH}`, 'green');
  
  // Summary
  log('\n' + '='.repeat(50), 'cyan');
  log('Summary:', 'cyan');
  log(`  Sessions found: ${sessions.length}`, sessions.length > 0 ? 'green' : 'yellow');
  log(`  Total messages: ${sessions.reduce((s, x) => s + x.stats.messageCount, 0)}`, 'cyan');
  log(`  Report location: ${REPORT_PATH}`, 'cyan');
  log(`  Errors: ${errors.length}`, errors.length > 0 ? 'red' : 'green');
  
  return {
    success: true,
    sessionsFound: sessions.length,
    reportPath: REPORT_PATH
  };
}

// Run main function
main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
