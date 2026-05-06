---
name: electron-app-development
description: End-to-end Electron desktop app expertise — plan, architect, secure, build, package, sign, notarize, auto-update, OS-integrate cross-platform (mac/Windows/Linux) apps incl. AI/LLM-powered. Use when user says "build electron app", "electron desktop app", "electron security", "contextBridge", "preload", "electron IPC", "electron packaging", "code sign electron", "notarize electron", "electron auto-update", "electron-vite", "electron-forge", "electron-builder", "electron fuses", "ASAR integrity", "safeStorage", "deep link", "custom protocol", "electron OAuth PKCE", "utilityProcess", "MessageChannelMain", "electron tray", "electron MCP", "AI desktop app", "Chromium upgrade", "Tauri vs Electron", "universal binary macOS", or shares an Electron project, package.json with electron, .dmg/.exe/.AppImage/.MSIX build issues. Do NOT use for pure web apps, browser extensions, or pure Tauri/Wails projects.
triggers:
  - build electron app
  - electron desktop app
  - electron security
  - electron security audit
  - contextBridge
  - preload script
  - electron IPC
  - typed IPC electron
  - electron packaging
  - code sign electron
  - notarize electron
  - electron auto-update
  - electron-vite
  - electron-forge
  - electron-builder
  - electron fuses
  - ASAR integrity
  - safeStorage
  - electron deep link
  - custom protocol handler
  - electron OAuth
  - electron OAuth PKCE
  - utilityProcess
  - MessageChannelMain
  - electron tray
  - electron global shortcut
  - electron MCP
  - AI desktop app
  - LLM desktop app
  - Chromium upgrade
  - Tauri vs Electron
  - universal binary macOS
  - MSIX auto-update
  - electron app planner
  - .dmg build
  - .exe installer electron
  - AppImage build
  - electron crash reporting
  - electron-updater
version: 1.2.0
metadata:
  author: zaydk
  agents: [claude-code, claude-ai, hermes, codex, cursor, generic]
  compatibility: "Targets Electron 30+ through current stable (v41 as of May 2026 — Chromium 146, V8 14.6, Node 24.14). References cover latest CVE patches, Fuses, ASAR integrity, MSIX auto-update, universal binary, AI-desktop-app patterns, and 2026 toolchain (electron-vite, Forge 7.x, electron-builder 25+)."
  hermes:
    tags: [electron, desktop, cross-platform, security, packaging, code-signing, notarization, auto-update, ipc, react, typescript, ai-app, mcp, oauth, deep-links, utilityprocess, fuses, asar]
    related_skills: []
  claude:
    surface: [claude-code, claude-ai, agent-sdk]
---

## Agent Compatibility

This skill is **agent-agnostic**. The frontmatter ships in two formats simultaneously so it loads natively in any agent that reads YAML skills:

- **Claude / Claude Code / Agent SDK** read the `description` + `name` and decide when to load.
- **Hermes** reads the `triggers:` list and the `metadata.hermes` block.
- **Codex / Cursor / generic agents** that follow the [Agent Skills](https://agentskills.io) open standard read `name` + `description` + `triggers`.

The skill content (this SKILL.md + every file under `references/` and `assets/`) is plain Markdown with **no agent-specific tool calls hardcoded**. Where the planner references a "web search tool" or "browser tool", any agent's equivalent works:

| Capability used | Claude Code tool | Hermes tool | Generic equivalent |
|-----------------|------------------|-------------|--------------------|
| Web search | `WebSearch` | `web_search` / Tavily MCP | Any HTTP search tool |
| Web fetch | `WebFetch` | `fetch_url` | curl / fetch |
| Twitter/X lookup | `bird` CLI via Bash | `bird` CLI via shell | `bird` CLI |
| File ops | `Read` / `Write` / `Edit` | `read_file` / `write_file` / `patch` | Any FS tool |
| Shell | `Bash` | `shell` | sh/bash |

When invoking this skill, the agent should: (1) read SKILL.md, (2) follow the mode router below, (3) load only the relevant `references/*.md` files on demand using its native file-read tool.

# Electron App Development

Build production-grade Electron desktop apps end-to-end: planning, secure architecture, type-safe IPC, packaging, code signing, notarization, and auto-updates. Combines the **planner** (problem-first ideation) and **technical specialist** (tool-first execution) into one workflow.

## Quick Reference

| User intent | Mode | First action |
|-------------|------|--------------|
| "I want to build a desktop app for X" | **Plan** | Run Plan Workflow (below), save to `electron-app-plans/<app>.md` |
| "Should I use Electron or Tauri/Wails/native?" | **Compare** | Load `references/framework-comparison.md` first; answer honestly |
| "Set up a new Electron project" | **Scaffold** | Use electron-vite + Forge defaults (see `references/architecture.md`) |
| "My Electron app has a security issue" / audit | **Audit** | Load `references/security-checklist.md`, run 28-item checklist incl. Fuses |
| "IPC is broken" / typing IPC / "contextBridge" | **IPC** | Load `references/ipc-patterns.md` |
| "Package for macOS/Windows", code signing, notarization | **Ship** | Load `references/packaging-distribution.md` |
| "Auto-update", "electron-updater", "MSIX auto-update" | **Update** | Load `references/packaging-distribution.md` (Auto-update + MSIX sections) |
| "App is slow / huge / eats RAM" / boot time / memory | **Tune** | Load `references/performance-tuning.md` (V8 snapshots, utilityProcess, lazy-require) |
| "Deep link" / OAuth / safeStorage / file association / tray / drag-drop | **Integrate** | Load `references/os-integration.md` |
| "Build an AI/LLM desktop app like Cursor/Codex/Claude Desktop" | **AI App** | Load `references/ai-desktop-apps.md` |
| "How does VSCode/Obsidian/Discord do X" / shared process / extension host | **Pattern** | Load `references/production-patterns.md` |
| "Upgrade Chromium" / patches failing in Electron repo | **Upgrade** | Load `references/chromium-upgrade.md` |
| Anything weird, slow, or broken | **Debug** | Load `references/gotchas.md` first |

## Top Gotchas (read first, every time)

These are the corrections to mistakes Claude — and humans — make on Electron without being told:

- **Three security flags are non-negotiable defaults** (Electron 20+): `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. **Disabling any one** lets a single XSS escalate to full RCE on the user's machine. Treat the renderer like an untrusted web page, always.
- **Flip the Electron Fuses** at packaging time. Bare minimum: `EnableEmbeddedAsarIntegrityValidation: true`, `OnlyLoadAppFromAsar: true`, `RunAsNode: false`. These close CVE-2025-55305 and prevent runtime tampering. See `references/security-checklist.md` → Fuses section.
- **Use `ipcRenderer.invoke` + `ipcMain.handle`** for two-way IPC. The older `send`/`on` pattern leaks message IDs and has no return-value contract. Never expose `ipcRenderer` directly via `contextBridge` — wrap each channel as a typed function.
- **Never spread untrusted config into `webPreferences`.** CVE-2026-34769 (renderer command-line switch injection) exploits exactly this: `new BrowserWindow({ webPreferences: { ...userConfig } })` lets an attacker inject `commandLineSwitches` and disable the sandbox. Always allow-list keys.
- **macOS code signing + notarization is the hardest production step**, not building. Plan a full day for first-time setup: Apple Developer ID Application cert, hardened runtime, entitlements plist, `electron/notarize`, app-specific password, Keychain or `APPLE_ID` env vars in CI. See `references/packaging-distribution.md`.
- **`electron-updater` ≠ Electron's built-in `autoUpdater`.** The built-in one is macOS/Windows only and uses Squirrel — Electron 41 added MSIX support to it. `electron-updater` (from electron-builder) supports Linux too, plus staged rollouts, progress events, and GitHub Releases out of the box. Most production apps want `electron-updater`.
- **Squirrel.Windows first-run trap**: on Windows, do *not* check for updates if `process.argv` contains `--squirrel-firstrun`. Squirrel holds file locks during install; an update check during first launch corrupts the install.
- **Only run update checks when `app.isPackaged === true`.** Otherwise dev builds make network calls and clutter logs.
- **CJS / ESM mixing is the #1 DX trap in 2026.** Electron's main process is ESM-capable from v28 but most native modules and packagers still expect CJS. Use `electron-vite` — it transparently handles main (CJS or ESM), preload (CJS), and renderer (ESM) with one config.
- **Localhost is not a security boundary.** If your main process spawns a local HTTP/WebSocket server, browsers and other apps on the machine can reach it. Bind to `127.0.0.1` only, require an auth token rotated per session, and follow Chromium's Private Network Access (PNA) rules.
- **`keytar` is archived/unmaintained.** Use Electron's built-in `safeStorage` for secrets — Keychain (macOS), DPAPI (Windows), Secret Service (Linux). No native module dep. **Call after `app.whenReady()`** — earlier returns garbage on some platforms.
- **OAuth: use PKCE, not a client secret in the app bundle.** Electron apps are RFC 8252 "Public Client Native Applications." Open the auth URL via `shell.openExternal`, receive the code via your custom protocol's deep-link handler, exchange for tokens. See `references/os-integration.md`.
- **Deep links require THREE handlers** for full cross-platform support: `app.on('open-url')` (macOS), `app.on('second-instance')` argv parsing (Win/Linux), and `process.argv` parse at first launch. Forgetting any one breaks one platform silently.
- **`BrowserView` is deprecated** (Electron 30+). Use `WebContentsView` + `BaseWindow`. See `references/production-patterns.md` Pattern 11.
- **`File.path` was removed** from the standard Web File API in Electron 32. For drag-drop file paths, use `webUtils.getPathForFile(file)` exposed via preload.
- **A new BrowserWindow defaults to `nodeIntegrationInSubFrames: false`** — good. But if you ever set it to `true` for a legitimate reason (rare), every iframe becomes a Node.js execution context. Don't.
- **`webContents.setWindowOpenHandler` must return `{ action: 'deny' }` for any URL you didn't explicitly allow.** Default-allow lets phishing pop-ups open inside your app's trust boundary.
- **Native modules (better-sqlite3, etc.) must be rebuilt against Electron's Node ABI** — not your system Node. `electron-rebuild` (or Forge's auto-rebuild) handles this. Skipping it produces cryptic `NODE_MODULE_VERSION mismatch` errors. Electron 41 ships Node 24.14.
- **CPU-heavy work belongs in `utilityProcess`, not main.** Main process IPC blocks while a handler runs — keep handlers <10ms. Long work → fork a `utilityProcess`, communicate via `MessageChannelMain` ports passed all the way to renderer. See `references/performance-tuning.md` and `references/production-patterns.md`.

## Mode 1 — Plan (Problem-First)

Use when the user describes an *outcome* ("I want a desktop app for X") rather than a tool ("set up Electron"). Adapted from the Japanese `electron-app-planner` skill.

### Inputs to gather (required)

1. **Theme / domain** — what category of app
2. **Problem solved** — what user pain point
3. **Target platforms** — Windows / macOS / Linux (any combination)
4. **Distribution** — own site / Mac App Store / Microsoft Store / internal

### Inputs (optional but valuable)

- Target user persona
- Revenue model (one-time, subscription, freemium, free)
- Native capabilities required (file access, system tray, global shortcuts, accessibility, camera/mic, USB, Bluetooth, OS notifications, deep links, protocol handlers)
- Reference apps (e.g., "like Linear but offline-first")

### Plan workflow

1. **Brainstorm** — propose 3–5 distinct concept directions varying in scope/audience.
2. **Research similar apps** — use WebSearch + `bird search` to find 2–3 real competitors per direction; capture their stack, distribution, pricing, weaknesses.
3. **Pick a direction** with the user.
4. **MVP scoping** — enumerate must-have vs. nice-to-have features. Cap MVP at ~5 features.
5. **Architecture sketch** — main process responsibilities, renderer responsibilities, preload bridge surface, persistent storage choice (SQLite via `better-sqlite3` + Drizzle is the 2026 default), state management (Zustand for renderer, main process as source of truth for cross-window state).
6. **Security & privacy plan** — what data leaves the device, telemetry policy, secure defaults checklist (load `references/security-checklist.md`).
7. **Distribution & update plan** — code-signing prerequisites per platform, auto-update channel, store-vs-direct trade-offs (load `references/packaging-distribution.md`).
8. **Roadmap** — Week-by-week milestones for MVP → public beta → 1.0.
9. **Save the plan** to `electron-app-plans/<kebab-app-name>.md` using the template in `assets/plan-template.md`.
10. **Suggest concrete next step** — usually "scaffold the project" (see Mode 2).

## Mode 2 — Scaffold (Tool-First)

Default 2026 stack, validated against real production apps observed on Twitter (Codex desktop, ListerAI, Cursor, etc.):

```
electron@^41          # main framework
electron-vite@^4      # dev server, HMR, build orchestration
electron-forge@^7     # packaging, signing, notarization
react@^19 + react-dom@^19
typescript@^5.9
vite@^8
tailwindcss@^4
zustand                # renderer state
better-sqlite3 + drizzle-orm   # persistence
vitest + @playwright/test      # testing
```

For full architecture, file layout, and `electron.vite.config.ts`, load **`references/architecture.md`**.

### Quick scaffold

```bash
npm create @quick-start/electron@latest my-app -- --template react-ts
cd my-app && npm install
npm run dev
```

Then immediately:

1. Verify `webPreferences` defaults in `src/main/index.ts` match `references/security-checklist.md`.
2. Wire one IPC channel using the typed pattern from `references/ipc-patterns.md`.
3. Add `electron-builder` or Forge config; set `appId` and code-signing identity placeholders.

## Mode 3 — Audit (Security)

When the user says "is this secure?", "audit my Electron app", or shares a `BrowserWindow` config:

1. Load `references/security-checklist.md` (24-item checklist).
2. Walk every item, scoring PASS / FAIL / N/A with file:line citations.
3. Output a violations table:
   ```
   | # | Item | File:Line | Issue | Severity |
   |---|------|-----------|-------|----------|
   ```
4. Severity: CRITICAL (RCE/sandbox escape), HIGH (rule violation, exploitable XSS impact), MEDIUM (defense-in-depth gap).
5. Provide a refactored secure config inline.
6. Cross-check against the **2026 CVE list** in the reference (CVE-2026-34769, CVE-2026-34780, etc.).

## Mode 4 — IPC

When user mentions "IPC", "contextBridge", "preload", "ipcRenderer", "ipcMain", or shows IPC code:

1. Load `references/ipc-patterns.md`.
2. Default to the **typed invoke/handle pattern** with a central `IpcChannels` map.
3. Reject `send`/`on` for new code unless the user explicitly needs fire-and-forget broadcast.
4. Reject any `contextBridge.exposeInMainWorld('ipc', ipcRenderer)`-style direct exposure — wrap each channel as a typed function.

## Mode 5 — Ship (Package + Sign + Notarize)

When user mentions packaging, "build for production", code signing, notarization, `.dmg`, `.exe`, `.AppImage`:

1. Load `references/packaging-distribution.md`.
2. Identify target platforms.
3. Walk the platform-specific signing checklist (macOS Developer ID + entitlements + notarization is the most error-prone).
4. Produce a CI-ready GitHub Actions snippet if the user uses CI.

## Mode 6 — Update (Auto-update)

When user mentions "auto-update", "electron-updater", "Squirrel", "update channel":

1. Load `references/packaging-distribution.md` → "Auto-update" section.
2. Default recommendation: **`electron-updater`** (from electron-builder) over the built-in `autoUpdater` — it handles Linux, staged rollouts, progress events, and GitHub Releases.
3. Always wrap update checks in `if (app.isPackaged && !process.argv.includes('--squirrel-firstrun'))`.

## Mode 7 — Upgrade (Chromium / Electron version)

When user is **inside the Electron repo** itself and needs to advance the bundled Chromium, or hits patch conflicts during `e sync`: load `references/chromium-upgrade.md`. This is the niche-but-critical workflow from the upstream `electron/electron` repo.

For app-developer Electron upgrades (most users): just bump the `electron` dep, run `npx electron-rebuild`, run the test suite, check the security release notes for breaking changes.

## Reference Navigation

**Load only when needed.** Each reference is a focused deep-dive; do NOT load by default.

| Reference | Load When |
|-----------|-----------|
| `references/security-checklist.md` | Audit, or any time `webPreferences` / `BrowserWindow` is involved, or Fuses / ASAR Integrity questions |
| `references/ipc-patterns.md` | IPC, preload script work, contextBridge, typed channels |
| `references/architecture.md` | Scaffold, main/renderer/preload separation, electron-vite config, file layout |
| `references/packaging-distribution.md` | Code signing, notarization, store distribution, auto-update, universal binary, MSIX |
| `references/react-integration.md` | React-specific patterns (useEffect IPC cleanup, multi-window state, Suspense, custom title bars) |
| `references/testing.md` | Vitest + Playwright + IPC handler tests + secure-config snapshot test |
| `references/performance-tuning.md` | Boot time, memory, V8 snapshots, utilityProcess offloading, lazy require, ASAR/profiling |
| `references/os-integration.md` | Deep links, OAuth+PKCE, safeStorage, file associations, drag-drop, tray, notifications, global shortcuts, login items |
| `references/production-patterns.md` | Real-world patterns from VSCode/Obsidian/Linear/Discord — shared process, extension host, streaming, single-instance, BrowserView migration |
| `references/ai-desktop-apps.md` | LLM streaming, MCP server lifecycle, local model integration, RAG indexing, tool-calling, chat history, AI-app shortcuts |
| `references/framework-comparison.md` | "Should I use Electron or Tauri/Wails/native?" — honest decision tree |
| `references/chromium-upgrade.md` | ONLY when working inside the `electron/electron` repo itself |
| `references/planning-template.md` | Mode 1 (Plan) — long-form planning guide, brainstorming prompts |
| `references/gotchas.md` | Anything weird, cross-cutting, or "why is this happening" — read first when debugging |
| `assets/plan-template.md` | Mode 1 step 9 — the `electron-app-plans/<app>.md` template |

**All essential workflow knowledge is in this SKILL.md — references contain extended depth only.**

## Validation Loops

For high-stakes operations (signing, releasing, security audits), use the validation pattern from the Anthropic guide:

1. Do the work
2. Run a checklist or script (e.g., `npx @doyensec/electronegativity .` for security)
3. Fix any issues
4. Re-run validation
5. Only proceed when validation passes

## Performance Notes

- Take your time. Quality > speed.
- Do not skip security checklist items "to be quick" — every skipped item is a potential RCE.
- Boil the ocean: when fixing one BrowserWindow's config, audit the others in the same file.

## Core Principles

- **Security first**: Treat the renderer as a hostile web page. Always.
- **Type everything across the IPC bridge**: untyped IPC is the #1 maintainability killer in Electron apps.
- **One config to rule them all**: electron-vite handles main/preload/renderer; don't fragment build configs.
- **Sign and notarize from day one**: setting up signing late is 10× harder than setting it up first.
- **Fix, don't note**: see a security flag misconfigured? Fix it now. A loose wire arcs.
