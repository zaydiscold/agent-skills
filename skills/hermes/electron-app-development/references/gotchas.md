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
