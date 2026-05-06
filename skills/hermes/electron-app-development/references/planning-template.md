# Planning Workflow & Best Practices (English translation + extension of `electron-app-planner`)

This is the long-form version of Mode 1 in SKILL.md. It is the planner-skill's content — translated from Japanese and extended with 2026 architecture defaults.

## Contents

- [Purpose](#purpose)
- [Required input from user](#required-input-from-user)
- [Optional input](#optional-input)
- [Step-by-step workflow](#step-by-step-workflow)
- [Best practices for Electron app plans](#best-practices-for-electron-app-plans)
- [Templates](#templates)
- [Direction A: [Name]](#direction-a-name)
- [When in doubt](#when-in-doubt)

---

## Purpose

You are a product strategist for Electron desktop apps. Your job:

- Generate viable desktop app ideas from scratch.
- Analyze cross-platform requirements.
- Design an MVP (Minimum Viable Product).
- Recommend appropriate architecture and security defaults.
- Plan distribution and update strategy.

The deliverable is a written plan saved to `electron-app-plans/<kebab-app-name>.md`.

## Required input from user

1. **App theme / domain** — what category
2. **Problem to solve** — user pain
3. **Target platforms** — Windows / macOS / Linux (any combination)
4. **Distribution channel** — own website / Mac App Store / Microsoft Store / internal corporate

## Optional input

- Target user persona
- Revenue model
- Native capability requirements (filesystem, system tray, global shortcuts, accessibility, camera/mic, USB, Bluetooth, OS notifications, deep links, custom protocol handlers)
- Reference apps (e.g., "like Linear but offline-first")

## Step-by-step workflow

### Step 1 — Hear out the user

Ask for the required inputs above. If the user only gives a vague theme, ask:
- Who is this for?
- What do they do today instead?
- Why a desktop app and not web/mobile?

### Step 2 — Brainstorm 3–5 directions

Propose 3–5 distinct concept directions. Vary:
- **Audience scope** (consumer / prosumer / enterprise / developer)
- **Depth** (single feature done extremely well vs. all-in-one)
- **Distribution** (free open source / paid one-time / subscription)
- **Native angle** — what *can't* be done in a browser? (filesystem, OS integration, offline, privacy)

Format each as: name, one-line pitch, target user, key differentiator, risks.

### Step 3 — Research similar apps

For each direction the user is interested in, run:

```bash
# Web research
WebSearch: "<concept> desktop app 2026"
WebSearch: "<concept> open source alternative"

# Twitter pulse
bird search "<concept> mac app" -n 10
bird search "<concept> electron" -n 10
```

Capture for each competitor: name, stack, distribution channel, pricing, last release, weaknesses users complain about.

### Step 4 — Pick a direction with the user

Recommend one based on research, but defer to user.

### Step 5 — MVP scoping

List must-have vs. nice-to-have features. **Cap MVP at 5 must-haves.** Anything beyond is v1.1.

For each must-have feature, note:
- Renderer-side work (UI complexity)
- Main-process work (filesystem? network? native API?)
- Persistence requirement (SQLite, key-value, file-based)

### Step 6 — Architecture sketch

Produce a one-page architecture:

| Concern | Decision |
|---------|----------|
| Framework | Electron 41 (latest stable) |
| Build | electron-vite |
| Renderer UI | React 19 + TypeScript 5.9 + Tailwind 4 |
| Renderer state | Zustand (per-window) |
| Main-process state | Plain object + JSON file or SQLite |
| Persistence | better-sqlite3 + drizzle-orm (default), or `electron-store` for simple key-value |
| Packager | Electron Forge (default) or electron-builder (if staged rollouts needed) |
| Auto-update | electron-updater |
| Testing | Vitest + Playwright |
| Crash reporting | Sentry Electron SDK |
| Logging | electron-log |

Any deviation from these defaults must be justified.

### Step 7 — Security & privacy plan

Mandatory checklist (full version in `security-checklist.md`):

- ✅ contextIsolation: true, sandbox: true, nodeIntegration: false
- ✅ Strict CSP
- ✅ All windows hardened via `app.on('web-contents-created')`
- ✅ Typed IPC, sender frame validation
- ✅ External link allow-list
- ✅ Code signing on macOS + Windows from day 1

Privacy: what data leaves the device? Telemetry policy? Crash reports include user paths/content? Document the answers.

### Step 8 — Distribution & update plan

Decision matrix:

| Channel | Pros | Cons | When to choose |
|---------|------|------|----------------|
| Own website (DMG/EXE/AppImage) | Full control, instant updates, no review | You handle signing/notarization | Default for indies, B2B |
| Mac App Store | Discoverability, sandbox | Strict review, no in-app updates, MAS-only IAP | Consumer apps with mass appeal |
| Microsoft Store | Discoverability | MSIX restrictions, no in-app updates | Same as MAS |
| Internal | No public listing, MDM deployment | No signing if internal CA | Corporate apps |

Pick a channel; map prerequisites (cert types, fees, review timelines).

### Step 9 — Roadmap

Week-by-week (or sprint-by-sprint) milestones to MVP, public beta, 1.0:

```
Week 1: Scaffold + secure-default verification + first IPC channel + DB schema
Week 2: Core feature 1 + auto-update wiring + CI/CD skeleton
Week 3: Core features 2–3 + macOS signing dry-run
Week 4: Core features 4–5 + Windows signing dry-run + Linux build
Week 5: Internal alpha + crash-reporting integration + telemetry off-by-default
Week 6: Public beta on GitHub Releases (staged rollout @ 10%)
Weeks 7–8: Bug fix + iterate on staged rollout
Week 9: 1.0 release
```

### Step 10 — Save the plan

Save to `electron-app-plans/<kebab-app-name>.md` using `assets/plan-template.md`. Make sure the directory exists; create it if not.

### Step 11 — Suggest next step

Usually: "Shall I scaffold the project now using these decisions?" → triggers Mode 2 in the main SKILL.md.

## Best practices for Electron app plans

### Security non-negotiables

- contextIsolation: ON, sandbox: ON, nodeIntegration: OFF — always.
- Treat the renderer as a hostile web page.
- Auto-update channel: signed payloads only.

### Performance

- Cold start budget: <2s on 2020-era laptop. Lazy-load anything not needed at first paint.
- Memory: each window costs ~80–150 MB baseline. For multi-window apps, decide between many BrowserWindows vs. one window with internal "tabs."
- Use `utilityProcess` for CPU-heavy work (image processing, search indexing); don't block renderer.

### Cross-platform

- Abstract platform-specific code behind a `platform` interface in main.
- Test on all targeted platforms in CI from day 1.
- File path differences: always use `path.join`, never string concatenation.
- macOS quirks: app stays running with no windows (handle `activate`); single-instance via `requestSingleInstanceLock`.
- Windows quirks: Squirrel `--squirrel-firstrun` arg; UAC prompts for per-machine installs.
- Linux quirks: AppImage doesn't auto-update unless you opt in; `.deb`/`.rpm` need post-install scripts for desktop integration.

### Distribution

- Set up signing certs **before** writing code, not before the first release. Apple cert can take 24h; EV Windows cert ~1 week with HSM shipping.
- Plan auto-update from day 1. Retrofitting is painful.
- Ship a "version check" UI even before auto-update lands — at least let users know they're out of date.

### Native modules

- Pin to versions known compatible with your Electron version.
- Run `npx electron-rebuild` after every dep change.
- Avoid heavy native modules if a pure-JS alternative exists (faster CI, fewer rebuild headaches).

## Templates

The full plan-document template lives in `assets/plan-template.md`.

A short brainstorm-output template:

```markdown
## Direction A: [Name]
- **Pitch**: [one line]
- **Audience**: [persona]
- **Differentiator**: [why this beats X]
- **Native angle**: [what makes it desktop-worthy]
- **Risks**: [top 2]
- **Distribution**: [channel]
- **Revenue**: [model or "free"]
```

## When in doubt

- Ask the user.
- Default to security-strict, performance-conservative, distribution-flexible.
- Save the plan even if you only got partway through — partial plans are easier to resume than no plan.
