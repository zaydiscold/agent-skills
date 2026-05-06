# {{App Name}}

> Saved by the `electron-app-development` skill on {{date}}.

## 1. Concept

**Tagline:** {{one sentence}}

**Problem solved:** {{user pain point}}

**Why desktop (not web/mobile):** {{native angle: filesystem, offline, OS integration, privacy, performance}}

**Reference apps:** {{competitor names + 1-line read on each}}

## 2. Audience & Distribution

| | |
|---|---|
| Target user | {{persona}} |
| Platforms | {{macOS / Windows / Linux}} |
| Distribution channel | {{own site / MAS / MS Store / internal}} |
| Revenue model | {{free / one-time / subscription / freemium}} |

## 3. MVP scope (≤5 features)

1. {{Must-have 1}}
2. {{Must-have 2}}
3. {{Must-have 3}}
4. {{Must-have 4}}
5. {{Must-have 5}}

**Explicitly OUT of MVP:** {{nice-to-haves deferred}}

## 4. Architecture

| Concern | Decision |
|---------|----------|
| Electron version | {{e.g., 41.x}} |
| Build | electron-vite |
| Renderer UI | React 19 + TypeScript + Tailwind 4 |
| Renderer state | Zustand |
| Main-process state | {{plain object + JSON / SQLite}} |
| Persistence | {{better-sqlite3 + drizzle / electron-store / file-based}} |
| Packager | {{Electron Forge / electron-builder}} |
| Auto-update | electron-updater |
| Crash reporting | Sentry Electron SDK |
| Logging | electron-log |
| Testing | Vitest + Playwright |

**Native capabilities required:** {{filesystem / system tray / global shortcuts / camera / mic / USB / Bluetooth / OS notifications / deep links / custom protocol}}

**Multi-window?** {{yes/no — and if yes, how state is shared}}

## 5. Security & privacy plan

- [ ] `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- [ ] Strict CSP set via session header
- [ ] Hardenings applied to ALL `web-contents-created`
- [ ] Typed IPC + sender-frame validation
- [ ] `setWindowOpenHandler` defaults to deny
- [ ] No user input spread into `webPreferences`
- [ ] Local server (if any): bound to 127.0.0.1, auth-token required
- [ ] Code signing certs procured: macOS {{Y/N}}, Windows {{Y/N}}

**Data leaving the device:** {{telemetry, crash reports, sync — list explicitly with opt-in/opt-out}}

**Privacy posture:** {{e.g., "no telemetry by default"}}

## 6. Distribution & update strategy

| Item | Plan |
|------|------|
| macOS code signing | Developer ID Application — {{cert ETA}} |
| macOS notarization | `@electron/notarize` + app-specific password |
| Windows code signing | {{EV / standard / Azure Trusted Signing}} — {{cert ETA}} |
| Linux | AppImage + .deb |
| Auto-update server | GitHub Releases via electron-updater |
| Staged rollout | 10% → 50% → 100% over 5 days |
| Update channel | latest / beta / nightly |

## 7. Roadmap

| Week | Goal |
|------|------|
| 1 | Scaffold, secure defaults verified, first typed IPC channel, DB schema |
| 2 | Core feature 1, auto-update wiring, CI skeleton |
| 3 | Core features 2–3, macOS signing dry-run |
| 4 | Core features 4–5, Windows signing dry-run, Linux build |
| 5 | Internal alpha, crash reporting integration |
| 6 | Public beta (staged 10%) |
| 7–8 | Bug fixes from beta, iterate rollout |
| 9 | 1.0 release |

## 8. Risks & open questions

- {{risk 1, e.g., "EV cert procurement timeline"}}
- {{risk 2, e.g., "better-sqlite3 native module on Apple Silicon CI"}}
- {{open question 1}}

## 9. Decisions log

- {{date}}: chose Electron Forge over electron-builder because {{reason}}.
- {{date}}: …

## 10. Next concrete step

{{e.g., "Scaffold the project: run `npm create @quick-start/electron@latest …`"}}
