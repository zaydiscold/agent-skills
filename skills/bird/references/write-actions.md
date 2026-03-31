# Write-action confirmation protocol

For all write commands, never execute without explicit approval.

## Commands considered write actions

- `bird tweet "text"`
- `bird reply <url-or-id> "reply"`
- `bird follow @handle`
- `bird unfollow @handle`
- `bird unbookmark <url-or-id>`

## Required protocol

1. Restate the exact command intent.
2. Ask once for confirmation, e.g.:
   - `Run this command? bird tweet "text"`
3. Execute only after `yes`/`y`.
4. On confirmation, run once and verify output.
5. Confirm success by reporting returned tweet URL/ID when present.
6. On non-confirmation, stop and ask for revised intent.
