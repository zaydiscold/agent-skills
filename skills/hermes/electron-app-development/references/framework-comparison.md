# Framework Comparison: Electron vs Tauri vs Wails vs Native (2026)

Honest assessment for users who ask "should I use Electron at all?" Don't sell Electron when another tool is genuinely better.

## At-a-glance (April–May 2026)

| | Electron 41 | Tauri 2.10+ | Wails (Go + webview) | Native (Swift/WinUI/GTK) |
|---|---|---|---|---|
| Bundle size | 85–200 MB | 3–10 MB | 5–20 MB | 5–50 MB |
| Idle RAM | 150–400 MB | 30–80 MB | 20–60 MB | 20–100 MB |
| Cold start | 1–4s | 0.2–1s | 0.2–1s | 0.1–0.5s |
| Cross-platform consistency | Highest (bundles Chromium) | Medium (uses OS webview) | Medium | One codebase per OS |
| Web ecosystem | Full Node.js + npm | Limited (no Node; uses Rust crates) | Limited (Go stdlib + crates) | None |
| Backend language | JS/TS | Rust | Go | Native |
| Plugin ecosystem | Massive (decades of npm) | Growing | Small | Per-platform |
| Auto-update | Mature (electron-updater, MSIX, Squirrel) | Built-in | Built-in | Sparkle (mac), MS Store, etc. |
| Code signing tooling | Mature (Forge, builder) | Mature | OK | Native |
| Production-grade examples | VSCode, Discord, Slack, Linear, Cursor, Codex, Obsidian, Notion | 1Password 8 (parts), some indie | Indie tools | Logic Pro, Photoshop |
| Battery impact | Higher (own Chromium) | Lower (system webview) | Lower | Lowest |
| Webview consistency | Bundled — same on every machine | OS webview = different on Win 7 vs 11 | Same caveat | N/A |
| Learning curve for web devs | Lowest | Medium (Rust) | Low if you know Go | High |
| Time-to-MVP | Fastest | Medium | Fast for Go devs | Slowest |

## When to choose Electron (the honest list)

- **Web ecosystem dependence**: you need npm packages, Node native modules, or web-only libraries (Monaco, CodeMirror, etc.).
- **Cross-platform consistency**: you can't tolerate "looks wrong on Windows 10 with stale Edge webview."
- **Team is web devs** and you need to ship in weeks, not months.
- **Plugin/extension ecosystem**: you're building VSCode-like, the npm world is your moat.
- **Embedding heavy web tech**: PDFs, complex SVG, browser-grade WebGL/WebGPU.
- **Existing Electron mass apps**: VSCode, Discord, Slack, Notion, Linear, Obsidian, Cursor, Codex, Claude Desktop — they're not switching, and the muscle is here.

## When to choose Tauri instead

- **Distribution size matters** (sub-10 MB is a hard requirement — kiosks, embedded, small download mandates).
- **Battery / RAM is the product** — tools that run all day in the background (menu bar utilities).
- **Rust expertise on the team** — Tauri rewards Rust skill; without it you're fighting two ecosystems.
- **Security posture demands minimal attack surface** — Tauri's smaller bundle means less to audit, less to patch.
- **Mobile is on the roadmap** — Tauri 2 supports iOS/Android.

## When to choose native

- **Pro creative apps** where every ms matters and platform integration is the experience (Logic Pro, Final Cut, Photoshop).
- **Shipping to one platform only** — building macOS-only? SwiftUI is faster to first paint and integrates better.
- **OS-level UX expectations** are absolute (system-level animations, accessibility deep ties).

## When to choose Wails

- **Go shop**, doesn't want Rust, doesn't want Electron's weight.
- **Backend-heavy app** (sync, networking, data processing) where Go's concurrency shines.

## Common reframings of the question

- "Electron is too heavy" → often "I haven't lazy-loaded my main process or virtualized my list." Try `performance-tuning.md` first; switching frameworks won't help an undisciplined codebase.
- "Tauri is faster on benchmarks" → benchmarks measure boot and idle. Real-world app work is usually CPU-bound business logic; framework overhead is in the noise once you're 30 seconds in.
- "Should I rewrite my Electron app in Tauri?" → almost never worth it for a working app. Optimize what you have. Rewrite when you'd rewrite for any reason (architecture rot, etc.) — and treat the framework choice as one of many.

## What the 2026 Twitter pulse actually shows

- **Complaints are constant** ("Electron bloat", "Discord eats RAM", "Claude Desktop slower than ChatGPT native") — but the loudest critics are not the largest user bases.
- **AI coding agent space is 100% Electron** as of May 2026: Cursor, Codex, Claude Desktop, Windsurf, Antigravity, Zed (the holdout — Rust-native).
- **Zed 1.0 (May 2026) is the most credible "post-Electron" code editor**, but it's 5 years of full-time Rust + GPU UI work to ship. Most teams can't make that bet.
- **VSCode keeps adding sandboxing** (multi-process model, extension host isolation) — and it remains the most-used editor on earth. Existence proof that Electron at scale is workable.
- **Tauri momentum is real** for indie/single-developer apps (1Password 8 has Tauri components, dozens of small productivity tools).
- **Mobile cross-platform** discussions: Tauri 2 / Capacitor / React Native — Electron has no story here. If you need mobile, this matters.

## Decision tree

```
Need a desktop app?
├── Need cross-platform? 
│    ├── No (one OS only) → Native if pro-grade; otherwise Electron is fine
│    └── Yes
│         ├── Web devs only? → Electron (default)
│         ├── Sub-10MB bundle critical? → Tauri
│         ├── Rust shop? → Tauri
│         ├── Go shop? → Wails
│         ├── Need full Node ecosystem? → Electron
│         ├── Need plugin/extension system? → Electron (or native if pro)
│         └── Mobile soon? → Tauri 2 or rethink to React Native / Flutter
└── No, web app is enough → PWA. Stop here.
```

## Migration paths if a switch is genuinely warranted

- **Electron → Tauri**: rewrite main process in Rust; renderer mostly portable. Estimate: 50–80% main-process rewrite, 5–20% renderer changes (file APIs differ, IPC surface differs).
- **Tauri → Electron**: rare; usually because plugin ecosystem gap. Estimate: small if your renderer was clean React with no Tauri-specific APIs.
- **Electron → native**: 100% rewrite. Justify only by product reasons.

## The honest take for the planner phase

If the user's plan in Mode 1 doesn't have a strong reason to be desktop-only (filesystem, OS integration, offline, privacy, native APIs), challenge them: **a PWA might be enough**. Don't ship Electron when a web app works. The best Electron apps justify their existence.

If they DO need desktop, Electron is the safe bet for a web team in 2026 unless one of the "choose Tauri" bullets above clearly applies.
