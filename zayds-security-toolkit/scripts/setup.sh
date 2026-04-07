#!/bin/bash
# Setup security research environment

BASE="$HOME/Desktop/Security research"
mkdir -p "$BASE/library/attack-vectors" "$BASE/opsec"

# Init library files if empty
[ ! -f "$BASE/library/what-worked.md" ] && echo "# What Worked" > "$BASE/library/what-worked.md"
[ ! -f "$BASE/library/what-didnt.md" ] && echo "# What Didn't" > "$BASE/library/what-didnt.md"
[ ! -f "$BASE/library/whats-new.md" ] && echo "# What's New" > "$BASE/library/whats-new.md"

echo "Security research environment ready: $BASE"
echo "Use /zayds-security-toolkit skill for methodology"
