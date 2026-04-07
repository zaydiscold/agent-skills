/**
 * Cursor Adapter
 * Converts Cursor's SQLite-based chat format to normalized schema
 * Format: ~/.cursor/chats/<hash>/<conversation_id>/store.db
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import type { SessionAdapter, NormalizedSession, SessionInfo, NormalizedMessage, MessageRole, AgentType } from '../types.js';

// We'll use dynamic import for better-sqlite3 since it's a native module
let Database: typeof import('better-sqlite3') | null = null;

const AGENT: AgentType = 'cursor';
const CURSOR_DIR = `${process.env.HOME}/.cursor`;
const CHATS_DIR = `${CURSOR_DIR}/chats`;
const AI_TRACKING_DB = `${CURSOR_DIR}/ai-tracking/ai-code-tracking.db`;

interface CursorMeta {
  agentId?: string;
  latestRootBlobId?: string;
  name?: string;
  mode?: string;
  createdAt?: number;
  lastUsedModel?: string;
}

interface CursorMessage {
  role: string;
  content: string;
  timestamp?: number;
}

function mapCursorRole(role: string): MessageRole {
  switch (role) {
    case 'user': return 'user';
    case 'assistant': return 'assistant';
    case 'system': return 'system';
    default: return 'assistant';
  }
}

export class CursorAdapter implements SessionAdapter {
  name = AGENT;
  displayName = 'Cursor';

  private async getDatabase() {
    if (!Database) {
      const sqlite = await import('better-sqlite3');
      Database = sqlite.default || sqlite;
    }
    return Database;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await readdir(CHATS_DIR);
      return true;
    } catch {
      return false;
    }
  }

  async scanSessions(): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];
    
    try {
      const workspaceDirs = await readdir(CHATS_DIR, { withFileTypes: true });
      
      for (const workspace of workspaceDirs.filter(d => d.isDirectory())) {
        const workspacePath = join(CHATS_DIR, workspace.name);
        
        try {
          const conversationDirs = await readdir(workspacePath, { withFileTypes: true });
          
          for (const conv of conversationDirs.filter(d => d.isDirectory())) {
            const storePath = join(workspacePath, conv.name, 'store.db');
            
            try {
              // Try to read metadata from SQLite
              const sqlite = await this.getDatabase();
              const db = new sqlite(storePath);
              
              // Get meta
              const metaRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('conversation') as { value: string } | undefined;
              const meta: CursorMeta = metaRow ? JSON.parse(metaRow.value) : {};
              
              // Count blobs as proxy for message count
              const countRow = db.prepare('SELECT COUNT(*) as count FROM blobs').get() as { count: number } | undefined;
              
              db.close();
              
              sessions.push({
                id: conv.name,
                agent: AGENT,
                path: storePath,
                title: meta.name || `Chat ${conv.name.slice(0, 8)}`,
                timestamp: meta.createdAt ? new Date(meta.createdAt) : new Date(),
                messageCount: countRow?.count || 0
              });
            } catch {
              // Skip corrupted/unreadable stores
            }
          }
        } catch {
          // Skip workspace
        }
      }
    } catch (error) {
      console.error('Error scanning Cursor sessions:', error);
    }
    
    return sessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async parseSession(sessionId: string): Promise<NormalizedSession> {
    const sessions = await this.scanSessions();
    const sessionInfo = sessions.find(s => s.id === sessionId);
    
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const sqlite = await this.getDatabase();
    const db = new sqlite(sessionInfo.path);
    
    // Read meta
    const metaRow = db.prepare('SELECT value FROM meta WHERE key = ?').get('conversation') as { value: string } | undefined;
    const meta: CursorMeta = metaRow ? JSON.parse(metaRow.value) : {};
    
    // Read all blobs - these contain the messages as JSON
    const blobs = db.prepare('SELECT id, data FROM blobs').all() as Array<{ id: string; data: Buffer }>;
    db.close();
    
    const messages: NormalizedMessage[] = [];
    let startTime = new Date(meta.createdAt || Date.now());
    
    for (const blob of blobs) {
      try {
        const data = JSON.parse(blob.data.toString('utf8'));
        
        // Cursor stores messages with role and content
        if (data.role && data.content) {
          const msg: NormalizedMessage = {
            id: blob.id,
            role: mapCursorRole(data.role),
            content: typeof data.content === 'string' ? data.content : JSON.stringify(data.content),
            timestamp: new Date(data.timestamp || meta.createdAt || Date.now())
          };
          messages.push(msg);
        }
      } catch {
        // Skip non-JSON blobs
      }
    }
    
    // Sort by timestamp
    messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const endTime = messages.length > 0 ? messages[messages.length - 1].timestamp : startTime;
    
    return {
      agent: AGENT,
      sessionId,
      title: meta.name || sessionInfo.title,
      startTime,
      endTime,
      duration: Math.round((endTime.getTime() - startTime.getTime()) / 60000),
      messages,
      stats: {
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length
      },
      raw: { meta, blobCount: blobs.length }
    };
  }
}
