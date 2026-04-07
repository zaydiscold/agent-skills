/**
 * Claude Code Adapter
 * Converts Claude's rich JSONL format to normalized schema
 * Based on: claude-code-leak/src/types/logs.ts
 */

import { readFile } from 'fs/promises';
import { readdir } from 'fs/promises';
import { join } from 'path';
import type { SessionAdapter, NormalizedSession, SessionInfo, NormalizedMessage, MessageRole, AgentType } from '../types.js';

const AGENT: AgentType = 'claude';
const PROJECTS_DIR = `${process.env.HOME}/.claude/projects`;

// Claude-specific entry types from the JSONL
interface ClaudeEntry {
  type: 'user' | 'assistant' | 'system' | 'attachment' | 'queue-operation' | 'file-history-snapshot' | 'permission-mode';
  uuid: string;
  parentUuid?: string | null;
  timestamp: string;
  sessionId: string;
  message?: {
    role: 'user' | 'assistant';
    content: string | ContentBlock[];
    model?: string;
    stop_reason?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  attachment?: {
    type: string;
  };
  isMeta?: boolean;
  cwd?: string;
  gitBranch?: string;
}

type ContentBlock = 
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
  | { type: 'thinking'; thinking: string }
  | { type: 'redacted_thinking'; data: string };

function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  
  return content.map(block => {
    switch (block.type) {
      case 'text': return block.text;
      case 'thinking': return `[Thinking: ${block.thinking.slice(0, 100)}...]`;
      case 'tool_use': return `[Tool: ${block.name}]`;
      case 'tool_result': return `[Result: ${block.content.slice(0, 100)}...]`;
      default: return '';
    }
  }).join('\n');
}

function mapRole(role: string): MessageRole {
  switch (role) {
    case 'user': return 'user';
    case 'assistant': return 'assistant';
    case 'system': return 'system';
    default: return 'assistant';
  }
}

export class ClaudeAdapter implements SessionAdapter {
  name = AGENT;
  displayName = 'Claude Code';

  async isAvailable(): Promise<boolean> {
    try {
      await readdir(PROJECTS_DIR);
      return true;
    } catch {
      return false;
    }
  }

  async scanSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    
    try {
      const projects = await readdir(PROJECTS_DIR, { withFileTypes: true });
      
      for (const project of projects.filter(p => p.isDirectory())) {
        const projectPath = join(PROJECTS_DIR, project.name);
        const files = await readdir(projectPath);
        
        for (const file of files.filter(f => f.endsWith('.jsonl'))) {
          const sessionId = file.replace('.jsonl', '');
          const stat = await readFile(join(projectPath, file), 'utf8')
            .then(content => {
              const lines = content.trim().split('\n').filter(l => l);
              const firstLine = lines[0] ? JSON.parse(lines[0]) : null;
              return {
                size: content.length,
                timestamp: firstLine?.timestamp ? new Date(firstLine.timestamp) : new Date(),
                messageCount: lines.length
              };
            })
            .catch(() => ({ size: 0, timestamp: new Date(), messageCount: 0 }));
          
          sessions.push({
            id: sessionId,
            agent: AGENT,
            path: join(projectPath, file),
            title: project.name.replace(/-/g, '/'),
            timestamp: stat.timestamp,
            size: stat.size,
            messageCount: stat.messageCount
          });
        }
      }
    } catch (error) {
      console.error('Error scanning Claude sessions:', error);
    }
    
    return sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async parseSession(sessionId: string): Promise<NormalizedSession> {
    // Find the session file
    const sessions = await this.scanSessions();
    const sessionInfo = sessions.find(s => s.id === sessionId);
    
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const content = await readFile(sessionInfo.path, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    
    const entries: ClaudeEntry[] = [];
    for (const line of lines.slice(0, 1000)) { // Limit to first 1000 entries for perf
      try {
        entries.push(JSON.parse(line));
      } catch {
        // Skip malformed lines
      }
    }
    
    const messages: NormalizedMessage[] = [];
    let startTime = new Date();
    let endTime: Date | undefined;
    let projectContext: { cwd?: string; gitBranch?: string } = {};
    
    for (const entry of entries) {
      if (entry.type === 'user' || entry.type === 'assistant') {
        if (!entry.message) continue;
        
        const msg: NormalizedMessage = {
          id: entry.uuid,
          role: mapRole(entry.message.role),
          content: extractTextContent(entry.message.content),
          timestamp: new Date(entry.timestamp),
          metadata: {
            model: entry.message.model,
            tokens: entry.message.usage ? {
              input: entry.message.usage.input_tokens,
              output: entry.message.usage.output_tokens
            } : undefined
          }
        };
        messages.push(msg);
        
        // Track project context
        if (entry.cwd) projectContext.cwd = entry.cwd;
        if (entry.gitBranch) projectContext.gitBranch = entry.gitBranch;
      }
      
      // Track timing from first/last entries
      if (entries.indexOf(entry) === 0) {
        startTime = new Date(entry.timestamp);
      }
      endTime = new Date(entry.timestamp);
    }
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    return {
      agent: AGENT,
      sessionId,
      title: sessionInfo.title,
      startTime,
      endTime,
      duration: endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 60000) : undefined,
      messages,
      stats: {
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length
      },
      projectContext: {
        cwd: projectContext.cwd,
        gitBranch: projectContext.gitBranch,
        projectName: sessionInfo.title
      },
      raw: entries.slice(0, 10) // Store sample for debugging
    };
  }
}
