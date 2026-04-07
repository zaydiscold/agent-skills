/**
 * Cursor Insights Report Generator - Using Universal Session Adapter
 * 
 * This script demonstrates using the CursorAdapter from the 
 * universal-session-adapter package to parse Cursor data.
 * 
 * Usage:
 *   cd ~/universal-session-adapter && npm run build
 *   node ~/Desktop/agent-skills/universal-insights/generate-cursor-insights-with-adapter.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Try to import the cursor adapter from the universal-session-adapter
let CursorAdapter;
try {
  // First try the built dist version
  const adapterModule = require(path.join(process.env.HOME, 'universal-session-adapter/dist/adapters/cursor.js'));
  CursorAdapter = adapterModule.CursorAdapter;
} catch (err) {
  try {
    // Fallback: use ts-node to run TypeScript directly
    require('ts-node/register');
    const adapterModule = require(path.join(process.env.HOME, 'universal-session-adapter/src/adapters/cursor.ts'));
    CursorAdapter = adapterModule.CursorAdapter;
  } catch (err2) {
    console.log('Note: CursorAdapter from universal-session-adapter not available.');
    console.log('The main report was generated using the standalone parser.');
    console.log('To use the adapter, run: cd ~/universal-session-adapter && npm run build');
    process.exit(0);
  }
}

const CURSOR_DIR = path.join(process.env.HOME, '.cursor');
const CHATS_DIR = path.join(CURSOR_DIR, 'chats');
const REPORT_DIR = path.join(process.env.HOME, 'Desktop/agent-skills/universal-insights/reports');
const REPORT_PATH = path.join(REPORT_DIR, 'cursor-insights-adapter.html');

/**
 * Find all store.db files
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
 * Generate HTML report from adapter results
 */
function generateReport(results, searchedPaths) {
  const successfulResults = results.filter(r => r.success && r.session);
  const failedResults = results.filter(r => !r.success);
  
  const totalSessions = successfulResults.length;
  const totalMessages = successfulResults.reduce((sum, r) => 
    sum + (r.session?.stats?.messageCount || 0), 0);
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cursor Insights Report (via Adapter)</title>
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
    header h1 { font-size: 2em; margin-bottom: 10px; }
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
    .stat-value { font-size: 2em; font-weight: bold; color: #667eea; }
    .content { padding: 30px; }
    .section { margin-bottom: 40px; }
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
    .file-path {
      font-family: monospace;
      font-size: 0.85em;
      color: #666;
      background: #e9ecef;
      padding: 5px 10px;
      border-radius: 4px;
      display: inline-block;
      margin: 5px 0;
    }
    .error-list {
      background: #f8d7da;
      border: 1px solid #f5c6cb;
      border-radius: 8px;
      padding: 15px;
    }
    .error-list h3 { color: #721c24; margin-bottom: 10px; }
    .searched-paths {
      background: #f0f0f0;
      padding: 15px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .searched-paths li { margin: 5px 0; list-style: none; }
    pre {
      background: #f4f4f4;
      padding: 10px;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.85em;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Cursor Insights Report (via Adapter)</h1>
      <p>Generated using CursorAdapter from universal-session-adapter</p>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </header>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${totalSessions}</div>
        <div class="stat-label">Sessions Parsed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalMessages}</div>
        <div class="stat-label">Total Messages</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${results.length}</div>
        <div class="stat-label">Files Processed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${failedResults.length}</div>
        <div class="stat-label">Parse Failures</div>
      </div>
    </div>
    
    <div class="content">
      <div class="section">
        <h2>Adapter Results</h2>
        <p>This report was generated using the CursorAdapter from the universal-session-adapter package.</p>
        
        ${successfulResults.map(result => `
          <div class="session-card">
            <h3>${result.session?.title || 'Unnamed Session'}</h3>
            <div class="file-path">${result.session?.sourcePath}</div>
            <p style="margin-top: 10px;">
              <strong>Status:</strong> ${result.session?.status} · 
              <strong>Messages:</strong> ${result.session?.stats?.messageCount || 0} · 
              <strong>Agent:</strong> ${result.session?.agent}
            </p>
            ${result.warnings.length > 0 ? `
              <div style="margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                <strong>Warnings:</strong> ${result.warnings.length}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
      
      ${failedResults.length > 0 ? `
        <div class="section">
          <div class="error-list">
            <h3>Parse Failures (${failedResults.length})</h3>
            ${failedResults.map(r => `
              <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
                <div class="file-path">${r.error?.path || 'Unknown'}</div>
                <p style="color: #721c24; margin-top: 5px;">${r.error?.type}: ${r.error?.message}</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="section">
        <h2>Searched Locations</h2>
        <ul class="searched-paths">
          ${searchedPaths.map(p => `<li>${fs.existsSync(p) ? '✓' : '✗'} ${p}</li>`).join('')}
        </ul>
      </div>
      
      <div class="section">
        <h2>Raw Results (JSON)</h2>
        <pre>${JSON.stringify(results.map(r => ({
          success: r.success,
          path: r.session?.sourcePath || r.error?.path,
          title: r.session?.title,
          messageCount: r.session?.stats?.messageCount,
          error: r.error?.message,
          warnings: r.warnings.length
        })), null, 2)}</pre>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  console.log('Cursor Insights Report Generator (via Adapter)');
  console.log('='.repeat(50));
  
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
  
  // Initialize adapter
  const adapter = new CursorAdapter();
  console.log(`\nUsing adapter: ${adapter.name}`);
  console.log(`Agent type: ${adapter.agentType}`);
  console.log(`Supported patterns: ${adapter.supportedPatterns.join(', ')}`);
  
  const searchedPaths = [CURSOR_DIR, CHATS_DIR];
  const results = [];
  
  // Find and parse store.db files
  if (fs.existsSync(CHATS_DIR)) {
    const dbFiles = findStoreDbFiles(CHATS_DIR);
    console.log(`\nFound ${dbFiles.length} store.db files`);
    
    for (const dbPath of dbFiles.slice(0, 10)) { // Limit to first 10 for demo
      console.log(`  Parsing: ${path.basename(path.dirname(dbPath))}...`);
      
      try {
        const canHandle = await adapter.canHandle(dbPath);
        if (canHandle) {
          const result = await adapter.parseSession(dbPath);
          results.push(result);
          
          if (result.success) {
            console.log(`    ✓ Success: ${result.session?.stats?.messageCount || 0} messages`);
          } else {
            console.log(`    ✗ Failed: ${result.error?.type}`);
          }
        } else {
          console.log(`    - Adapter cannot handle this file`);
        }
      } catch (err) {
        console.log(`    ✗ Error: ${err.message}`);
        results.push({
          success: false,
          error: { type: 'exception', message: err.message, path: dbPath },
          warnings: [],
          processingTimeMs: 0
        });
      }
    }
    
    if (dbFiles.length > 10) {
      console.log(`  ... and ${dbFiles.length - 10} more files (limited for demo)`);
    }
  }
  
  // Generate report
  console.log('\nGenerating HTML report...');
  const html = generateReport(results, searchedPaths);
  fs.writeFileSync(REPORT_PATH, html, 'utf-8');
  console.log(`  ✓ Report saved to: ${REPORT_PATH}`);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Summary:');
  console.log(`  Sessions parsed: ${results.filter(r => r.success).length}`);
  console.log(`  Total files processed: ${results.length}`);
  console.log(`  Failures: ${results.filter(r => !r.success).length}`);
  console.log(`  Report: ${REPORT_PATH}`);
}

main().catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
