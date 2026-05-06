# Chromium Upgrade in the Electron Repo

**Scope:** This reference applies *only* when working **inside the `electron/electron` repository itself** to advance the bundled Chromium version. Most users — app developers — should just bump their `electron` npm dep and re-test.

Adapted from the upstream `electron-chromium-upgrade` skill.

## Contents

- [Mental model](#mental-model)
- [Pre-flight](#pre-flight)
- [Phase One — Patch resolution](#phase-one--patch-resolution)
- [Phase Two — Build fixing](#phase-two--build-fixing)
- [Command reference](#command-reference)
- [Directory layout](#directory-layout)
- [When to escalate to a human](#when-to-escalate-to-a-human)
- [Validation](#validation)

---

## Mental model

Electron is a thin shell on top of Chromium. Each Chromium roll requires:

1. **Phase One — Patch conflict resolution.** Electron carries hundreds of patches in `patches/`. When Chromium changes a file Electron has patched, the patch fails to apply. Resolve each conflict.
2. **Phase Two — Build fixing.** Once patches apply, Chromium API changes may have broken Electron's compile. Fix Electron's code (don't touch Chromium).

## Pre-flight

```bash
# Clear rerere cache (otherwise stale conflict resolutions get auto-applied)
git rerere clear
cd ../   # parent (chromium) repo
git rerere clear
cd src/electron

# Verify pre-commit hook
ls .git/hooks/pre-commit || yarn husky
```

## Phase One — Patch resolution

**Goal:** `e sync --3` returns exit code 0.

```bash
e sync --3        # 3-way merge — DO NOT drop --3
```

When it fails on a patch:

1. Read the error: which target repo (chromium/v8/etc) and which `.patch` file.
2. `cd` into the target repo's working tree.
3. Resolve conflicts manually in the conflicting files.
4. `git add` resolved files.
5. `git am --continue`
6. `cd` back to electron, run `e patches <target>` to re-export the now-conflict-resolved patch.
7. Re-run `e sync --3`.

After all patches apply:

```bash
e patches all     # final consistency check
```

### Hard rules — DO NOT VIOLATE

- **Never `git am --skip`** then manually recreate the patch via a new commit. This destroys the patch's original authorship and commit position. The TODO comments in patches reference original authors and tickets — preserve them.
- **Never delete a patch** unless 100% certain it's no longer needed (e.g., upstreamed to Chromium). When unsure, escalate to the user.
- **Never delete code or comment it out** to bypass a conflict.
- **Never modify assignee names** in patch metadata.
- If `git am --continue` says "No changes," investigate — likely the 3-way merge already absorbed the change. Don't blindly skip.

### Commit guidelines (Phase One)

Commit pattern: `chore: update patches for chromium <version>`. See `references/phase-one-commit-guidelines.md` in the upstream repo for full conventions.

## Phase Two — Build fixing

**Goal:** `e build -k 999 -- --quiet` returns exit code 0 AND `e start --version` runs.

```bash
e build -k 999 -- --quiet      # -k 999: keep going past errors so you see them all
```

### Two fix types

**Type A — Patch fixes (modifying patched Chromium files):**

1. Edit the file in the **Chromium source tree** (`../`).
2. Create a fixup commit:
   ```bash
   git commit --fixup=<original-patch-commit-hash>
   ```
3. Autosquash:
   ```bash
   GIT_SEQUENCE_EDITOR=: git rebase --autosquash -i <original-commit>^
   ```
4. Re-export patches:
   ```bash
   cd ../src/electron
   e patches chromium
   ```
5. Commit per Phase Two guidelines.

**Type B — Electron code fixes (`shell/`, `electron/`, etc.):**

1. Edit directly in the electron repo.
2. Commit normally — no patch export needed.

### Hard rule

> "**Strongly avoid making changes to the code in chromium to fix Electron's build.**"

When a Chromium API changes, adapt Electron to the new API. Touching Chromium creates patches you'll have to maintain forever.

### Post-commit pattern

After every Phase Two commit, run:

```bash
git status
```

If you see patch files modified with **only hunk header changes** (line-number drift from your fix), commit them immediately:

```bash
git commit -am "chore: update patches (trivial only)"
```

Don't let these accumulate.

## Command reference

| Command | Purpose |
|---------|---------|
| `e sync --3` | Clone deps + apply patches with 3-way merge |
| `git am --continue` | Resume after manual conflict resolution |
| `e patches <target>` | Export commits in <target> back to `.patch` files |
| `e patches all` | Re-export all targets |
| `e build -k 999 -- --quiet` | Build, keeping going past errors |
| `e build -t <target>.o` | Build a single object file (faster iteration) |
| `e start --version` | Smoke-test the Electron binary |

## Directory layout

- Current dir (`src/electron`) — Electron repo. Run `e` commands here.
- Parent (`src/`) — Chromium working tree. Read-only for Phase Two unless doing Type A fix.
- `patches/<target>/*.patch` — Patch files, organized by target repo.
- `docs/development/patches.md` — Upstream documentation.

## When to escalate to a human

- Conflicts that touch a feature you don't understand.
- Chromium APIs that have been fundamentally redesigned, not just renamed.
- Patches that appear obsolete but you're not 100% sure.
- More than 5 conflicts in a single sync — sometimes the upstream Chromium roll is unusually large; coordinate with the team.

## Validation

```bash
# After both phases pass:
e build -k 999 -- --quiet     # exit 0
e start --version              # prints version
e d gn:list-cipd-dependencies  # checks deps integrity
```

Open a PR. CI runs the full test suite — Phase Two is "done" only when CI is green.
