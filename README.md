# agent-skills

Personal collection of AI agent skills and adaptations for various platforms.

Skills in this repo work with the [~/.agents/skills/](https://github.com/kingbootoshi/codex-orchestrator) convention — drop a folder with a `SKILL.md` into `~/.agents/skills/` (or the platform-specific path) and any supporting agent picks it up.

## Skills

### [`codex-orchestrator-antigravity`](./skills/codex-orchestrator-antigravity/)

**Adapts [kingbootoshi/codex-orchestrator](https://github.com/kingbootoshi/codex-orchestrator) for Google Gemini Antigravity.**

The original is a Claude Code plugin. This skill makes it work in Antigravity's skill system.

**Key difference:** Antigravity's `run_command` tool spawns fresh shell sessions that don't inherit PATH — every `codex-agent` call is prefixed with `export PATH="$HOME/.codex-orchestrator/bin:$PATH" &&` to fix this.

Full docs in the skill folder.

## Install a Skill

```bash
# Clone this repo
git clone https://github.com/zaydiscold/agent-skills.git ~/Desktop/agent-skills

# Symlink or copy a skill to your agents skills dir
cp -r ~/Desktop/agent-skills/skills/codex-orchestrator-antigravity ~/.agents/skills/
cp -r ~/Desktop/agent-skills/skills/codex-orchestrator-antigravity ~/.gemini/antigravity/skills/
```

## Platform Support

| Skill | Claude Code | Antigravity/Gemini | Cursor | Notes |
|-------|:-----------:|:-----------------:|:------:|-------|
| codex-orchestrator-antigravity | ❌ | ✅ | ❌ | Use original plugin for Claude Code |

## Contributing

PRs welcome. If you've adapted a tool or skill for a specific agent platform, this is a good place to share it.
