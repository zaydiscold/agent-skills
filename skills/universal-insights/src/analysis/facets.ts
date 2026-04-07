/**
 * Facet Extraction
 * AI-powered analysis of sessions to extract structured insights
 * Ported from Claude Code's insights.ts
 */

import type { NormalizedSession, SessionFacets, MessageRole } from '../types.js';

// The facet extraction prompt from Claude Code (insights.ts lines 1001-1055)
const FACET_EXTRACTION_PROMPT = `Analyze this AI agent session and extract structured facets.

Session content provided as a transcript of messages between user and assistant.

CRITICAL GUIDELINES:

1. **goal_categories**: Count ONLY what the USER explicitly asked for.
   - DO NOT count the assistant's autonomous exploration
   - DO NOT count work the assistant decided to do on its own
   - ONLY count when user says "can you...", "please...", "I need...", "let's...", asks a question, or gives a direct instruction

2. **user_satisfaction_counts**: Base ONLY on explicit user signals in the conversation.
   - "Yay!", "great!", "perfect!", "awesome" → happy
   - "thanks", "looks good", "that works", "good job" → satisfied
   - "ok, now let's..." (continuing without complaint) → likely_satisfied
   - "that's not right", "try again", "no that's wrong" → dissatisfied
   - "this is broken", "I give up", "stop", "forget it" → frustrated
   - If unclear or no explicit signal → unsure

3. **friction_counts**: Be specific about what went wrong. Common categories:
   - misunderstood_request: Assistant interpreted the request incorrectly
   - wrong_approach: Right goal but wrong solution method
   - buggy_code: Code had bugs or didn't work correctly
   - user_rejected_action: User said no/stop to an action
   - hallucination: Assistant made up information
   - tool_error: A tool call failed or returned error
   - context_loss: Assistant lost track of previous context

4. **outcome**: Did the user achieve their goal?
   - fully_achieved: User got exactly what they wanted
   - mostly_achieved: Minor gaps but core goal met
   - partially_achieved: Significant parts missing
   - not_achieved: Goal not met at all
   - unclear_from_transcript: Cannot determine from conversation

5. **session_type**:
   - single_task: One focused task completed
   - multi_task: Multiple distinct tasks in one session
   - iterative_refinement: Building/refining through multiple rounds
   - exploration: Open-ended exploration without clear goal
   - quick_question: Simple Q&A, no substantial work

6. **claude_helpfulness**: How much did the assistant help?
   - unhelpful: Didn't help or made things worse
   - slightly_helpful: Minor assistance
   - moderately_helpful: Good help but user did significant work
   - very_helpful: Assistant did most of the work
   - essential: Couldn't have done it without the assistant

RESPOND WITH ONLY A VALID JSON OBJECT matching this schema:
{
  "underlying_goal": "What the user fundamentally wanted to achieve (1 sentence)",
  "goal_categories": {"category_name": count, ...},
  "outcome": "fully_achieved|mostly_achieved|partially_achieved|not_achieved|unclear_from_transcript",
  "user_satisfaction_counts": {"happy": 0, "satisfied": 0, "likely_satisfied": 0, "dissatisfied": 0, "frustrated": 0, "unsure": 0},
  "claude_helpfulness": "unhelpful|slightly_helpful|moderately_helpful|very_helpful|essential",
  "session_type": "single_task|multi_task|iterative_refinement|exploration|quick_question",
  "friction_counts": {"misunderstood_request": 0, "wrong_approach": 0, "buggy_code": 0, "user_rejected_action": 0, "hallucination": 0, "tool_error": 0, "context_loss": 0},
  "friction_detail": "One sentence describing the main friction point, or empty if none",
  "success_factors": ["factor1", "factor2"],
  "brief_summary": "One sentence: what user wanted and whether they got it"
}

SESSION TRANSCRIPT:`;

function formatSessionForAnalysis(session: NormalizedSession): string {
  const lines: string[] = [];
  lines.push(`Agent: ${session.agent}`);
  lines.push(`Project: ${session.projectContext?.projectName || 'Unknown'}`);
  lines.push(`Date: ${session.startTime.toISOString()}`);
  lines.push(`Messages: ${session.stats.messageCount}`);
  lines.push('');
  lines.push('--- TRANSCRIPT ---');
  lines.push('');
  
  for (const msg of session.messages.slice(0, 50)) { // First 50 messages for token limits
    const role = msg.role === 'user' ? 'USER' : msg.role === 'assistant' ? 'ASSISTANT' : msg.role;
    const content = msg.content.slice(0, 500); // Truncate long messages
    lines.push(`[${role}] ${content}`);
    lines.push('');
  }
  
  return lines.join('\n');
}

export interface FacetExtractionResult {
  sessionId: string;
  agent: string;
  facets: SessionFacets;
  extractedAt: Date;
}

/**
 * Extract facets from a single session
 * In production, this calls an LLM API. For now, we'll return a mock for testing.
 */
export async function extractFacets(
  session: NormalizedSession,
  apiCall?: (prompt: string) => Promise<string>
): Promise<FacetExtractionResult> {
  const transcript = formatSessionForAnalysis(session);
  const fullPrompt = `${FACET_EXTRACTION_PROMPT}\n\n${transcript}`;
  
  // If no API provided, return basic computed facets
  if (!apiCall) {
    return {
      sessionId: session.sessionId,
      agent: session.agent,
      facets: computeBasicFacets(session),
      extractedAt: new Date()
    };
  }
  
  try {
    const response = await apiCall(fullPrompt);
    // Parse JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const facets: SessionFacets = JSON.parse(jsonMatch[0]);
      return {
        sessionId: session.sessionId,
        agent: session.agent,
        facets,
        extractedAt: new Date()
      };
    }
  } catch (error) {
    console.error('Facet extraction failed:', error);
  }
  
  // Fallback to basic computation
  return {
    sessionId: session.sessionId,
    agent: session.agent,
    facets: computeBasicFacets(session),
    extractedAt: new Date()
  };
}

/**
 * Compute basic facets without AI
 * Used as fallback when AI extraction fails
 */
function computeBasicFacets(session: NormalizedSession): SessionFacets {
  const messages = session.messages;
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  // Analyze user sentiment from keywords
  const satisfactionCounts = {
    happy: 0,
    satisfied: 0,
    likely_satisfied: 0,
    dissatisfied: 0,
    frustrated: 0,
    unsure: 0
  };
  
  const happyWords = ['great', 'awesome', 'perfect', 'yay', 'excellent', 'amazing', 'love'];
  const satisfiedWords = ['thanks', 'good', 'works', 'nice', 'cool', 'ok'];
  const frustratedWords = ['broken', 'wtf', 'damn', 'shit', 'fuck', 'hate', 'garbage'];
  const dissatisfiedWords = ['wrong', 'not right', 'bad', 'error', 'fail', 'doesnt work'];
  
  for (const msg of userMessages) {
    const lower = msg.content.toLowerCase();
    if (happyWords.some(w => lower.includes(w))) satisfactionCounts.happy++;
    else if (frustratedWords.some(w => lower.includes(w))) satisfactionCounts.frustrated++;
    else if (dissatisfiedWords.some(w => lower.includes(w))) satisfactionCounts.dissatisfied++;
    else if (satisfiedWords.some(w => lower.includes(w))) satisfactionCounts.satisfied++;
    else satisfactionCounts.unsure++;
  }
  
  // Detect code-related sessions
  const hasCode = messages.some(m => 
    /```|function|class|const|let|var|import|export/.test(m.content)
  );
  
  // Determine session type
  let sessionType: SessionFacets['session_type'] = 'single_task';
  if (userMessages.length > 10) sessionType = 'iterative_refinement';
  else if (userMessages.length <= 2) sessionType = 'quick_question';
  
  return {
    underlying_goal: hasCode ? 'Software development task' : 'General assistance',
    goal_categories: { coding: hasCode ? 1 : 0, general: 1 },
    outcome: 'unclear_from_transcript',
    user_satisfaction_counts: satisfactionCounts,
    claude_helpfulness: assistantMessages.length > userMessages.length ? 'very_helpful' : 'moderately_helpful',
    session_type: sessionType,
    friction: {
      counts: {},
      detail: ''
    },
    success_factors: [],
    brief_summary: `${session.agent} session with ${messages.length} messages about ${hasCode ? 'coding' : 'general topics'}`
  };
}

/**
 * Extract facets from multiple sessions in parallel
 */
export async function extractFacetsBatch(
  sessions: NormalizedSession[],
  apiCall?: (prompt: string) => Promise<string>,
  concurrency: number = 5
): Promise<FacetExtractionResult[]> {
  const results: FacetExtractionResult[] = [];
  
  // Process in batches
  for (let i = 0; i < sessions.length; i += concurrency) {
    const batch = sessions.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(s => extractFacets(s, apiCall).catch(() => ({
        sessionId: s.sessionId,
        agent: s.agent,
        facets: computeBasicFacets(s),
        extractedAt: new Date()
      })))
    );
    results.push(...batchResults);
  }
  
  return results;
}
