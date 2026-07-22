export const meta = {
  name: 'critique',
  description: 'Multi-perspective critique — N independent critics, then a synthesis verdict',
  phases: [
    { title: 'Critique', detail: 'each lens writes a structured report, blind to the others' },
    { title: 'Synthesize', detail: 'compare/contrast — consensus is fact, disagreement is a fork' }
  ]
}

// ── FILL THESE THREE before running ───────────────────────────────────────────
// 1) ARTIFACT — the real thing, as concretely as possible. Paste the code, the
//    rendered transcript, the prose. A summary produces horoscopes; the actual
//    artifact produces real findings. For a UI, paste a screenshot description
//    + the DOM/transcript. Bigger and more literal is better.
const ARTIFACT = `
<<< paste the actual code / transcript / prose / design here >>>
`;

// 2) INTENT — what it's FOR, who for, the house rules, the stage it's at. A critic
//    that doesn't know the goal critiques the wrong thing.
const INTENT = `
<<< what this is, the intended effect, the constraints/house-style, the audience, the stage >>>
`;

// 3) LENSES — 4–6 genuinely DIFFERENT points of view (see SKILL.md libraries).
//    Each `brief` is second-person and committed — an attitude finds more than neutrality.
const LENSES = [
  { key: 'editor',      brief: 'YOU ARE a ruthless editor who suspects this is 30% too long and too dense. Your job is the CUT LIST: what is redundant, self-indulgent, or filler? Quote the exact lines to kill.' },
  { key: 'first-user',  brief: 'YOU ARE the audience experiencing this for the first time, a human not a builder. Describe what you FEEL moment to moment — where attention goes, where it drags, where the magic or the cringe is. You do not care about the internals.' },
  { key: 'craft',       brief: 'YOU ARE a craft specialist (typographer for design / architect for code / stylist for prose). Judge the execution: hierarchy, restraint, structure, rhythm. What reads as crafted vs amateur? Change/remove, not add.' },
  { key: 'skeptic',     brief: 'YOU ARE the skeptic / purist who guards the intended ethos. Where has this drifted, gotten try-hard, over-explained, or betrayed its own goal? What would make it more RESTRAINED and more itself — by removing, not adding?' }
  // add a 5th/6th lens tailored to this artifact (security, a11y, motion, contrarian, ...).
];

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['lens', 'read', 'keep', 'remove', 'change', 'add', 'biggestFlaw', 'biggestOpportunity', 'verdict'],
  properties: {
    lens: { type: 'string' },
    read: { type: 'string', description: 'what the artifact actually IS, cold, from this lens — specific, honest, not a summary' },
    keep: { type: 'array', items: { type: 'string' } },
    remove: { type: 'array', items: { type: 'string' }, description: 'ranked cuts, quote the actual element + one-line why' },
    change: { type: 'array', items: { type: 'string' }, description: 'alterations, not additions' },
    add: { type: 'array', items: { type: 'string' }, description: 'only real gaps; usually short/empty' },
    biggestFlaw: { type: 'string' },
    biggestOpportunity: { type: 'string', description: 'often a subtraction' },
    verdict: { type: 'string' }
  }
};

function brief(l) {
  return 'Critique this AS A WORK — like a critic, not a product manager. Bias HARD toward subtraction and change; do not propose new features. Be specific, quote the artifact, have taste, be honest even when it stings.\n\n'
    + '=== YOUR LENS ===\n' + l.brief
    + '\n\n=== INTENT / CONSTRAINTS ===\n' + INTENT
    + '\n\n=== THE ARTIFACT ===\n' + ARTIFACT;
}

phase('Critique');
log(`Spawning ${LENSES.length} independent critics...`);
const reports = (await parallel(LENSES.map(l => () =>
  agent(brief(l), { label: 'critic:' + l.key, phase: 'Critique', schema: SCHEMA, effort: 'high' })
))).filter(Boolean);

phase('Synthesize');
const verdict = await agent(
  'You are the lead. ' + reports.length + ' critics each analyzed this artifact independently. Synthesize ONE verdict. Do not average — find the STRUCTURE:\n'
  + '- CONSENSUS = fact: what 3+ critics independently flagged. Lead with it; note the count as evidence.\n'
  + '- DISAGREEMENT = the owner\'s decision: name each fork, give each side\'s best one-line argument, recommend, hand it over.\n'
  + '- KEEP: the few genuinely good things to protect.\n'
  + '- THE SINGLE MOVE: the one change (often a deletion) that does the most.\n\n'
  + 'Output exactly these sections: ## the read · ## what\'s bad · ## remove · ## change · ## reorder/organization · ## add · ## keep · ## the forks · ## the single move. '
  + 'For code, fold correctness/security/performance into what\'s bad/change with severity. Tight, concrete, no hedging.\n\n'
  + '=== INTENT ===\n' + INTENT + '\n\n=== THE ' + reports.length + ' CRITIQUES ===\n' + JSON.stringify(reports, null, 1),
  { label: 'synthesis', phase: 'Synthesize', effort: 'high' }
);

return { verdict, reports };
