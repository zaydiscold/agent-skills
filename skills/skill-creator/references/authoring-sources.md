# Authoring sources and adaptation

Research checked 2026-10-30. Consult only the source relevant to the question; recheck changing runtime behavior before relying on it.

- [Anthropic skill creator](https://github.com/anthropics/skills/blob/main/skills/skill-creator/SKILL.md): intent capture, examples, user feedback and iterative evaluation. Adapt its interview to the context; do not import mandatory confirmation or Claude-specific tooling into every Codex task.
- [Anthropic evaluation update](https://claude.com/resources/articles/improving-skill-creator-test-measure-and-refine-agent-skills): distinguish encoded preferences from capability improvements; compare versions and assess selection separately from output quality. Do not assume its evaluation scripts are installed here.
- [Agent Skills authoring guidance](https://agentskills.io/skill-creation/best-practices): grounded expertise, coherent scope, progressive disclosure and control proportional to fragility. A useful reason and default can outperform exhaustive rules.
- [Agent Skills specification](https://agentskills.io/specification): format reference; confirm client-specific metadata independently.
- [skills.sh documentation](https://skills.sh/docs): discovery, distribution and installation. Install counts describe adoption, not demonstrated task quality; inspect original source and compatibility before reusing a listed skill.

Social discussions can reveal cases worth investigating, but verify technical claims against the original repository, research or reproduced execution. Do not turn benchmark anecdotes, universal keyword advice or popularity into authoring requirements. Keep task-specific research evidence outside this reusable skill rather than accumulating feeds or copied manuals here.
