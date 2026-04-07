/**
 * Codex Insights Report Generator
 * Uses the universal-session-adapter to parse Codex sessions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { CodexAdapter } = await import(path.join(process.env.HOME!, 'universal-session-adapter/src/index.ts'));

const CODEX_DIR = process.env.HOME + '/.codex';
const OUTPUT_PATH = process.env.HOME + '/Desktop/agent-skills/universal-insights/reports/codex-insights.html';

interface SessionInsights {
  totalSessions: number;
  totalMessages: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalToolCalls: number;
  totalDurationMs: number;
  totalErrors: number;
  avgMessagesPerSession: number;
  sessionList: Array<{
    id: string;
    title: string;
    messageCount: number;
    userCount: number;
    assistantCount: number;
    durationMinutes: number;
    errorCount: number;
    createdAt: string;
    updatedAt: string;
    sourcePath: string;
    preview: string;
  }>;
  timeRange: {
    earliest: string;
    latest: string;
  };
  processingMetadata: {
    filesProcessed: number;
    filesWithErrors: number;
    totalProcessingTimeMs: number;
    parseErrors: string[];
  };
}

async function generateInsights(): Promise<SessionInsights> {
  const adapter = new CodexAdapter();
  const insights: SessionInsights = {
    totalSessions: 0,
    totalMessages: 0,
    totalUserMessages: 0,
    totalAssistantMessages: 0,
    totalToolCalls: 0,
    totalDurationMs: 0,
    totalErrors: 0,
    avgMessagesPerSession: 0,
    sessionList: [],
    timeRange: { earliest: '', latest: '' },
    processingMetadata: {
      filesProcessed: 0,
      filesWithErrors: 0,
      totalProcessingTimeMs: 0,
      parseErrors: []
    }
  };

  const allTimestamps: number[] = [];
  const startTime = Date.now();

  // Process main history.jsonl
  const historyPath = path.join(CODEX_DIR, 'history.jsonl');
  try {
    await fs.access(historyPath);
    const result = await adapter.parseSession(historyPath, { skipCorrupted: true });
    insights.processingMetadata.filesProcessed++;
    
    if (result.success && result.session) {
      const session = result.session;
      insights.totalSessions++;
      insights.totalMessages += session.stats.messageCount;
      insights.totalUserMessages += session.stats.userMessageCount;
      insights.totalAssistantMessages += session.stats.assistantMessageCount;
      insights.totalToolCalls += session.messages.filter(m => m.role === 'tool').length;
      insights.totalDurationMs += session.stats.durationMs;
      insights.totalErrors += session.stats.errorCount;

      const createdMs = new Date(session.createdAt).getTime();
      const updatedMs = new Date(session.updatedAt).getTime();
      allTimestamps.push(createdMs, updatedMs);

      // Get preview from first user message
      const firstUserMsg = session.messages.find(m => m.role === 'user');
      const preview = firstUserMsg ? firstUserMsg.content.slice(0, 100).replace(/\n/g, ' ') + '...' : 'No preview';

      insights.sessionList.push({
        id: session.id,
        title: session.title,
        messageCount: session.stats.messageCount,
        userCount: session.stats.userMessageCount,
        assistantCount: session.stats.assistantMessageCount,
        durationMinutes: Math.round(session.stats.durationMs / 60000),
        errorCount: session.stats.errorCount,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        sourcePath: 'history.jsonl',
        preview
      });
    } else if (result.error) {
      insights.processingMetadata.filesWithErrors++;
      insights.processingMetadata.parseErrors.push(`history.jsonl: ${result.error.message}`);
    }
  } catch (err) {
    insights.processingMetadata.parseErrors.push(`history.jsonl: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Process archived sessions
  const archivedDir = path.join(CODEX_DIR, 'archived_sessions');
  try {
    const archivedResults = await adapter.parseDirectory(archivedDir, { maxSessions: 100, skipCorrupted: true });
    
    for (const result of archivedResults) {
      insights.processingMetadata.filesProcessed++;
      
      if (result.success && result.session) {
        const session = result.session;
        insights.totalSessions++;
        insights.totalMessages += session.stats.messageCount;
        insights.totalUserMessages += session.stats.userMessageCount;
        insights.totalAssistantMessages += session.stats.assistantMessageCount;
        insights.totalToolCalls += session.messages.filter(m => m.role === 'tool').length;
        insights.totalDurationMs += session.stats.durationMs;
        insights.totalErrors += session.stats.errorCount;

        const createdMs = new Date(session.createdAt).getTime();
        const updatedMs = new Date(session.updatedAt).getTime();
        allTimestamps.push(createdMs, updatedMs);

        const firstUserMsg = session.messages.find(m => m.role === 'user');
        const preview = firstUserMsg ? firstUserMsg.content.slice(0, 100).replace(/\n/g, ' ') + '...' : 'No preview';

        insights.sessionList.push({
          id: session.id,
          title: session.title,
          messageCount: session.stats.messageCount,
          userCount: session.stats.userMessageCount,
          assistantCount: session.stats.assistantMessageCount,
          durationMinutes: Math.round(session.stats.durationMs / 60000),
          errorCount: session.stats.errorCount,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          sourcePath: result.session?.sourcePath?.split('/').pop() || 'unknown',
          preview
        });
      } else if (result.error) {
        insights.processingMetadata.filesWithErrors++;
        insights.processingMetadata.parseErrors.push(`${result.error.path}: ${result.error.message}`);
      }
    }
  } catch (err) {
    insights.processingMetadata.parseErrors.push(`archived_sessions: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Process recent sessions (2026 directory)
  const sessionsDir = path.join(CODEX_DIR, 'sessions');
  try {
    const recentResults = await adapter.parseDirectory(sessionsDir, { maxSessions: 50, skipCorrupted: true });
    
    for (const result of recentResults) {
      insights.processingMetadata.filesProcessed++;
      
      if (result.success && result.session) {
        const session = result.session;
        insights.totalSessions++;
        insights.totalMessages += session.stats.messageCount;
        insights.totalUserMessages += session.stats.userMessageCount;
        insights.totalAssistantMessages += session.stats.assistantMessageCount;
        insights.totalToolCalls += session.messages.filter(m => m.role === 'tool').length;
        insights.totalDurationMs += session.stats.durationMs;
        insights.totalErrors += session.stats.errorCount;

        const createdMs = new Date(session.createdAt).getTime();
        const updatedMs = new Date(session.updatedAt).getTime();
        allTimestamps.push(createdMs, updatedMs);

        const firstUserMsg = session.messages.find(m => m.role === 'user');
        const preview = firstUserMsg ? firstUserMsg.content.slice(0, 100).replace(/\n/g, ' ') + '...' : 'No preview';

        insights.sessionList.push({
          id: session.id,
          title: session.title,
          messageCount: session.stats.messageCount,
          userCount: session.stats.userMessageCount,
          assistantCount: session.stats.assistantMessageCount,
          durationMinutes: Math.round(session.stats.durationMs / 60000),
          errorCount: session.stats.errorCount,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          sourcePath: result.session?.sourcePath?.split('/').pop() || 'unknown',
          preview
        });
      }
    }
  } catch (err) {
    // Sessions directory may have different structure
  }

  // Calculate time range
  if (allTimestamps.length > 0) {
    insights.timeRange.earliest = new Date(Math.min(...allTimestamps)).toISOString();
    insights.timeRange.latest = new Date(Math.max(...allTimestamps)).toISOString();
  }

  // Calculate averages
  if (insights.totalSessions > 0) {
    insights.avgMessagesPerSession = Math.round(insights.totalMessages / insights.totalSessions);
  }

  insights.processingMetadata.totalProcessingTimeMs = Date.now() - startTime;

  // Sort sessions by updated date (newest first)
  insights.sessionList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return insights;
}

function generateHTML(insights: SessionInsights): string {
  const formatNumber = (n: number) => n.toLocaleString();
  const formatDate = (d: string) => d ? new Date(d).toLocaleString() : 'N/A';
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const escapeHtml = (str: string) => str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const sessionRows = insights.sessionList.map((s, i) => `
    <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
      <td class="id" title="${s.id}">${s.id.slice(0, 8)}...</td>
      <td class="title">${escapeHtml(s.title)}</td>
      <td class="number">${formatNumber(s.messageCount)}</td>
      <td class="number">${formatNumber(s.userCount)}</td>
      <td class="number">${formatNumber(s.assistantCount)}</td>
      <td class="number">${s.durationMinutes}m</td>
      <td class="number ${s.errorCount > 0 ? 'error' : ''}">${s.errorCount}</td>
      <td class="date">${formatDate(s.createdAt)}</td>
      <td class="source">${s.sourcePath}</td>
    </tr>
    <tr class="preview-row ${i % 2 === 0 ? 'even' : 'odd'}">
      <td colspan="9" class="preview">${escapeHtml(s.preview)}</td>
    </tr>
  `).join('');

  const errorList = insights.processingMetadata.parseErrors.length > 0 
    ? insights.processingMetadata.parseErrors.map(e => `<li>${escapeHtml(e)}</li>`).join('')
    : '<li>No errors</li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codex Session Insights Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 { margin: 0 0 10px 0; font-size: 2em; }
    .subtitle { opacity: 0.8; font-size: 0.95em; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      border-left: 4px solid #4a90d9;
    }
    .stat-card.error { border-left-color: #e74c3c; }
    .stat-card.success { border-left-color: #2ecc71; }
    .stat-card.warning { border-left-color: #f39c12; }
    .stat-value {
      font-size: 2em;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 5px;
    }
    .stat-label {
      font-size: 0.9em;
      color: #7f8c8d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    section {
      background: white;
      padding: 25px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    h2 {
      margin-top: 0;
      color: #2c3e50;
      border-bottom: 2px solid #ecf0f1;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9em;
    }
    th {
      background: #34495e;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #ecf0f1;
    }
    tr.even { background: #f8f9fa; }
    tr.odd { background: white; }
    tr:hover { background: #e8f4f8; }
    .id { font-family: monospace; font-size: 0.85em; }
    .number { text-align: right; font-family: monospace; }
    .date { font-size: 0.85em; color: #666; }
    .source { font-size: 0.85em; color: #666; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
    .preview-row td { padding-top: 0; padding-bottom: 15px; border-bottom: 2px solid #dee2e6; }
    .preview {
      font-size: 0.85em;
      color: #666;
      font-style: italic;
      padding-left: 20px;
    }
    .error { color: #e74c3c; font-weight: bold; }
    .info-box {
      background: #e8f4f8;
      border-left: 4px solid #3498db;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .errors-list {
      background: #fdf2f2;
      border-left: 4px solid #e74c3c;
      padding: 15px;
      border-radius: 4px;
    }
    .errors-list li { color: #c0392b; margin: 5px 0; }
    footer {
      text-align: center;
      color: #7f8c8d;
      margin-top: 40px;
      padding: 20px;
      font-size: 0.9em;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75em;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-primary { background: #3498db; color: white; }
    .badge-success { background: #2ecc71; color: white; }
    .badge-warning { background: #f39c12; color: white; }
    .badge-error { background: #e74c3c; color: white; }
  </style>
</head>
<body>
  <header>
    <h1>Codex Session Insights Report</h1>
    <div class="subtitle">
      Generated on ${new Date().toLocaleString()} | 
      Universal Session Adapter v1.0 | 
      Agent: Codex CLI
    </div>
  </header>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${formatNumber(insights.totalSessions)}</div>
      <div class="stat-label">Total Sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatNumber(insights.totalMessages)}</div>
      <div class="stat-label">Total Messages</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatNumber(insights.totalUserMessages)}</div>
      <div class="stat-label">User Messages</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatNumber(insights.totalAssistantMessages)}</div>
      <div class="stat-label">Assistant Messages</div>
    </div>
    <div class="stat-card ${insights.totalErrors > 0 ? 'error' : 'success'}">
      <div class="stat-value">${formatNumber(insights.totalErrors)}</div>
      <div class="stat-label">Errors Detected</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatNumber(insights.totalToolCalls)}</div>
      <div class="stat-label">Tool Calls</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${formatDuration(insights.totalDurationMs)}</div>
      <div class="stat-label">Total Duration</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${insights.avgMessagesPerSession}</div>
      <div class="stat-label">Avg Messages/Session</div>
    </div>
  </div>

  <section>
    <h2>Time Range</h2>
    <div class="info-box">
      <strong>Earliest Session:</strong> ${formatDate(insights.timeRange.earliest)}<br>
      <strong>Latest Session:</strong> ${formatDate(insights.timeRange.latest)}<br>
      <strong>Span:</strong> ${insights.timeRange.earliest && insights.timeRange.latest 
        ? formatDuration(new Date(insights.timeRange.latest).getTime() - new Date(insights.timeRange.earliest).getTime()) 
        : 'N/A'}
    </div>
  </section>

  <section>
    <h2>Session Details <span class="badge badge-primary">${insights.sessionList.length} sessions</span></h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Messages</th>
          <th>User</th>
          <th>Assistant</th>
          <th>Duration</th>
          <th>Errors</th>
          <th>Created</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        ${sessionRows}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Processing Metadata</h2>
    <div class="info-box">
      <strong>Files Processed:</strong> ${insights.processingMetadata.filesProcessed}<br>
      <strong>Files With Errors:</strong> ${insights.processingMetadata.filesWithErrors}<br>
      <strong>Total Processing Time:</strong> ${insights.processingMetadata.totalProcessingTimeMs}ms<br>
      <strong>Data Source:</strong> ~/.codex/history.jsonl, ~/.codex/archived_sessions/, ~/.codex/sessions/
    </div>
    ${insights.processingMetadata.parseErrors.length > 0 ? `
    <div class="errors-list">
      <strong>Parse Errors/Warnings:</strong>
      <ul>
        ${errorList}
      </ul>
    </div>
    ` : ''}
  </section>

  <footer>
    <p>Generated by Universal Session Adapter</p>
    <p>Codex Adapter v1.0 | Report saved to: ${OUTPUT_PATH}</p>
  </footer>
</body>
</html>`;
}

async function main() {
  console.log('=== Codex Insights Report Generator ===\n');
  
  try {
    console.log('Parsing Codex session data...');
    const insights = await generateInsights();
    
    console.log(`\nFound ${insights.totalSessions} sessions with ${insights.totalMessages} total messages`);
    console.log(`Processing took ${insights.processingMetadata.totalProcessingTimeMs}ms`);
    
    console.log('\nGenerating HTML report...');
    const html = generateHTML(insights);
    
    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    await fs.mkdir(outputDir, { recursive: true });
    
    // Write report
    await fs.writeFile(OUTPUT_PATH, html, 'utf-8');
    console.log(`\nReport saved to: ${OUTPUT_PATH}`);
    console.log(`File size: ${(html.length / 1024).toFixed(2)} KB`);
    
  } catch (err) {
    console.error('Error generating report:', err);
    process.exit(1);
  }
}

main();
