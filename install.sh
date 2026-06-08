#!/usr/bin/env bash
#
# install.sh — symlink every skill in this catalog into your agent skill dirs.
#
# Usage:
#   bash install.sh                # link into every agent dir that already exists
#   bash install.sh --claude       # only Claude Code (~/.claude/skills)
#   bash install.sh --cursor       # only Cursor / base (~/.agents/skills)
#   bash install.sh --antigravity  # only Gemini Antigravity (~/.gemini/antigravity/skills)
#   bash install.sh --all          # create + link into all three, even if missing
#
# Symlinks (not copies) so a `git pull` here instantly updates every agent.
# Re-running is safe: existing symlinks are refreshed, real dirs are never clobbered.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_DIR="$ROOT/skills"

# target label -> path
CLAUDE="$HOME/.claude/skills"
CURSOR="$HOME/.agents/skills"
ANTIGRAVITY="$HOME/.gemini/antigravity/skills"

targets=()
force_create=false

if [ "$#" -eq 0 ]; then
  # default: only dirs that already exist
  [ -d "$CLAUDE" ]      && targets+=("$CLAUDE")
  [ -d "$CURSOR" ]      && targets+=("$CURSOR")
  [ -d "$ANTIGRAVITY" ] && targets+=("$ANTIGRAVITY")
else
  for arg in "$@"; do
    case "$arg" in
      --claude)      targets+=("$CLAUDE") ;;
      --cursor)      targets+=("$CURSOR") ;;
      --antigravity) targets+=("$ANTIGRAVITY") ;;
      --all)         targets+=("$CLAUDE" "$CURSOR" "$ANTIGRAVITY"); force_create=true ;;
      *) echo "Unknown flag: $arg" >&2; exit 1 ;;
    esac
  done
fi

if [ "${#targets[@]}" -eq 0 ]; then
  echo "No agent skill dirs found. Re-run with --all to create them, or --claude/--cursor/--antigravity." >&2
  exit 1
fi

# Collect publishable skills: any skills/*/ that contains a SKILL.md.
shopt -s nullglob
linked=0
for target in "${targets[@]}"; do
  $force_create && mkdir -p "$target"
  [ -d "$target" ] || { echo "skip (missing): $target"; continue; }
  echo "==> $target"
  for skill in "$SKILLS_DIR"/*/; do
    [ -f "$skill/SKILL.md" ] || continue
    name="$(basename "$skill")"
    dest="$target/$name"
    # never clobber a real (non-symlink) directory the user placed there
    if [ -e "$dest" ] && [ ! -L "$dest" ]; then
      echo "    skip (real dir exists): $name"
      continue
    fi
    ln -sfn "$ROOT/skills/$name" "$dest"
    echo "    linked: $name"
    linked=$((linked + 1))
  done
done

echo
echo "Done. $linked symlink(s) written. Pull this repo to update every agent at once."
