# Troubleshooting

## unauthorized / 401
- Cause: missing or expired cookies
- Fix: `bird check`, then `bird whoami`; ask user to re-auth in browser.

## rate limit
- Cause: too many requests in window
- Fix: short retry delay, then retry once, then pause before repeating.

## not found
- Cause: deleted tweet/account or malformed identifier
- Fix: confirm input ID/URL and note if content is unavailable.

## private/protected account
- Cause: target account or replies require permission
- Fix: explain limitation; suggest checking visibility/follow approval.

## suspended/deleted user
- Cause: account removed/suspended
- Fix: inform user and ask for alternate target.

## malformed URL / ID
- Cause: invalid input format
- Fix: show supported examples and reject with no command execution.

## Safari vs Chrome auth source mismatch
- Cause: cookie source changed between browsers
- Fix: retry with explicit browser profile, e.g. `bird --chrome-profile "Default" <command>`.

## network / DNS failure
- Cause: local network outage or DNS resolution failure
- Fix: report failure, confirm connectivity, retry later.

## timeout / hanging command
- Cause: transient network issue
- Fix: stop and ask user for re-run.
