/**
 * Universal Insights - Main Library Export
 */

export * from './types.js';
export { ClaudeAdapter, CursorAdapter, GeminiAdapter, CodexAdapter } from './adapters/index.js';
export { scanAllSessions, parseSession, getAvailableAdapters } from './adapters/index.js';
export { extractFacets, extractFacetsBatch } from './analysis/facets.js';
export { generateInsights } from './analysis/sections.js';
export { generateHtmlReport } from './report/html.js';
