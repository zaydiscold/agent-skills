/**
 * Codex Adapter
 * Converts OpenAI Codex's JSONL format to normalized schema
 * Format: ~/.codex/history.jsonl, ~/.codex/session_index.jsonl
 */

import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import type { SessionAdapter, NormalizedSession, SessionInfo, NormalizedMessage, MessageRole, AgentType } from '../types.js';

const AGENT: AgentType = 'codex';
const CODEX_DIR = `${process.env.HOME}/.codex`;
const SESSION_INDEX = `${CODEX_DIR}/session_index.jsonl`;
const HISTORY_FILE = `${CODEX_DIR}/history.jsonl`;

interface CodexSessionIndex {
  id: string;
  thread_name?: string;
  updated_at: string;
}

interface CodexHistoryEntry {
  session_id: string;
  ts: number; // Unix timestamp
  text: string;
  // May have additional fields
}

function detectRole(text: string): MessageRole {
  // Codex history appears to be flat text
  // We'll need to infer from context or alternate entries
  return 'user'; // Default - caller may need to alternate
}

export class CodexAdapter implements SessionAdapter {
  name = AGENT;
  displayName = 'Codex (OpenAI)';

  async isAvailable(): Promise<boolean> {
    try {
      await readFile(SESSION_INDEX);
      return true;
    } catch {
      return false;
    }
  }

  async scanSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    
    try {
      // Read session index
      const indexContent = await readFile(SESSION_INDEX, 'utf8');
      const lines = indexContent.trim().split('\n').filter(l => l);
      
      // Count messages per session from history
      const historyContent = await readFile(HISTORY_FILE, 'utf8').catch(() => '');
      const historyLines = historyContent.trim().split('\n').filter(l => l);
      
      const messageCounts: Record<string, number> = {};
      for (const line of historyLines) {
        try {
          const entry: CodexHistoryEntry = JSON.parse(line);
          messageCounts[entry.session_id] = (messageCounts[entry.session_id] || 0) + 1;
        } catch {}
      }
      
      for (const line of lines) {
        try {
          const session: CodexSessionIndex = JSON.parse(line);
          sessions.push({
            id: session.id,
            agent: AGENT,
            path: HISTORY_FILE, // All in one file
            title: session.thread_name || `Session ${session.id.slice(0, 8)}`,
            timestamp: new Date(session.updated_at),
            messageCount: messageCounts[session.id] || 0
          });
        } catch {}
      }
    } catch (error) {
      console.error('Error scanning Codex sessions:', error);
    }
    
    return sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async parseSession(sessionId: string): Promise<NormalizedSession> {
    const sessions = await this.scanSessions();
    const sessionInfo = sessions.find(s => s.id === sessionId);
    
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Read full history and filter for this session
    const historyContent = await readFile(HISTORY_FILE, 'utf8');
    const lines = historyContent.trim().split('\n').filter(l => l);
    
    const sessionEntries: CodexHistoryEntry[] = [];
    for (const line of lines) {
      try {
        const entry: CodexHistoryEntry = JSON.parse(line);
        if (entry.session_id === sessionId) {
          sessionEntries.push(entry);
        }
      } catch {}
    }
    
    // Sort by timestamp
    sessionEntries.sort((a, b) => a.ts - b.ts);
    
    // Build messages - alternate assuming user/assistant/user/assistant
    const messages: NormalizedMessage[] = sessionEntries.map((entry, i) => ({
      id: `${sessionId}-${i}`,
      role: i % 2 === 0 ? 'user' : 'assistant', // Alternating
      content: entry.text,
      timestamp: new Date(entry.ts * 1000)
    }));
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const startTime = messages.length > 0 ? messages[0].timestamp : new Date();
    const endTime = messages.length > 0 ? messages[messages.length - 1].timestamp : startTime;
    
    return {
      agent: AGENT,
      sessionId,
      title: sessionInfo.title,
      startTime,
      endTime,
      duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
      messages,
      stats: {
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length
      },
      raw: { entryCount: sessionEntries.length }
    };
  }
}
