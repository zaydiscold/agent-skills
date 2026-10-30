# Behavioral evaluation and iteration

Use for substantial updates, recurring failures, discovery tuning or explicit benchmarking. Scale the work to the stakes; no fixed sample count or expensive benchmark is required for a wording correction.

## Separate the questions

1. Activation: does the skill get selected for intended prompts and stay out of near misses?
2. Execution: does using it improve the actual result, preserve scope and respect constraints?
3. Preference: does the result match what the user values? Subjective outputs need examples and human judgment, not invented numeric certainty.

For execution, define a small representative set of realistic requests and raw inputs. Include the reported failure, successful behavior worth retaining, and a variation outside the motivating example. For activation, include both intended and adjacent out-of-scope requests; do not supply the skill body or name as a hidden hint.

## Comparisons that support a claim

Use the same inputs and comparable model/tool conditions for candidate versus prior skill, or candidate versus no skill. Where authorized and available, use fresh isolated runs to avoid solution leakage. Keep expected answers and author conclusions out of the executing agent's prompt. Assess actual artifacts and traces; an agreeable summary is not evidence that the task was completed.

Check observable results: valid transformed files, correct source selection, preserved user constraints, appropriate clarification, or successful routing to only the needed procedure. Do not reward wording, headings or merely mentioning the rule. Track cost/time only when useful to the decision; disclose small samples, variability and unavailable metrics. Separate unavailable tools and harness failures from skill failures.

When a change is motivated by one failure, use that case to develop the fix and a separate variation to check generalization. Inspect unexpected successes as well as failures. Prefer the smallest revision supported by evidence, then rerun affected cases and a relevant regression case. If a rule no longer helps, simplify it. Do not continue adding instructions to improve one score while degrading normal work.

## Honest evidence levels

- Structural validation: frontmatter, links, names, script behavior.
- Author review: deliberate walkthrough of representative cases.
- Independent execution: another run actually performed tasks under controlled conditions.
- Operational validation: real use and user feedback, including physical/external outcomes where relevant.

Record which level was achieved. Store prompts, candidate identity, outputs and observations in the existing project/task evidence location. Never label planned cases as passing tests, or a hypothetical baseline comparison as measured uplift. Never execute live external side effects merely to test a skill; use permitted fixtures or obtain the needed authorization.
