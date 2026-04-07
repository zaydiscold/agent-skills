/**
 * HTML Report Generator
 * Creates interactive HTML report from insights
 * Based on Claude Code's generateHtmlReport (insights.ts lines 1947-2200+)
 */

import type { AggregatedData, InsightResults, SessionInfo } from '../types.js';

export function generateHtmlReport(
  data: AggregatedData,
  insights: InsightResults,
  metadata: {
    generatedAt: Date;
    sessionCount: number;
    agentCount: number;
  }
): string {
  const css = generateCSS();
  const js = generateJS();
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Universal Agent Insights</title>
  <style>${css}</style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Universal Agent Insights</h1>
      <p class="subtitle">Your AI-assisted workflow across Claude, Cursor, Gemini, and Codex</p>
      <p class="meta">Generated ${metadata.generatedAt.toLocaleDateString()} • ${metadata.sessionCount} sessions • ${metadata.agentCount} agents</p>
    </header>

    ${renderAtAGlance(insights.at_a_glance)}
    ${renderAgentBreakdown(data)}
    ${renderProjectAreas(insights.project_areas?.areas)}
    ${renderInteractionStyle(insights.interaction_style)}
    ${renderWhatWorks(insights.what_works)}
    ${renderFriction(insights.friction_analysis)}
    ${renderSuggestions(insights.suggestions)}
    ${renderOnTheHorizon(insights.on_the_horizon)}
    
    <footer>
      <p>Universal Insights • Cross-agent workflow analysis</p>
    </footer>
  </div>
  
  <script>${js}</script>
</body>
</html>`;

  return html;
}

function generateCSS(): string {
  return `
    :root {
      --bg: #0a0a0f;
      --fg: #e6e6e6;
      --accent: #6366f1;
      --accent2: #8b5cf6;
      --border: #1f1f2e;
      --card: #12121a;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--fg);
      line-height: 1.6;
      padding: 2rem 1rem;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    
    header {
      text-align: center;
      padding: 2rem 0;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
    }
    
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .subtitle { color: #888; font-size: 1.1rem; }
    .meta { color: #666; font-size: 0.9rem; margin-top: 1rem; }
    
    h2 {
      font-size: 1.5rem;
      margin: 2rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--accent);
    }
    
    h3 { font-size: 1.2rem; margin: 1.5rem 0 0.5rem; color: var(--accent2); }
    
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin: 1rem 0;
    }
    
    .glance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1.5rem 0;
    }
    
    .glance-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
    }
    
    .glance-card h4 {
      color: var(--accent);
      font-size: 0.85rem;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    
    .glance-card p { font-size: 0.95rem; }
    
    .agent-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
    }
    
    .agent-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
    }
    
    .agent-card .count {
      font-size: 2rem;
      font-weight: bold;
      color: var(--accent);
    }
    
    .agent-card .name { font-size: 0.9rem; color: #888; }
    
    .project-area {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);
    }
    
    .project-area:last-child { border-bottom: none; }
    
    .area-name { font-weight: 500; }
    .area-count { 
      background: var(--accent); 
      color: white; 
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.85rem;
    }
    
    .bar-chart {
      margin: 1rem 0;
    }
    
    .bar-row {
      display: flex;
      align-items: center;
      margin: 0.5rem 0;
      gap: 1rem;
    }
    
    .bar-label {
      width: 120px;
      font-size: 0.85rem;
      color: #888;
    }
    
    .bar-track {
      flex: 1;
      height: 8px;
      background: var(--border);
      border-radius: 4px;
      overflow: hidden;
    }
    
    .bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    
    .bar-value {
      width: 40px;
      text-align: right;
      font-size: 0.85rem;
      font-weight: 500;
    }
    
    .suggestion-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      margin: 0.75rem 0;
    }
    
    .suggestion-card h4 { color: var(--accent2); margin-bottom: 0.5rem; }
    
    .copy-btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      margin-top: 0.5rem;
    }
    
    .copy-btn:hover { background: #5555d6; }
    
    .horizon-card {
      background: linear-gradient(135deg, var(--card) 0%, #1a1a2e 100%);
      border: 1px solid var(--accent2);
      border-radius: 8px;
      padding: 1rem;
      margin: 0.75rem 0;
    }
    
    footer {
      text-align: center;
      padding: 2rem;
      margin-top: 2rem;
      border-top: 1px solid var(--border);
      color: #666;
    }
  `;
}

function generateJS(): string {
  return `
    // Copy to clipboard functionality
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const text = this.getAttribute('data-text');
        if (text) {
          navigator.clipboard.writeText(text);
          this.textContent = 'Copied!';
          setTimeout(() => this.textContent = 'Copy', 2000);
        }
      });
    });
  `;
}

function renderAtAGlance(atAGlance: InsightResults['at_a_glance']): string {
  if (!atAGlance) return '';
  
  return `
    <section class="card">
      <h2>👁️ At a Glance</h2>
      <div class="glance-grid">
        <div class="glance-card">
          <h4>What's Working</h4>
          <p>${escapeHtml(atAGlance.whats_working || '')}</p>
        </div>
        <div class="glance-card">
          <h4>What's Hindering</h4>
          <p>${escapeHtml(atAGlance.whats_hindering || '')}</p>
        </div>
        <div class="glance-card">
          <h4>Quick Wins</h4>
          <p>${escapeHtml(atAGlance.quick_wins || '')}</p>
        </div>
        <div class="glance-card">
          <h4>On the Horizon</h4>
          <p>${escapeHtml(atAGlance.ambitious_workflows || '')}</p>
        </div>
      </div>
    </section>
  `;
}

function renderAgentBreakdown(data: AggregatedData): string {
  const entries = Object.entries(data.agentBreakdown)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);
  
  const maxCount = Math.max(...entries.map(e => e[1]));
  
  return `
    <section>
      <h2>📊 Agent Usage</h2>
      <div class="card">
        <div class="agent-grid">
          ${entries.map(([agent, count]) => `
            <div class="agent-card">
              <div class="count">${count}</div>
              <div class="name">${agent.charAt(0).toUpperCase() + agent.slice(1)}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="bar-chart" style="margin-top: 1.5rem;">
          ${entries.map(([agent, count]) => `
            <div class="bar-row">
              <div class="bar-label">${agent}</div>
              <div class="bar-track">
                <div class="bar-fill" style="width: ${(count / maxCount) * 100}%; background: var(--accent)"></div>
              </div>
              <div class="bar-value">${count}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderProjectAreas(areas: InsightResults['project_areas']['areas'] | undefined): string {
  if (!areas || areas.length === 0) return '';
  
  return `
    <section>
      <h2>💼 Project Areas</h2>
      <div class="card">
        ${areas.map(area => `
          <div class="project-area">
            <span class="area-name">${escapeHtml(area.name)}</span>
            <span class="area-count">${area.session_count} sessions</span>
          </div>
          <p style="color: #888; font-size: 0.9rem; margin: 0.25rem 0 0.75rem 1rem;">
            ${escapeHtml(area.description)}
          </p>
        `).join('')}
      </div>
    </section>
  `;
}

function renderInteractionStyle(style: InsightResults['interaction_style']): string {
  if (!style) return '';
  
  return `
    <section>
      <h2>🎯 How You Work</h2>
      <div class="card">
        <p>${escapeHtml(style.narrative).replace(/\n/g, '<br>')}</p>
        ${style.key_pattern ? `
          <p style="margin-top: 1rem; padding: 0.75rem; background: var(--bg); border-radius: 6px;">
            <strong>Key Pattern:</strong> ${escapeHtml(style.key_pattern)}
          </p>
        ` : ''}
      </div>
    </section>
  `;
}

function renderWhatWorks(whatWorks: InsightResults['what_works']): string {
  if (!whatWorks?.impressive_workflows?.length) return '';
  
  return `
    <section>
      <h2>✨ What's Working</h2>
      ${whatWorks.intro ? `<p style="margin-bottom: 1rem;">${escapeHtml(whatWorks.intro)}</p>` : ''}
      ${whatWorks.impressive_workflows.map(wf => `
        <div class="suggestion-card">
          <h4>${escapeHtml(wf.title)}</h4>
          <p>${escapeHtml(wf.description)}</p>
        </div>
      `).join('')}
    </section>
  `;
}

function renderFriction(friction: InsightResults['friction_analysis']): string {
  if (!friction?.categories?.length) return '';
  
  return `
    <section>
      <h2>⚠️ Where Things Go Wrong</h2>
      ${friction.intro ? `<p style="margin-bottom: 1rem;">${escapeHtml(friction.intro)}</p>` : ''}
      ${friction.categories.map(cat => `
        <div class="suggestion-card" style="border-left: 3px solid var(--error);">
          <h4>${escapeHtml(cat.category)}</h4>
          <p>${escapeHtml(cat.description)}</p>
          ${cat.examples?.length ? `
            <ul style="margin-top: 0.5rem; margin-left: 1.5rem; color: #888;">
              ${cat.examples.map(ex => `<li>${escapeHtml(ex)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      `).join('')}
    </section>
  `;
}

function renderSuggestions(suggestions: InsightResults['suggestions']): string {
  if (!suggestions) return '';
  
  let html = '<section><h2>💡 Suggestions</h2>';
  
  if (suggestions.features_to_try?.length) {
    html += '<h3>Features to Try</h3>';
    html += suggestions.features_to_try.map(f => `
      <div class="suggestion-card">
        <h4>${escapeHtml(f.feature)}</h4>
        <p>${escapeHtml(f.one_liner)}</p>
        <p style="color: #888; font-size: 0.9rem; margin-top: 0.5rem;">
          <strong>Why for you:</strong> ${escapeHtml(f.why_for_you)}
        </p>
        ${f.example_code ? `
          <code style="display: block; margin-top: 0.5rem; padding: 0.5rem; background: var(--bg); border-radius: 4px; font-size: 0.85rem;">
            ${escapeHtml(f.example_code)}
          </code>
          <button class="copy-btn" data-text="${escapeHtml(f.example_code).replace(/"/g, '&quot;')}">Copy</button>
        ` : ''}
      </div>
    `).join('');
  }
  
  if (suggestions.usage_patterns?.length) {
    html += '<h3>Usage Patterns</h3>';
    html += suggestions.usage_patterns.map(p => `
      <div class="suggestion-card">
        <h4>${escapeHtml(p.title)}</h4>
        <p>${escapeHtml(p.suggestion)}</p>
        ${p.copyable_prompt ? `
          <code style="display: block; margin-top: 0.5rem; padding: 0.5rem; background: var(--bg); border-radius: 4px; font-size: 0.85rem;">
            ${escapeHtml(p.copyable_prompt)}
          </code>
          <button class="copy-btn" data-text="${escapeHtml(p.copyable_prompt).replace(/"/g, '&quot;')}">Copy</button>
        ` : ''}
      </div>
    `).join('');
  }
  
  html += '</section>';
  return html;
}

function renderOnTheHorizon(horizon: InsightResults['on_the_horizon']): string {
  if (!horizon?.opportunities?.length) return '';
  
  return `
    <section>
      <h2>🔮 On the Horizon</h2>
      ${horizon.intro ? `<p style="margin-bottom: 1rem;">${escapeHtml(horizon.intro)}</p>` : ''}
      ${horizon.opportunities.map(opp => `
        <div class="horizon-card">
          <h4>${escapeHtml(opp.title)}</h4>
          <p>${escapeHtml(opp.whats_possible)}</p>
          ${opp.how_to_try ? `<p style="color: #888; margin-top: 0.5rem;"><strong>Getting started:</strong> ${escapeHtml(opp.how_to_try)}</p>` : ''}
          ${opp.copyable_prompt ? `
            <code style="display: block; margin-top: 0.5rem; padding: 0.5rem; background: var(--bg); border-radius: 4px; font-size: 0.85rem;">
              ${escapeHtml(opp.copyable_prompt)}
            </code>
            <button class="copy-btn" data-text="${escapeHtml(opp.copyable_prompt).replace(/"/g, '&quot;')}">Copy</button>
          ` : ''}
        </div>
      `).join('')}
    </section>
  `;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
