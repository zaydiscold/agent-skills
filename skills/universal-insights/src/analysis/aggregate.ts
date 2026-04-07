import { SessionMeta, SessionFacets, AggregatedData } from '../types'

export function aggregateData(
  sessions: SessionMeta[],
  facets: Map<string, SessionFacets>,
): AggregatedData {
  const result: AggregatedData = {
    total_sessions: sessions.length,
    sessions_with_facets: facets.size,
    date_range: { start: '', end: '' },
    total_messages: 0,
    total_duration_hours: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    tool_counts: {},
    languages: {},
    git_commits: 0,
    git_pushes: 0,
    projects: {},
    goal_categories: {},
    outcomes: {},
    satisfaction: {},
    helpfulness: {},
    session_types: {},
    friction: {},
    success: {},
    session_summaries: [],
    total_interruptions: 0,
    total_tool_errors: 0,
    tool_error_categories: {},
    user_response_times: [],
    median_response_time: 0,
    avg_response_time: 0,
    sessions_using_task_agent: 0,
    sessions_using_mcp: 0,
    sessions_using_web_search: 0,
    sessions_using_web_fetch: 0,
    total_lines_added: 0,
    total_lines_removed: 0,
    total_files_modified: 0,
    days_active: 0,
    messages_per_day: 0,
    message_hours: [],
    multi_clauding: {
      overlap_events: 0,
      sessions_involved: 0,
      user_messages_during: 0,
    },
  }

  const dates: string[] = []
  const allResponseTimes: number[] = []
  const allMessageHours: number[] = []
  const allFilesModified = new Set<string>()

  for (const session of sessions) {
    dates.push(session.start_time)
    result.total_messages += session.user_message_count
    result.total_duration_hours += session.duration_minutes / 60
    result.total_input_tokens += session.input_tokens
    result.total_output_tokens += session.output_tokens
    result.git_commits += session.git_commits
    result.git_pushes += session.git_pushes

    // Aggregate new stats
    result.total_interruptions += session.user_interruptions
    result.total_tool_errors += session.tool_errors
    for (const [cat, count] of Object.entries(session.tool_error_categories)) {
      result.tool_error_categories[cat] = (result.tool_error_categories[cat] || 0) + count
    }
    allResponseTimes.push(...session.user_response_times)
    if (session.uses_task_agent) result.sessions_using_task_agent++
    if (session.uses_mcp) result.sessions_using_mcp++
    if (session.uses_web_search) result.sessions_using_web_search++
    if (session.uses_web_fetch) result.sessions_using_web_fetch++

    // Lines and files
    result.total_lines_added += session.lines_added
    result.total_lines_removed += session.lines_removed
    for (const file of session.files_modified) {
      allFilesModified.add(file)
    }

    // Tool counts
    for (const [tool, count] of Object.entries(session.tool_counts)) {
      result.tool_counts[tool] = (result.tool_counts[tool] || 0) + count
    }

    // Languages
    for (const [lang, count] of Object.entries(session.languages)) {
      result.languages[lang] = (result.languages[lang] || 0) + count
    }

    // Message hours
    allMessageHours.push(...session.message_hours)

    // Projects
    const project = session.project_path.split('/').pop() || 'unknown'
    result.projects[project] = (result.projects[project] || 0) + 1
  }

  // Aggregate facets data
  for (const facet of facets.values()) {
    // Goal categories
    for (const [cat, count] of Object.entries(facet.goal_categories)) {
      result.goal_categories[cat] = (result.goal_categories[cat] || 0) + count
    }

    // Outcomes
    if (facet.outcome) {
      result.outcomes[facet.outcome] = (result.outcomes[facet.outcome] || 0) + 1
    }

    // Satisfaction
    for (const [level, count] of Object.entries(facet.user_satisfaction_counts)) {
      result.satisfaction[level] = (result.satisfaction[level] || 0) + count
    }

    // Helpfulness
    if (facet.claude_helpfulness) {
      result.helpfulness[facet.claude_helpfulness] = (result.helpfulness[facet.claude_helpfulness] || 0) + 1
    }

    // Session types
    if (facet.session_type) {
      result.session_types[facet.session_type] = (result.session_types[facet.session_type] || 0) + 1
    }

    // Friction
    for (const [type, count] of Object.entries(facet.friction_counts)) {
      result.friction[type] = (result.friction[type] || 0) + count
    }

    // Success
    if (facet.primary_success) {
      result.success[facet.primary_success] = (result.success[facet.primary_success] || 0) + 1
    }

    // Session summaries
    result.session_summaries.push({
      id: facet.session_id,
      date: '',
      summary: facet.brief_summary,
      goal: facet.underlying_goal,
    })
  }

  // Date range
  if (dates.length > 0) {
    const sorted = dates.sort()
    result.date_range.start = sorted[0]
    result.date_range.end = sorted[sorted.length - 1]
  }

  // Response time stats
  if (allResponseTimes.length > 0) {
    const sorted = [...allResponseTimes].sort((a, b) => a - b)
    result.median_response_time = sorted[Math.floor(sorted.length / 2)] || 0
    result.avg_response_time = allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
    result.user_response_times = allResponseTimes
  }

  // Days active
  const uniqueDays = new Set(dates.map(d => d.split('T')[0]))
  result.days_active = uniqueDays.size
  result.messages_per_day = result.days_active > 0 
    ? Math.round((result.total_messages / result.days_active) * 10) / 10 
    : 0

  // Message hours
  result.message_hours = allMessageHours

  // Files modified
  result.total_files_modified = allFilesModified.size

  return result
}
