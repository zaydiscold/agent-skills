/**
 * Gemini CLI Adapter
 * Converts Gemini's JSON session format to normalized schema
 * Format: ~/.gemini/tmp/<project_hash>/chats/session-<timestamp>-<uuid>.json
 */

import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import type { SessionAdapter, NormalizedSession, SessionInfo, NormalizedMessage, MessageRole, AgentType } from '../types.js';

const AGENT: AgentType = 'gemini';
const GEMINI_DIR = `${process.env.HOME}/.gemini`;
const TMP_DIR = `${GEMINI_DIR}/tmp`;

interface GeminiMessage {
  id: string;
  timestamp: string;
  type: 'user' | 'gemini' | 'error' | 'info' | 'warning' | 'system';
  content: string | Array<{text?: string; fileData?: unknown}>;
}

interface GeminiSession {
  sessionId: string;
  projectHash: string;
  startTime: string;
  lastUpdated: string;
  messages: GeminiMessage[];
  summary?: string;
  kind?: string;
}

function extractGeminiContent(content: GeminiMessage['content']): string {
  if (typeof content === 'string') return content;
  
  return content.map(part => {
    if (part.text) return part.text;
    if (part.fileData) return '[File attachment]';
    return '';
  }).join('\n');
}

function mapGeminiRole(type: string): MessageRole {
  switch (type) {
    case 'user': return 'user';
    case 'gemini': return 'assistant';
    case 'system': return 'system';
    case 'error': return 'system';
    case 'info': return 'system';
    case 'warning': return 'system';
    default: return 'assistant';
  }
}

export class GeminiAdapter implements SessionAdapter {
  name = AGENT;
  displayName = 'Gemini CLI';

  async isAvailable(): Promise<boolean> {
    try {
      await readdir(TMP_DIR);
      return true;
    } catch {
      return false;
    }
  }

  async scanSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    
    try {
      // Load projects.json for mapping
      let projectMap: Record<string, string> = {};
      try {
        const projectsJson = await readFile(`${GEMINI_DIR}/projects.json`, 'utf8');
        const projects = JSON.parse(projectsJson);
        // Invert the map: hash -> name
        for (const [path, hash] of Object.entries(projects.projects || {})) {
          projectMap[hash as string] = path.split('/').pop() || hash;
        }
      } catch {
        // No projects.json
      }
      
      const tmpEntries = await readdir(TMP_DIR, { withFileTypes: true });
      
      for (const entry of tmpEntries.filter(e => e.isDirectory())) {
        const chatsDir = join(TMP_DIR, entry.name, 'chats');
        
        try {
          const files = await readdir(chatsDir);
          
          for (const file of files.filter(f => f.startsWith('session-') && f.endsWith('.json'))) {
            const filePath = join(chatsDir, file);
            const stats = await stat(filePath);
            
            // Parse session file for metadata
            let title = projectMap[entry.name] || entry.name.slice(0, 8);
            let messageCount = 0;
            let timestamp = stats.mtime;
            
            try {
              const content = await readFile(filePath, 'utf8');
              const session: GeminiSession = JSON.parse(content);
              title = session.summary || title;
              messageCount = session.messages?.length || 0;
              timestamp = new Date(session.startTime || session.lastUpdated);
            } catch {
              // Use file stats
            }
            
            const sessionId = file.replace('session-', '').replace('.json', '');
            
            sessions.push({
              id: sessionId,
              agent: AGENT,
              path: filePath,
              title,
              timestamp,
              size: stats.size,
              messageCount
            });
          }
        } catch {
          // No chats dir
        }
      }
    } catch (error) {
      console.error('Error scanning Gemini sessions:', error);
    }
    
    return sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async parseSession(sessionId: string): Promise<NormalizedSession> {
    const sessions = await this.scanSessions();
    const sessionInfo = sessions.find(s => s.id === sessionId);
    
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const content = await readFile(sessionInfo.path, 'utf8');
    const geminiSession: GeminiSession = JSON.parse(content);
    
    const messages: NormalizedMessage[] = geminiSession.messages
      .filter(m => m.type === 'user' || m.type === 'gemini') // Only meaningful messages
      .map(m => ({
        id: m.id,
        role: mapGeminiRole(m.type),
        content: extractGeminiContent(m.content),
        timestamp: new Date(m.timestamp)
      }));
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const startTime = new Date(geminiSession.startTime);
    const endTime = new Date(geminiSession.lastUpdated);
    
    return {
      agent: AGENT,
      sessionId: geminiSession.sessionId,
      title: geminiSession.summary || sessionInfo.title,
      startTime,
      endTime,
      duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
      messages,
      stats: {
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length
      },
      projectContext: {
        projectName: sessionInfo.title
      },
      raw: geminiSession
    };
  }
}
