/**
 * Adapter Registry
 * Exports all agent adapters and provides unified access
 */

import { ClaudeAdapter } from './claude.js';
import { CursorAdapter } from './cursor.js';
import { GeminiAdapter } from './gemini.js';
import { CodexAdapter } from './codex.js';
import type { SessionAdapter, SessionInfo, NormalizedSession, AgentType } from '../types.js';

export const adapters: SessionAdapter[] = [
  new ClaudeAdapter(),
  new CursorAdapter(),
  new GeminiAdapter(),
  new CodexAdapter()
];

export async function getAvailableAdapters(): Promise<SessionAdapter[]> {
  const available: SessionAdapter[] = [];
  for (const adapter of adapters) {
    if (await adapter.isAvailable()) {
      available.push(adapter);
    }
  }
  return available;
}

export async function scanAllSessions(): Promise<SessionInfo[]> {
  const available = await getAvailableAdapters();
  const allSessions: SessionInfo[] = [];
  
  for (const adapter of available) {
    try {
      const sessions = await adapter.scanSessions();
      allSessions.push(...sessions);
    } catch (error) {
      console.error(`Error scanning ${adapter.name}:`, error);
    }
  }
  
  return allSessions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function parseSession(sessionId: string, agent: AgentType): Promise<NormalizedSession> {
  const adapter = adapters.find(a => a.name === agent);
  if (!adapter) {
    throw new Error(`Unknown agent: ${agent}`);
  }
  return adapter.parseSession(sessionId);
}

export { ClaudeAdapter, CursorAdapter, GeminiAdapter, CodexAdapter };
