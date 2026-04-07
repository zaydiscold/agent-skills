/**
 * Insight Section Generation
 * Generates report sections from aggregated data and facets
 * Based on Claude Code's INSIGHT_SECTIONS (insights.ts lines 1336-1495)
 */

import type { 
  AggregatedData, 
  SessionFacets, 
  InsightResults,
  ProjectArea,
  ImpressiveWorkflow,
  FrictionCategory,
  FeatureSuggestion,
  UsagePattern,
  HorizonOpportunity,
  AtAGlance
} from '../types.js';

// Claude Code's insight section prompts
const INSIGHT_SECTIONS = {
  project_areas: (data: AggregatedData, facets: SessionFacets[]) => `Analyze this AI agent usage data and identify the main project areas or work categories the user focuses on.

Look at:
- Project names/paths from sessions
- Message content for domain keywords (web dev, mobile, data science, DevOps, etc.)
- Code mentions (React, Python, Go, Kubernetes, etc.)

Respond with a JSON object:
{
  "areas": [
    {
      "name": "Short descriptive name (e.g., 'Web Development', 'Data Pipeline')",
      "session_count": number,
      "description": "1-2 sentences describing what this work area involves"
    }
  ]
}

DATA:
${JSON.stringify(data.sessions.map(s => ({ agent: s.agent, project: s.projectContext?.projectName, title: s.title })))}`,

  interaction_style: (data: AggregatedData, facets: SessionFacets[]) => `Analyze this AI agent usage data and describe the user's interaction style.

Write in second person ('you'). 2-3 paragraphs analyzing:
- How they communicate with AI agents (brief vs detailed, structured vs conversational)
- What they primarily use agents for (coding, debugging, learning, brainstorming)
- Their workflow patterns (long sessions vs quick queries, single agent vs multi-agent)

Also include a key_pattern field with the single most distinctive pattern.

Respond with JSON:
{
  "narrative": "2-3 paragraph analysis",
  "key_pattern": "Most distinctive pattern in one sentence"
}`,

  what_works: (data: AggregatedData, facets: SessionFacets[]) => `Analyze this AI agent usage data and identify what's working well - impressive workflows or accomplishments.

Look for:
- Sessions with high satisfaction and clear outcomes
- Complex multi-step tasks completed successfully
- Sophisticated use of tools or features

Respond with JSON:
{
  "intro": "Optional overall intro sentence",
  "impressive_workflows": [
    {
      "title": "Short title (e.g., 'Multi-file Refactoring', 'Complex API Integration')",
      "description": "1-2 sentences describing the impressive work"
    }
  ]
}`,

  friction_analysis: (data: AggregatedData, facets: SessionFacets[]) => `Analyze this AI agent usage data and identify friction points or recurring issues.

Look at:
- Sessions with frustrated/dissatisfied signals
- Error patterns, misunderstandings, rejected actions
- Where things went wrong

Categorize friction into types like:
- Misunderstood requirements
- Wrong approach/implementation
- Code bugs or errors
- Context loss
- Tool failures

Respond with JSON:
{
  "intro": "Optional intro",
  "categories": [
    {
      "category": "Friction type name",
      "description": "What's happening and why it's a problem",
      "examples": ["Specific example 1", "Specific example 2"]
    }
  ]
}`,

  suggestions: (data: AggregatedData, facets: SessionFacets[]) => `Based on this AI agent usage analysis, suggest improvements and new approaches.

Include:
1. Features the user could try (based on gaps in their usage)
2. Usage patterns to adopt (based on what's working for them)
3. CLAUDE.md additions (if they use Claude) or similar personalization

Respond with JSON:
{
  "features_to_try": [
    {
      "feature": "Feature name",
      "one_liner": "Brief description",
      "why_for_you": "Why this fits this user's workflow",
      "example_code": "Optional example command"
    }
  ],
  "usage_patterns": [
    {
      "title": "Pattern name",
      "suggestion": "What to try",
      "detail": "Optional additional context",
      "copyable_prompt": "Optional prompt they can paste"
    }
  ]
}`,

  on_the_horizon: (data: AggregatedData, facets: SessionFacets[]) => `Based on this user's AI agent usage patterns, identify ambitious workflows that will become possible as models improve.

Think about:
- What they struggle with now that better models would solve
- Workflows that seem impossible with current capabilities
- How their usage could expand with more capable agents

Respond with JSON:
{
  "intro": "Optional intro about future possibilities",
  "opportunities": [
    {
      "title": "Opportunity name",
      "whats_possible": "What becomes possible with better models",
      "how_to_try": "Optional: how to start preparing",
      "copyable_prompt": "Optional future-ready prompt"
    }
  ]
}`
};

export interface SectionGenerator {
  generate(data: AggregatedData, facets: SessionFacets[]): Promise<InsightResults>;
}

/**
 * Generate all insight sections
 * In production, calls LLM API. For testing, returns mock data.
 */
export async function generateInsights(
  data: AggregatedData,
  facets: SessionFacets[],
  apiCall?: (prompt: string) => Promise<string>
): Promise<InsightResults> {
  const results: InsightResults = {};
  
  if (!apiCall) {
    // Return computed insights without AI
    return generateComputedInsights(data, facets);
  }
  
  // Generate sections in parallel
  const sectionPromises = [
    apiCall(INSIGHT_SECTIONS.project_areas(data, facets))
      .then(r => { results.project_areas = parseJsonResponse(r); })
      .catch(() => {}),
    
    apiCall(INSIGHT_SECTIONS.interaction_style(data, facets))
      .then(r => { results.interaction_style = parseJsonResponse(r); })
      .catch(() => {}),
    
    apiCall(INSIGHT_SECTIONS.what_works(data, facets))
      .then(r => { results.what_works = parseJsonResponse(r); })
      .catch(() => {}),
    
    apiCall(INSIGHT_SECTIONS.friction_analysis(data, facets))
      .then(r => { results.friction_analysis = parseJsonResponse(r); })
      .catch(() => {}),
    
    apiCall(INSIGHT_SECTIONS.suggestions(data, facets))
      .then(r => { results.suggestions = parseJsonResponse(r); })
      .catch(() => {}),
    
    apiCall(INSIGHT_SECTIONS.on_the_horizon(data, facets))
      .then(r => { results.on_the_horizon = parseJsonResponse(r); })
      .catch(() => {})
  ];
  
  await Promise.all(sectionPromises);
  
  // Generate at_a_glance using results from other sections
  results.at_a_glance = await generateAtAGlance(data, facets, results, apiCall);
  
  return results;
}

function parseJsonResponse(response: string): any {
  const match = response.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return {};
}

/**
 * Generate computed insights without AI
 */
function generateComputedInsights(data: AggregatedData, facets: SessionFacets[]): InsightResults {
  // Count sessions per agent
  const agentBreakdown = data.agentBreakdown;
  
  // Identify project areas from session paths/names
  const projectAreas = new Map<string, number>();
  for (const session of data.sessions) {
    const project = session.projectContext?.projectName || 'Unknown';
    projectAreas.set(project, (projectAreas.get(project) || 0) + 1);
  }
  
  const areas: ProjectArea[] = Array.from(projectAreas.entries())
    .slice(0, 6)
    .map(([name, count]) => ({
      name,
      session_count: count,
      description: `Work on ${name} using ${Object.entries(agentBreakdown)
        .filter(([_, c]) => c > 0)
        .map(([a]) => a)
        .join(', ')}`
    }));
  
  // Calculate satisfaction distribution
  const satisfactionTotals = { happy: 0, satisfied: 0, likely_satisfied: 0, dissatisfied: 0, frustrated: 0, unsure: 0 };
  for (const f of facets) {
    for (const [key, val] of Object.entries(f.user_satisfaction_counts || {})) {
      satisfactionTotals[key as keyof typeof satisfactionTotals] += val;
    }
  }
  
  // Build narrative
  const dominantAgent = Object.entries(agentBreakdown)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
  
  const narrative = `You primarily use ${dominantAgent} for your AI-assisted work, with a total of ${data.sessions.length} sessions across ${Object.keys(agentBreakdown).filter(k => agentBreakdown[k as AgentType] > 0).length} different agents. Your work spans ${areas.length} main project areas. You tend to have ${data.totalMessages / data.sessions.length > 20 ? 'longer, in-depth' : 'brief, focused'} conversations with AI agents.`;
  
  return {
    project_areas: { areas },
    interaction_style: {
      narrative,
      key_pattern: `Primary use of ${dominantAgent}`
    },
    what_works: {
      impressive_workflows: [
        {
          title: 'Multi-Agent Workflow',
          description: `Using ${Object.keys(agentBreakdown).filter(k => agentBreakdown[k as AgentType] > 0).join(', ')} for different aspects of your work`
        }
      ]
    },
    friction_analysis: {
      categories: [
        {
          category: 'Learning Curve',
          description: 'Adapting to different agent interfaces and capabilities',
          examples: ['Understanding tool availability', 'Switching between agents']
        }
      ]
    },
    suggestions: {
      features_to_try: [
        {
          feature: 'Agent-Specific Workflows',
          one_liner: 'Use each agent for what it does best',
          why_for_you: `You already use multiple agents - optimize which for which task`,
          example_code: 'Use Claude for complex tasks, Cursor for quick edits'
        }
      ],
      usage_patterns: [
        {
          title: 'Unified Session History',
          suggestion: 'Track work across all agents in one place',
          copyable_prompt: 'Show me my recent work across all AI agents'
        }
      ]
    },
    on_the_horizon: {
      opportunities: [
        {
          title: 'Cross-Agent Memory',
          whats_possible: 'Agents sharing context so you don\'t repeat yourself',
          how_to_try: 'Use consistent project structure across agents'
        }
      ]
    }
  };
}

/**
 * Generate "At a Glance" summary
 */
async function generateAtAGlance(
  data: AggregatedData,
  facets: SessionFacets[],
  insights: InsightResults,
  apiCall?: (prompt: string) => Promise<string>
): Promise<AtAGlance> {
  const prompt = `Write an "At a Glance" summary for this AI agent usage report.

4-part structure:
1. **What's working** - User's unique style and impactful things done
2. **What's hindering you** - (a) AI limitations, (b) user-side friction
3. **Quick wins to try** - Specific improvements from suggestions
4. **Ambitious workflows for better models** - Future possibilities

Keep each section to 2-3 sentences. Coaching tone.

DATA:
- Sessions: ${data.sessions.length}
- Agents used: ${Object.keys(data.agentBreakdown).filter(k => data.agentBreakdown[k as AgentType] > 0).join(', ')}
- Project areas: ${insights.project_areas?.areas?.length || 0}

Respond with JSON:
{
  "whats_working": "...",
  "whats_hindering": "...",
  "quick_wins": "...",
  "ambitious_workflows": "..."
}`;

  if (!apiCall) {
    return {
      whats_working: `You effectively use ${Object.keys(data.agentBreakdown).filter(k => data.agentBreakdown[k as AgentType] > 0).length} different AI agents across ${data.sessions.length} sessions.`,
      whats_hindering: `Switching between different agent interfaces with no shared context. Each agent works in isolation.`,
      quick_wins: `Standardize which agent you use for which task type. Document your preferred workflows.`,
      ambitious_workflows: `As models improve, expect seamless agent collaboration and persistent cross-agent memory.`
    };
  }
  
  try {
    const response = await apiCall(prompt);
    return parseJsonResponse(response) as AtAGlance;
  } catch {
    return {
      whats_working: `Active AI-assisted workflow across multiple tools.`,
      whats_hindering: `Fragmented context across different agents.`,
      quick_wins: `Document agent-specific use cases.`,
      ambitious_workflows: `Unified agent ecosystem with shared memory.`
    };
  }
}
