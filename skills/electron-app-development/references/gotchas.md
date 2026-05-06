# Gotchas (cross-cutting)

The "I wasted 3 hours on this" file. Add to it whenever Claude or the user gets bitten.

## Contents

- [Build & dev](#build--dev)
- [IPC & preload](#ipc--preload)
- [Security](#security)
- [Packaging](#packaging)
- [Auto-update](#auto-update)
- [Performance](#performance)
- [Cross-platform](#cross-platform)
- [Native modules](#native-modules)
- [Single-instance & deep links](#single-instance--deep-links)
- [Misc](#misc)
- [New / 2025–2026 traps](#new--20252026-traps)
- [When something is just plain weird](#when-something-is-just-plain-weird)

---

## Build & dev

- **`NODE_MODULE_VERSION` mismatch**: native module compiled for system Node, not Electron's bundled Node. Run `npx electron-builder install-app-deps` (electron-builder) or rely on Forge auto-rebuild. With raw `electron-rebuild`: `npx @electron/rebuild -f`.
- **CJS vs ESM**: Main process is ESM-capable from v28, but most native modules and packagers expect CJS. **Preload MUST be CJS** — it runs in a special context that does `require()` synchronously. electron-vite handles this; don't override it.
- **HMR doesn't update preload**: preload changes require a full window reload. electron-vite handles this with `--watch` on the preload bundle, but if you bypass it, expect stale preload code.
- **Vite dev server vs file://**: in dev, renderer loads from `http://localhost:5173`; in production, from `file://` (or your custom protocol). Use `process.env.ELECTRON_RENDERER_URL` (electron-vite injects this) — don't hard-code.
- **TypeScript path aliases break in main**: `tsconfig` paths don't resolve at runtime. Use `vite-tsconfig-paths` or duplicate the alias in `electron.vite.config.ts`.

## IPC & preload

- **`window.api` is undefined in renderer**: 99% of the time, preload didn't load. Check the BrowserWindow's `webPreferences.preload` path is absolute, points to the **built** preload (`out/preload/index.cjs`), and that file actually exists.
- **`Cannot find module 'electron'` in preload**: don't `import { ipcRenderer } from 'electron'` — `import { ipcRenderer, contextBridge } from 'electron'` is correct, but make sure preload is built as CJS.
- **`event.sender` vs `event.senderFrame`**: the latter gives you the URL of the calling frame, which is what you want for security checks. `event.sender` is the WebContents (which can host multiple frames).
- **Listener leak across HMR**: re-renders create new `ipcRenderer.on` listeners. Always return the unsubscribe from `useEffect`. If you use the helper from `ipc-patterns.md`, it returns this for you.
- **Channel name typos pass silently**: this is why we use the typed channel map. Any string-only IPC will eventually bite you.

## Security

- **CVE-2026-34769 reminder**: never spread untrusted config into `webPreferences`. The undocumented `commandLineSwitches` key disables the sandbox.
- **`shell.openExternal` with user input is RCE-adjacent**: a `javascript:` or `file://` URL passed in here is bad. Allow-list `http:`, `https:`, `mailto:` only.
- **`allowRunningInsecureContent: true` for "fixing" a CSP issue is a giant footgun.** Fix the CSP instead.
- **Disabling `webSecurity` in dev "for now"** has a way of making it to production. Use a separate dev BrowserWindow factory if you must, with conditional config gated on `process.env.NODE_ENV`.
- **CSP via `<meta>` tag is partial** — some directives (frame-ancestors, sandbox) only work via HTTP header. Use `session.webRequest.onHeadersReceived` (see `security-checklist.md`).

## Packaging

- **`asar` and runtime require()**: things inside `app.asar` are read-only. If you need to write (e.g., a bundled DB), copy it to `app.getPath('userData')` on first run.
- **Helper apps unsigned on macOS**: the package now contains `Helper.app`, `Helper (GPU).app`, `Helper (Renderer).app`, `Helper (Plugin).app`. All must be signed with the same cert. Forge/builder handle this if `osxSign.deep: true` (Forge) or you don't set `signIgnore`.
- **Notarization fails with no message**: `xcrun notarytool log <submission-id> --keychain-profile <profile>` gives the actual JSON error. Often a stray unsigned binary or hardened-runtime missing from a helper.
- **`spctl --assess` rejects after notarization**: you forgot to `staple`. Use `xcrun stapler staple "YourApp.app"`.
- **DMG layouts**: `electron-builder` accepts a custom DMG background image at `build/background.png` + `dmg.icon` for the app icon. Both should be 540×380 (background) for retina-friendly look.

## Auto-update

- **Updates "succeed" but app launches old version**: most often code-signing identity changed between versions, so `electron-updater` rejects the downloaded payload. Verify signing identity is identical across releases.
- **`latest.yml` 404s**: your `publish` config doesn't match where you actually pushed the release. For GitHub, ensure the release is *published* (not draft).
- **`electron-updater` and Microsoft Store don't mix**: the store handles updates; disable in-app updater when shipping to Store.
- **First-run on Squirrel.Windows crash**: `process.argv.includes('--squirrel-firstrun')` — skip update check.
- **Linux AppImage updates need `appimageupdate`**: not enabled by default. Ship the `appimageupdate` integration if you want auto-update on Linux.

## Performance

- **Cold start slow**: profile with `process.hrtime()` around `app.whenReady()`, `BrowserWindow` creation, and `did-finish-load`. Common culprit: synchronous `require()` of a heavy module in main.
- **Memory grows over time**: usually a listener leak — `ipcRenderer.on` not removed, or a Map keyed by ephemeral object never cleaned. Use `--inspect` and Chromium DevTools heap snapshots.
- **High CPU when idle**: animation loops in renderer running while window is hidden. Use `document.visibilityState === 'hidden'` to pause.
- **Bundle size**: `asar` contents include node_modules. Use `files` config to exclude dev deps. `npx electron-builder --dir` then inspect the unpacked output for surprises.

## Cross-platform

- **`path.sep` and `path.join`**: always use `path.join`, never string concat. Backslashes on Windows.
- **Case-sensitive filesystems**: macOS default is case-INsensitive but case-PRESERVING; Linux is case-sensitive. Same code can break on CI.
- **Line endings**: store all files with LF (`.gitattributes` `text=auto eol=lf`). CRLF in shell scripts breaks Linux builds.
- **`app.getPath('userData')` differs**: `~/Library/Application Support/<name>` on Mac, `%APPDATA%/<name>` on Windows, `~/.config/<name>` on Linux.
- **Custom fonts on Linux**: bundle them or rely on system fonts; the rendered look differs.
- **Tray icon sizes**: macOS 22×22 (template image), Windows 16×16, Linux varies. Keep multiple PNGs.

## Native modules

- **`better-sqlite3` requires the right Python and toolchain at build time**: Visual Studio Build Tools on Windows; Xcode CLT on macOS; `python3 build-essential` on Linux.
- **`keytar` is deprecated** (officially since 2024). Use Electron's `safeStorage` API (built-in) or `node-keytar`'s maintained fork.
- **Don't use `node-fetch` or `axios` in main when `net.fetch` exists** — Electron's `net` module respects system proxy and certs.

## Single-instance & deep links

- **Without single-instance lock**, double-clicking a deep link spawns a second instance. Always:
  ```ts
  const got = app.requestSingleInstanceLock();
  if (!got) app.quit();
  app.on('second-instance', (_e, argv) => focusExistingWindow(argv));
  ```
- **macOS deep links** come via `open-url` event, NOT argv. Handle both.

## Misc

- **Console output from renderer doesn't show in terminal by default**: wire `webContents.on('console-message', ...)` to forward to main's stdout.
- **`globalShortcut` interferes with system shortcuts**: don't bind common ones (Cmd+Space, Cmd+Tab). Always release on `app.on('will-quit', () => globalShortcut.unregisterAll())`.
- **Electron Forge `start` doesn't reload main on changes**: that's a Forge limitation; use electron-vite or `nodemon` watching `out/main`.

## New / 2025–2026 traps

- **`keytar` is archived/unmaintained** as of 2024. Microsoft (VSCode) and the Electron team now recommend `safeStorage`. Migrate. See `os-integration.md`.
- **`safeStorage` returns garbage if called before `app.whenReady()`** on some platforms. Wait for ready, ideally after first BrowserWindow creation.
- **`BrowserView` is deprecated** as of Electron 30. Use `WebContentsView` + `BaseWindow` going forward — see `production-patterns.md` Pattern 11.
- **`File.path` removed from the standard Web File API** in Electron 32. Use `webUtils.getPathForFile(file)` instead. Existing drag-drop code that reads `file.path` will silently fail.
- **ASAR Integrity is OFF by default** even on macOS in Electron 41 — you must flip the `EnableEmbeddedAsarIntegrityValidation` Fuse explicitly. The default-on rumor is wrong.
- **MSIX auto-updater added in Electron 41** — if you're shipping to Microsoft Store with MSIX, you can use the same JSON update server format as Squirrel.Mac. Previously you had to disable in-app updates for store builds.
- **`disclaim: true` on `utilityProcess` is macOS-only** (Electron 41+) — TCC permission disclaiming. Useful for spawned subprocesses that shouldn't share your camera/mic prompts.
- **Universal binary on macOS won't merge architecture-specific native modules**: `@electron/universal` lipos identical files but native `.node` artifacts differ across arches. You need to either ship two builds OR use `lipo -create` on the .node files and tell `@electron/universal` to skip them via `x64ArchFiles`.
- **`webPreferences.sandbox: true` disables `require()` in preload**. Use `import` syntax with the right bundler config (electron-vite handles this), and remember the preload's surface is now even more restricted — only what `contextBridge` exposes.
- **`asarUnpack` files lose their executable bit on Linux/macOS** in some packagers. If you ship a binary helper inside `app.asar.unpacked`, verify with `ls -la` post-build and `chmod +x` in a `afterPack` hook if needed.
- **MCP / language-server subprocesses leak on quit**: `app.on('before-quit')` is the only reliable place to kill them. `app.on('will-quit')` may fire too late.
- **Apple Silicon native modules**: even on M1+ machines, npm sometimes installs the x64 version. Force with `arch -arm64 npm install` or rely on Forge/builder's `--arch=arm64` rebuild.
- **`net.fetch` doesn't follow `app.commandLine.appendSwitch('proxy-server', …)` until after `app.whenReady()`**. Wait for ready before configuring proxy switches.
- **Electron's bundled Node version differs from your host Node**: Electron 41 ships Node 24.14. If your dev machine has Node 22, native modules built locally may not load in the packaged app. Always run `electron-rebuild` against the Electron version, not host Node.

## When something is just plain weird

1. Try a clean build: `rm -rf node_modules out dist && npm ci && npm run build`.
2. Try a fresh user-data dir: `app.setPath('userData', '/tmp/electron-debug')` and re-run.
3. Try the **packaged** build, not dev — many bugs (asar, preload paths, code signing) are dev-mode-invisible.
4. Bisect Electron versions: try the previous major. If the bug disappears, check Electron's release notes for breaking changes.
5. Search the issue: `site:github.com/electron/electron <error>`.

---

## From the Hydra packaging trenches (2026-05)

Hard-won lessons from packaging an Express + Prisma + React app as an Electron desktop app. Append-only — earlier entries above are the canonical baseline; these add coverage for traps that are NOT in the official docs.

### Prisma + electron-builder

- **`.prisma/client` is silently filtered out of the asar** because electron-builder's default node_modules glob excludes leading-dot directories — even when you list `node_modules/.prisma/**` explicitly in `files:` AND `asarUnpack:`. The runtime then dies with `Cannot find module '.prisma/client/default'` when `@prisma/client/default.js` does its sibling `require('.prisma/client')`. Workaround: `asar: false` for Prisma-heavy apps OR an `afterPack` hook that `cpSync`s `node_modules/.prisma` into `app.asar.unpacked/node_modules/.prisma`. Filter by your build target's platform+arch when copying so you don't ship 80 MB of foreign engines. Issue: electron-userland/electron-builder#3537.

- **Listing `node_modules/**/*` in `files:` opts you out of production-pruning entirely**. electron-builder normally strips devDependencies, README/CHANGELOG, source maps, etc. — the moment you add `node_modules/**/*` to your whitelist it ships everything including dev deps. The fix is counter-intuitive: **delete the line** and let the default ruleset run. Add back only specific dotfile dirs (e.g., `node_modules/.prisma`) that the default glob misses.

- **`prisma db push` from inside a packaged `.app` has multiple silent failure modes**: (a) `process.cwd()` is `/` when launched from Finder, so `node_modules/.bin/prisma` resolves to `/node_modules/.bin/prisma` (doesn't exist); (b) `npx` isn't on the GUI launch's PATH (Electron doesn't inherit shell env). Use absolute paths derived from `app.getAppPath()` and write a self-heal fallback that replays each migration's idempotent `ALTER TABLE`/`CREATE INDEX` statements via `prisma.$executeRawUnsafe()` directly. Catch SQLite "duplicate column"/"already exists" errors and count them as `skipped`, not `errors`.

- **Prisma engine name varies subtly**: macOS arm64 is `libquery_engine-darwin-arm64.dylib.node`, macOS x64 is `libquery_engine-darwin.dylib.node` (no `-x64` suffix), Linux ARM is `libquery_engine-linux-arm64-openssl-3.0.x.so.node`. Get this wrong in your `afterPack` filter and the app boots but the first DB query fails with a confusing P1001 ("cannot reach database") that's actually a missing native module.

### GPU + Chromium

- **`app.disableHardwareAcceleration()` alone is a TRAP**. It tells Chromium "no Metal/GL pipeline" but doesn't kill the GPU helper process — Chromium falls back to **SwiftShader** (software GL emulation), which spins a GPU helper at 100% CPU forever rendering CSS in software triangles. Fix: combine with `app.commandLine.appendSwitch('disable-gpu')` AND `'disable-software-rasterizer'` so the GPU process exits entirely and the renderer uses the regular CPU 2D paint pipeline (correct for CSS-only React apps). For apps that DO have canvas/webgl, leave hardware acceleration on and don't touch it. Symptom of the trap: ~98% CPU on a process named `<Your App> Helper (GPU)` running with `--use-gl=angle --use-angle=swiftshader-webgl`.

### Schema sync performance

- **Run `prisma db push` only when the schema actually changed**. Compute a sha256 hash of `schema.prisma` content + every migration's SQL, compare against a `userData/.schema-version` sentinel, skip the push when unchanged. Saves 200–500 ms per launch on a packaged app. When iterating the migrations directory to compute the hash, **stat-check each entry first** — `prisma/migrations/migration_lock.toml` is a *file*, not a directory, and `readdirSync(migration_lock.toml)` throws `ENOTDIR`.

### Background-mode + lifecycle

- **Tray icon = "the proxy stays running" UX**. For an app whose value is a long-running local server (LLM proxy, sync daemon, dev tool), the close button should NOT quit the app — show a `dialog.showMessageBox` with "Keep Running / Quit / Cancel". On Keep, `mainWindow.hide()` + `app.dock?.hide()`; the Tray icon stays in the menu bar with "Show / Quit" entries. Track a `forceQuit` flag so explicit Quit (from menu/tray/IPC) bypasses the dialog and closes the window normally.

- **Single-instance lock is mandatory** for any app that holds a port or DB lock. Without `app.requestSingleInstanceLock()` + a `second-instance` event handler, double-clicking the `.app` while it's already running spawns a second Electron + Express that fights for `:33100` (or wherever) and produces a confusing flash of a half-loaded window before dying.

### Native + IPC

- **Per-install secrets via `safeStorage`**: when a packaged app needs a JWT signing secret or auth cookie that survives reinstalls, generate it once on first launch and store via Electron's `safeStorage.encryptString()` to a file in `userData`. The encryption key is tied to the OS user's macOS Keychain (or DPAPI on Windows, libsecret on Linux), so the cipher blob is useless on any other machine or to another user. Don't ship a default unsafe secret like `'dev-secret-unsafe'` baked into config — it WILL be the production secret if anyone forgets to override.

- **IPC handlers should return Result types, not raw values**. Electron only serializes `Error.message` across the IPC boundary — stack, code, and other props are lost. Wrap every `ipcMain.handle` callback to return `{ ok: true, data }` or `{ ok: false, error, code }`. Renderer side: `if (!result.ok) toast(result.error)` with no try/catch needed.

- **Path-allowlist `shell.openPath` arguments**. If you expose `native:open-path` from preload and let the renderer pass any string, you've handed the React UI (and any XSS that lands in it) the ability to open `/etc/passwd` or `~/.aws/credentials`. Restrict to a static allowlist: `app.getPath('userData')`, `app.getPath('logs')`, `app.getPath('downloads')`, `app.getPath('documents')`. Reject everything else with `code: 'PATH_DENIED'`.

### SSE proxies

- **Inject a synthetic error frame when an upstream SSE stream closes prematurely**. Track a `_sawDone` flag per request; on stream `close` without a `data: [DONE]\n\n` final frame, write `data: {"error":{"message":"upstream stream closed prematurely","code":"STREAM_INTERRUPTED"}}\n\ndata: [DONE]\n\n` before ending. Otherwise OpenAI-compat clients (Cursor, raw OpenAI SDK) hang on a truncated stream that looks identical to a network failure.

### Build environment

- **`npm run electron:build` fails with `which python` exit 1** if your machine has `python3` but no `python` alias. electron-builder's `install-app-deps` shells out to `which python` directly. Fix at the project level: `npm config set python /opt/homebrew/bin/python3`. Don't symlink `python3 → python` system-wide unless you want every other tool that hard-codes `python` to also start working — that has its own consequences.

