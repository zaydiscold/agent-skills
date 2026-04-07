#!/usr/bin/env node
import * as fs from 'fs'
import * as path from 'path'
import { loadAllLogsFromSessionFile, logToSessionMeta, formatTranscriptForFacets, isMetaSession, isSubstantiveSession } from './parsers/claude'
import { aggregateData } from './analysis/aggregate'
import { loadCachedFacets, saveFacets, loadCachedSessionMeta, saveSessionMeta } from './cache/facets'
import { SessionMeta, SessionFacets, AggregatedData, InsightResults } from './types'
import { generateHtmlReport } from './report/html-generator'

// Configuration (from Claude source)
const MAX_SESSIONS_TO_LOAD = 200
const MAX_FACET_EXTRACTIONS = 50
const LOAD_BATCH_SIZE = 10

// Placeholder for AI calls - would use actual API
async function extractFacetsWithAI(transcript: string, sessionId: string): Promise<SessionFacets> {
  // This would call Claude Opus with FACET_EXTRACTION_PROMPT
  // For now, return mock data
  return {
    session_id: sessionId,
    underlying_goal: 'Mock goal - implement AI call',
    goal_categories: { debug_investigate: 1 },
    outcome: 'mostly_achieved',
    user_satisfaction_counts: { satisfied: 1 },
    claude_helpfulness: 'very_helpful',
    session_type: 'single_task',
    friction_counts: {},
    friction_detail: '',
    primary_success: 'good_debugging',
    brief_summary: 'Mock summary - implement AI call',
  }
}

async function generateInsightSection(sectionName: string, dataContext: string): Promise<unknown> {
  // This would call Claude Opus with section prompts
  // For now, return mock data
  return null
}

async function scanSessions(sessionsDir: string): Promise<Array<{ path: string; mtime: Date }>> {
  const files: Array<{ path: string; mtime: Date }> = []
  
  if (!fs.existsSync(sessionsDir)) {
    return files
  }
  
  const entries = fs.readdirSync(sessionsDir, { withFileTypes: true })
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const projectDir = path.join(sessionsDir, entry.name)
      const jsonlFiles = fs.readdirSync(projectDir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          path: path.join(projectDir, f),
          mtime: fs.statSync(path.join(projectDir, f)).mtime,
        }))
      files.push(...jsonlFiles)
    }
  }
  
  // Sort by modification time (newest first)
  files.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
  
  return files.slice(0, MAX_SESSIONS_TO_LOAD)
}

async function processSessions(sessionFiles: Array<{ path: string; mtime: Date }>): Promise<{
  sessions: SessionMeta[]
  facets: Map<string, SessionFacets>
}> {
  const sessions: SessionMeta[] = []
  const facets = new Map<string, SessionFacets>()
  
  // Load in batches with yield
  for (let i = 0; i < sessionFiles.length; i += LOAD_BATCH_SIZE) {
    const batch = sessionFiles.slice(i, i + LOAD_BATCH_SIZE)
    
    // Load logs
    const batchLogs = await Promise.all(
      batch.map(async fileInfo => {
        try {
          return loadAllLogsFromSessionFile(fileInfo.path)
        } catch {
          return []
        }
      })
    )
    
    // Extract metas
    for (const logs of batchLogs) {
      for (const log of logs) {
        // Skip meta-sessions
        if (isMetaSession(log)) continue
        
        const meta = logToSessionMeta(log)
        
        // Skip non-substantive
        if (!isSubstantiveSession(meta)) continue
        
        sessions.push(meta)
      }
    }
    
    // Yield to event loop
    await new Promise(resolve => setImmediate(resolve))
  }
  
  // Load cached facets and extract new ones (limit to 50)
  const cachedFacetResults = await Promise.all(
    sessions.slice(0, MAX_FACET_EXTRACTIONS).map(async meta => ({
      sessionId: meta.session_id,
      cached: await loadCachedFacets(meta.session_id),
    }))
  )
  
  // Collect sessions that need facet extraction
  const toExtract: Array<{ meta: SessionMeta; transcript: string }> = []
  
  for (const { sessionId, cached } of cachedFacetResults) {
    if (cached) {
      facets.set(sessionId, cached)
    } else {
      const meta = sessions.find(s => s.session_id === sessionId)
      if (meta) {
        const log = (await loadAllLogsFromSessionFile(
          path.join(process.env.HOME || '', '.claude', 'projects', sessionId + '.jsonl')
        ))[0]
        if (log) {
          toExtract.push({
            meta,
            transcript: formatTranscriptForFacets(log),
          })
        }
      }
    }
  }
  
  // Extract facets with AI (would be parallel in real implementation)
  console.log(`Extracting facets for ${toExtract.length} sessions...`)
  for (const { meta, transcript } of toExtract.slice(0, MAX_FACET_EXTRACTIONS - facets.size)) {
    const extracted = await extractFacetsWithAI(transcript, meta.session_id)
    await saveFacets(extracted)
    facets.set(meta.session_id, extracted)
  }
  
  return { sessions, facets }
}

async function generateInsights(data: AggregatedData): Promise<InsightResults> {
  // This would run 6 sections in parallel with AI
  // For now, return empty results
  return {}
}

async function main() {
  const sessionsDir = path.join(process.env.HOME || '', '.claude', 'projects')
  
  console.log('Scanning sessions...')
  const sessionFiles = await scanSessions(sessionsDir)
  console.log(`Found ${sessionFiles.length} session files`)
  
  console.log('Processing sessions...')
  const { sessions, facets } = await processSessions(sessionFiles)
  console.log(`Processed ${sessions.length} substantive sessions with ${facets.size} facets`)
  
  console.log('Aggregating data...')
  const data = aggregateData(sessions, facets)
  
  console.log('Generating insights...')
  const insights = await generateInsights(data)
  
  console.log('Generating report...')
  const html = generateHtmlReport(data, insights)
  
  const outputPath = path.join(process.cwd(), 'insights-report.html')
  fs.writeFileSync(outputPath, html)
  
  console.log(`Report saved to ${outputPath}`)
}

main().catch(console.error)
