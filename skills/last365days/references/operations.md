# Operations, examples, and troubleshooting

Load this file only when the user is not following the normal
`last365 <topic>` research path. This is for browse, export, diff, diagnostics,
or failure handling.

## Browse and inspect profiles

If the user asks to see profiles, inspect one profile, or search across saved
history, use these commands:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py list
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py history "<slug>"
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py read "<slug>"
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py search "query terms"
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py search "query terms" --slug "<slug>"
```

## Diagnostics and exports

Use these commands when the user wants to debug the environment, diff saved
history, or move data out of the Markdown files:

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py doctor
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py diff "<slug>" "<date1>" "<date2>"
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py export "<slug>" --format json
python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py export --all --format csv
```

## Worked examples

### Example: first research on a new person

User says: `last365 Saba Nafees`

Actions:
1. `persist.py match` finds no existing profile.
2. Tell the user you are creating `saba-nafees.md`.
3. Run the bundled research flow.
4. Synthesize findings.
5. Append the new entry with `persist.py append`.

### Example: follow-up research on an existing profile

User says: `last365 Saba Nafees` later again.

Actions:
1. `persist.py match` returns the existing profile.
2. `persist.py history "saba-nafees"` loads previous context.
3. Run fresh research.
4. Add a "What changed" comparison.
5. Append the new dated entry.

### Example: browse saved profiles

User says: `show me my last365 profiles`

Actions:
1. `persist.py list` returns saved profiles with metadata.
2. Show slug, title, entry count, and last-updated date.

## Troubleshooting

### Error: bundled research engine missing

Cause: this skill install is incomplete or corrupted.

Try:
1. Reinstall the skill from this repo.
2. Verify the script exists: `ls ${CLAUDE_SKILL_DIR}/scripts/last30days.py`

### X/Twitter works in `bird`, but fails inside `/last365days`

Cause: the bundled engine can still hit host-specific Bird or browser-cookie
permission issues even when `bird whoami` works in your normal terminal.

Try:
1. Re-run `python3 ${CLAUDE_SKILL_DIR}/scripts/persist.py doctor`.
2. Confirm the bundled engine path is present.
3. Retry `/last365days` after fixing Bird access in the host environment.

### Error: persist.py not found

Cause: `${CLAUDE_SKILL_DIR}` is missing or points to the wrong directory.

Try:
1. Check your runtime sets `${CLAUDE_SKILL_DIR}` to this skill directory.
2. Run the script directly from its absolute path.

### Stats missing from a saved entry

Cause: `report.json` is missing, unreadable, or belongs to a different topic.

Try:
1. Run `doctor` to confirm the path and report shape.
2. Override the output directory with `LAST365DAYS_OUTPUT_DIR` if needed.
3. Keep going if necessary; synthesis still saves without the stats block.

### Profile matching looks wrong

Cause: a medium-confidence match shares name tokens with a different person.

Response:
1. Do not append automatically.
2. Ask the user whether to reuse the existing slug or create a new one.
3. Prefer a new profile when the answer is ambiguous.
