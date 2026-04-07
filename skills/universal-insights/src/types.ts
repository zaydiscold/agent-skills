/**
 * Universal Insights - Core Types
 * Normalized schema that all agent formats convert to
 */

export type AgentType = 'claude' | 'cursor' | 'gemini' | 'codex' | 'antigravity';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type SessionOutcome = 'fully_achieved' | 'mostly_achieved' | 'partially_achieved' | 'not_achieved' | 'unclear';

export type UserSatisfaction = 'happy' | 'satisfied' | 'likely_satisfied' | 'dissatisfied' | 'frustrated' | 'unsure';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  status: 'success' | 'error';
  content: string;
}

export interface NormalizedMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
    };
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
  };
}

export interface CodeChangeStats {
  filesModified?: number;
  linesAdded?: number;
  linesDeleted?: number;
  filesCreated?: number;
}

export interface ProjectContext {
  cwd?: string;
  gitBranch?: string;
  gitRepo?: string;
  projectName?: string;
}

export interface NormalizedSession {
  agent: AgentType;
  sessionId: string;
  title?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // minutes
  messages: NormalizedMessage[];
  stats: {
    messageCount: number;
    userMessageCount: number;
    assistantMessageCount: number;
    toolCalls?: number;
    codeChanges?: CodeChangeStats;
  };
  projectContext?: ProjectContext;
  raw?: unknown; // Original format for debugging
}

// Facets extracted by AI analysis
export interface SessionFacets {
  underlying_goal: string;
  goal_categories: Record<string, number>;
  outcome: SessionOutcome;
  user_satisfaction_counts: Record<string, number>;
  claude_helpfulness: 'unhelpful' | 'slightly_helpful' | 'moderately_helpful' | 'very_helpful' | 'essential';
  session_type: 'single_task' | 'multi_task' | 'iterative_refinement' | 'exploration' | 'quick_question';
  friction: {
    counts: Record<string, number>;
    detail: string;
  };
  success_factors: string[];
  brief_summary: string;
}

// Insight sections for report generation
export interface ProjectArea {
  name: string;
  session_count: number;
  description: string;
}

export interface ImpressiveWorkflow {
  title: string;
  description: string;
}

export interface FrictionCategory {
  category: string;
  description: string;
  examples?: string[];
}

export interface FeatureSuggestion {
  feature: string;
  one_liner: string;
  why_for_you: string;
  example_code?: string;
}

export interface UsagePattern {
  title: string;
  suggestion: string;
  detail?: string;
  copyable_prompt?: string;
}

export interface HorizonOpportunity {
  title: string;
  whats_possible: string;
  how_to_try?: string;
  copyable_prompt?: string;
}

export interface AtAGlance {
  whats_working: string;
  whats_hindering: string;
  quick_wins: string;
  ambitious_workflows: string;
}

export interface InsightResults {
  project_areas?: { areas: ProjectArea[] };
  interaction_style?: { narrative: string; key_pattern?: string };
  what_works?: { intro?: string; impressive_workflows: ImpressiveWorkflow[] };
  friction_analysis?: { intro?: string; categories: FrictionCategory[] };
  suggestions?: {
    claude_md_additions?: any[];
    features_to_try?: FeatureSuggestion[];
    usage_patterns?: UsagePattern[];
  };
  on_the_horizon?: { intro?: string; opportunities: HorizonOpportunity[] };
  at_a_glance?: AtAGlance;
}

export interface AggregatedData {
  sessions: NormalizedSession[];
  totalMessages: number;
  totalUserMessages: number;
  agentBreakdown: Record<AgentType, number>;
  timeDistribution: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  dailySessionCounts: Record<string, number>;
}

// Adapter interface
export interface SessionAdapter {
  name: AgentType;
  displayName: string;
  
  /** Check if this agent is installed and has session data */
  isAvailable(): Promise<boolean>;
  
  /** Get list of all sessions without full parsing */
  scanSessions(): Promise<SessionInfo[]>;
  
  /** Parse full session content */
  parseSession(sessionId: string): Promise<NormalizedSession>;
}

export interface SessionInfo {
  id: string;
  agent: AgentType;
  path: string;
  title?: string;
  timestamp: Date;
  size?: number;
  messageCount?: number;
}
