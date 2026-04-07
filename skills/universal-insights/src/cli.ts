/**
 * Universal Insights CLI
 * Main entry point for the insights command
 */

import { scanAllSessions, parseSession, getAvailableAdapters } from './adapters/index.js';
import { extractFacetsBatch } from './analysis/facets.js';
import { generateInsights } from './analysis/sections.js';
import { generateHtmlReport } from './report/html.js';
import { writeFile, mkdir } from 'fs/promises';
import { join, homedir } from 'path';
import type { AggregatedData, SessionFacets, NormalizedSession } from './types.js';

const REPORT_DIR = join(homedir(), '.universal-insights', 'reports');

interface Options {
  agent?: string;
  limit?: number;
  days?: number;
  noAi?: boolean;
  output?: string;
}

async function loadSessionsForAnalysis(options: Options): Promise<NormalizedSession[]> {
  const adapters = await getAvailableAdapters();
  
  if (adapters.length === 0) {
    throw new Error('No AI agent session data found. Install Claude Code, Cursor, Gemini CLI, or Codex first.');
  }
  
  console.log(`Found ${adapters.length} agent(s): ${adapters.map(a => a.displayName).join(', ')}`);
  
  // Scan all sessions
  let sessionInfos = await scanAllSessions();
  
  // Filter by agent if specified
  if (options.agent) {
    sessionInfos = sessionInfos.filter(s => s.agent === options.agent);
  }
  
  // Filter by days if specified
  if (options.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - options.days);
    sessionInfos = sessionInfos.filter(s => s.timestamp >= cutoff);
  }
  
  // Limit total sessions
  sessionInfos = sessionInfos.slice(0, options.limit || 100);
  
  console.log(`Analyzing ${sessionInfos.length} session(s)...`);
  
  // Parse full session content
  const sessions: NormalizedSession[] = [];
  for (const info of sessionInfos) {
    try {
      const session = await parseSession(info.id, info.agent);
      sessions.push(session);
    } catch (error) {
      console.error(`Failed to parse ${info.agent} session ${info.id}:`, error);
    }
  }
  
  return sessions;
}

async function generateReport(sessions: NormalizedSession[], options: Options): Promise<void> {
  // Aggregate data
  const agentBreakdown = { claude: 0, cursor: 0, gemini: 0, codex: 0, antigravity: 0 };
  let totalMessages = 0;
  let totalUserMessages = 0;
  
  const timeDistribution = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  const dailyCounts: Record<string, number> = {};
  
  for (const session of sessions) {
    agentBreakdown[session.agent]++;
    totalMessages += session.stats.messageCount;
    totalUserMessages += session.stats.userMessageCount;
    
    // Time distribution
    const hour = session.startTime.getHours();
    if (hour >= 5 && hour < 12) timeDistribution.morning++;
    else if (hour >= 12 && hour < 17) timeDistribution.afternoon++;
    else if (hour >= 17 && hour < 22) timeDistribution.evening++;
    else timeDistribution.night++;
    
    // Daily counts
    const day = session.startTime.toISOString().split('T')[0];
    dailyCounts[day] = (dailyCounts[day] || 0) + 1;
  }
  
  const aggregated: AggregatedData = {
    sessions,
    totalMessages,
    totalUserMessages,
    agentBreakdown,
    timeDistribution,
    dailySessionCounts: dailyCounts
  };
  
  console.log(`\n📊 Aggregated Stats:`);
  console.log(`   Total sessions: ${sessions.length}`);
  console.log(`   Total messages: ${totalMessages}`);
  console.log(`   Agents used: ${Object.entries(agentBreakdown).filter(([_, c]) => c > 0).map(([a]) => a).join(', ')}`);
  
  // Extract facets (with or without AI)
  console.log(`\n🔍 Extracting facets from ${sessions.length} sessions...`);
  
  // Placeholder for AI call - in production this would call an LLM API
  const aiCall = options.noAi ? undefined : async (prompt: string) => {
    // In production, this would call OpenAI/Anthropic/etc
    // For now, return empty to trigger fallback
    throw new Error('AI not configured');
  };
  
  const facetResults = await extractFacetsBatch(sessions, aiCall, 5);
  const facets: SessionFacets[] = facetResults.map(r => r.facets);
  
  // Generate insights
  console.log(`\n💡 Generating insights...`);
  const insights = await generateInsights(aggregated, facets, aiCall);
  
  // Generate HTML report
  const reportHtml = generateHtmlReport(aggregated, insights, {
    generatedAt: new Date(),
    sessionCount: sessions.length,
    agentCount: Object.values(agentBreakdown).filter(c => c > 0).length
  });
  
  // Ensure report directory exists
  await mkdir(REPORT_DIR, { recursive: true });
  
  // Write report
  const reportPath = options.output || join(REPORT_DIR, `insights-${new Date().toISOString().split('T')[0]}.html`);
  await writeFile(reportPath, reportHtml);
  
  console.log(`\n✅ Report generated: ${reportPath}`);
  console.log(`   Open in browser: file://${reportPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const options: Options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--agent':
      case '-a':
        options.agent = args[++i];
        break;
      case '--limit':
      case '-l':
        options.limit = parseInt(args[++i]);
        break;
      case '--days':
      case '-d':
        options.days = parseInt(args[++i]);
        break;
      case '--no-ai':
      case '-n':
        options.noAi = true;
        break;
      case '--output':
      case '-o':
        options.output = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }
  
  try {
    const sessions = await loadSessionsForAnalysis(options);
    await generateReport(sessions, options);
  } catch (error) {
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
Universal Insights - Cross-agent workflow analysis

Usage: universal-insights [options]

Options:
  -a, --agent <name>     Filter by agent (claude|cursor|gemini|codex)
  -l, --limit <n>        Limit to N sessions (default: 100)
  -d, --days <n>         Only include last N days
  -n, --no-ai            Skip AI-powered analysis (use computed insights)
  -o, --output <path>    Custom output path for HTML report
  -h, --help             Show this help

Examples:
  universal-insights                    # Analyze all recent sessions
  universal-insights -a claude          # Only Claude sessions
  universal-insights -l 50 -d 7         # Last 50 sessions from past week
  universal-insights -o ./report.html   # Custom output path

Environment Variables:
  OPENAI_API_KEY      # Required for AI-powered analysis
  ANTHROPIC_API_KEY   # Alternative AI provider
`);
}

main();
