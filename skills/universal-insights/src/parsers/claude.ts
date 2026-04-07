import * as fs from 'fs'
import * as path from 'path'
import { LogOption, LogMessage, SessionMeta } from '../types'

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.py': 'Python',
  '.rs': 'Rust',
  '.go': 'Go',
  '.java': 'Java',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.c': 'C',
  '.cpp': 'C++',
  '.h': 'C',
  '.hpp': 'C++',
  '.swift': 'Swift',
  '.kt': 'Kotlin',
  '.scala': 'Scala',
  '.r': 'R',
  '.m': 'Objective-C',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.fish': 'Shell',
  '.ps1': 'PowerShell',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SASS',
  '.less': 'LESS',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.md': 'Markdown',
  '.dockerfile': 'Dockerfile',
}

export function getLanguageFromPath(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase()
  return EXTENSION_TO_LANGUAGE[ext] || null
}

export function loadAllLogsFromSessionFile(filePath: string): LogOption[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())
  
  const messages: LogMessage[] = []
  for (const line of lines) {
    try {
      const msg = JSON.parse(line)
      messages.push(msg)
    } catch {
      // Skip invalid lines
    }
  }
  
  return [{
    messages,
    sessionId: path.basename(filePath, '.jsonl'),
    projectPath: path.dirname(filePath),
  }]
}

export function hasValidDates(log: LogOption): boolean {
  const timestamps = log.messages
    .map(m => m.timestamp)
    .filter((t): t is string => !!t)
  
  if (timestamps.length === 0) return false
  
  for (const ts of timestamps) {
    const date = new Date(ts)
    if (isNaN(date.getTime())) return false
    if (date.getFullYear() < 2020 || date.getFullYear() > 2030) return false
  }
  
  return true
}

export function logToSessionMeta(log: LogOption): SessionMeta {
  const sessionId = log.sessionId || 'unknown'
  const projectPath = log.projectPath || 'unknown'
  
  const timestamps = log.messages
    .map(m => m.timestamp)
    .filter((t): t is string => !!t)
    .sort()
  
  const startTime = timestamps[0] || new Date().toISOString()
  const endTime = timestamps[timestamps.length - 1] || startTime
  
  const start = new Date(startTime)
  const end = new Date(endTime)
  const durationMinutes = (end.getTime() - start.getTime()) / 60000
  
  const userMessages = log.messages.filter(m => m.type === 'user')
  const assistantMessages = log.messages.filter(m => m.type === 'assistant')
  
  // Extract tool stats
  const toolStats = extractToolStats(log)
  
  return {
    session_id: sessionId,
    project_path: projectPath,
    start_time: startTime,
    end_time: endTime,
    duration_minutes: durationMinutes,
    user_message_count: userMessages.length,
    assistant_message_count: assistantMessages.length,
    input_tokens: toolStats.inputTokens,
    output_tokens: toolStats.outputTokens,
    tool_counts: toolStats.toolCounts,
    languages: toolStats.languages,
    git_commits: toolStats.gitCommits,
    git_pushes: toolStats.gitPushes,
    user_interruptions: toolStats.userInterruptions,
    user_response_times: toolStats.userResponseTimes,
    tool_errors: toolStats.toolErrors,
    tool_error_categories: toolStats.toolErrorCategories,
    uses_task_agent: toolStats.usesTaskAgent,
    uses_mcp: toolStats.usesMcp,
    uses_web_search: toolStats.usesWebSearch,
    uses_web_fetch: toolStats.usesWebFetch,
    lines_added: toolStats.linesAdded,
    lines_removed: toolStats.linesRemoved,
    files_modified: toolStats.filesModified,
    message_hours: toolStats.messageHours,
    user_message_timestamps: toolStats.userMessageTimestamps,
  }
}

export function extractToolStats(log: LogOption): {
  toolCounts: Record<string, number>
  languages: Record<string, number>
  gitCommits: number
  gitPushes: number
  inputTokens: number
  outputTokens: number
  userInterruptions: number
  userResponseTimes: number[]
  toolErrors: number
  toolErrorCategories: Record<string, number>
  usesTaskAgent: boolean
  usesMcp: boolean
  usesWebSearch: boolean
  usesWebFetch: boolean
  linesAdded: number
  linesRemoved: number
  filesModified: Set<string>
  messageHours: number[]
  userMessageTimestamps: string[]
} {
  const toolCounts: Record<string, number> = {}
  const languages: Record<string, number> = {}
  let gitCommits = 0
  let gitPushes = 0
  let inputTokens = 0
  let outputTokens = 0
  let userInterruptions = 0
  const userResponseTimes: number[] = []
  let toolErrors = 0
  const toolErrorCategories: Record<string, number> = {}
  let usesTaskAgent = false
  let usesMcp = false
  let usesWebSearch = false
  let usesWebFetch = false
  let linesAdded = 0
  let linesRemoved = 0
  const filesModified = new Set<string>()
  const messageHours: number[] = []
  const userMessageTimestamps: string[] = []
  let lastAssistantTimestamp: string | null = null

  for (const msg of log.messages) {
    const msgTimestamp = msg.timestamp

    if (msg.type === 'user' && msg.message) {
      if (msgTimestamp) {
        userMessageTimestamps.push(msgTimestamp)
        
        // Calculate response time from last assistant message
        if (lastAssistantTimestamp) {
          const responseTime = new Date(msgTimestamp).getTime() - new Date(lastAssistantTimestamp).getTime()
          if (responseTime > 0 && responseTime < 600000) { // Max 10 min
            userResponseTimes.push(responseTime / 1000) // Convert to seconds
          }
        }
      }
      
      // Check for interruption patterns
      const content = JSON.stringify(msg.message.content).toLowerCase()
      if (content.includes('stop') || content.includes('wait') || content.includes('hold on')) {
        userInterruptions++
      }
      
      // Track message hour for time-of-day chart
      if (msgTimestamp) {
        const hour = new Date(msgTimestamp).getHours()
        messageHours.push(hour)
      }
    } else if (msg.type === 'assistant' && msg.message) {
      if (msgTimestamp) {
        lastAssistantTimestamp = msgTimestamp
      }
      
      // Count tokens
      const usage = msg.message.usage
      if (usage) {
        inputTokens += usage.input_tokens || 0
        outputTokens += usage.output_tokens || 0
      }
      
      // Extract tool usage from content
      const content = msg.message.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use' && block.name) {
            const toolName = block.name as string
            toolCounts[toolName] = (toolCounts[toolName] || 0) + 1
            
            // Check for task agent
            if (toolName === 'Agent' || toolName.includes('Subagent')) {
              usesTaskAgent = true
            }
            
            // Check for MCP
            if (toolName.startsWith('mcp__')) {
              usesMcp = true
            }
            
            // Check for web tools
            if (toolName === 'WebSearch' || toolName.includes('Search')) {
              usesWebSearch = true
            }
            if (toolName === 'WebFetch' || toolName.includes('Fetch')) {
              usesWebFetch = true
            }
            
            // Track file modifications
            if (block.input && typeof block.input === 'object') {
              const input = block.input as Record<string, unknown>
              if (input.file_path) {
                filesModified.add(input.file_path as string)
                const lang = getLanguageFromPath(input.file_path as string)
                if (lang) {
                  languages[lang] = (languages[lang] || 0) + 1
                }
              }
            }
          }
        }
      }
    }
  }

  return {
    toolCounts,
    languages,
    gitCommits,
    gitPushes,
    inputTokens,
    outputTokens,
    userInterruptions,
    userResponseTimes,
    toolErrors,
    toolErrorCategories,
    usesTaskAgent,
    usesMcp,
    usesWebSearch,
    usesWebFetch,
    linesAdded,
    linesRemoved,
    filesModified,
    messageHours,
    userMessageTimestamps,
  }
}

export function formatTranscriptForFacets(log: LogOption): string {
  const lines: string[] = []
  const meta = logToSessionMeta(log)

  lines.push(`Session: ${meta.session_id.slice(0, 8)}`)
  lines.push(`Date: ${meta.start_time}`)
  lines.push(`Project: ${meta.project_path}`)
  lines.push(`Duration: ${Math.round(meta.duration_minutes)} min`)
  lines.push('')

  for (const msg of log.messages) {
    if (msg.type === 'user' && msg.message) {
      const content = msg.message.content
      if (typeof content === 'string') {
        lines.push(`[User]: ${content.slice(0, 500)}`)
      } else if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            lines.push(`[User]: ${block.text.slice(0, 500)}`)
          }
        }
      }
    } else if (msg.type === 'assistant' && msg.message) {
      const content = msg.message.message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            lines.push(`[Assistant]: ${block.text.slice(0, 300)}`)
          } else if (block.type === 'tool_use' && block.name) {
            lines.push(`[Tool: ${block.name}]`)
          }
        }
      }
    }
  }

  return lines.join('\n')
}

// Meta-session detection (from source)
export function isMetaSession(log: LogOption): boolean {
  for (const msg of log.messages.slice(0, 5)) {
    if (msg.type === 'user' && msg.message) {
      const content = JSON.stringify(msg.message.content)
      if (content.includes('RESPOND WITH ONLY A VALID JSON OBJECT') || 
          content.includes('record_facets')) {
        return true
      }
    }
  }
  return false
}

// Substantive session filter (from source)
export function isSubstantiveSession(meta: SessionMeta): boolean {
  if (meta.user_message_count < 2) return false
  if (meta.duration_minutes < 1) return false
  return true
}
