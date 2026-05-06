# Electron Security Checklist (2026)

Treat the renderer like an untrusted web page. Every item below is a hard pass/fail.

## Contents

- [The 24-item checklist](#the-24-item-checklist)
- [Reference: secure default config](#reference-secure-default-config)
- [Apply hardening to ALL contents (not just your main window)](#apply-hardening-to-all-contents-not-just-your-main-window)
- [2026 CVE highlights — patch immediately](#2026-cve-highlights--patch-immediately)
- [Electron Fuses — package-time hardening](#electron-fuses--package-time-hardening)
- [Run the linter](#run-the-linter)
- [Localhost is not a security boundary](#localhost-is-not-a-security-boundary)
- [Custom protocols](#custom-protocols)
- [Native capability gates](#native-capability-gates)
- [Auto-updater is in scope](#auto-updater-is-in-scope)

---

## The 24-item checklist

| # | Item | Required value / behavior |
|---|------|--------------------------|
| 1 | `nodeIntegration` | `false` (default since Electron 5; never re-enable) |
| 2 | `contextIsolation` | `true` (default since Electron 12) |
| 3 | `sandbox` | `true` (default for windows without preload since Electron 20; set explicitly anyway) |
| 4 | `webSecurity` | `true` (never disable) |
| 5 | `allowRunningInsecureContent` | `false` |
| 6 | `experimentalFeatures` | `false` |
| 7 | `enableBlinkFeatures` | empty / unset |
| 8 | `nodeIntegrationInWorker` | `false` |
| 9 | `nodeIntegrationInSubFrames` | `false` |
| 10 | `enableRemoteModule` | `false` (deprecated and removed in v14, but explicit is good) |
| 11 | All loaded URLs over HTTPS | yes — block file:// from loading remote |
| 12 | Content Security Policy header set | yes — `default-src 'self'; script-src 'self'`; no `unsafe-eval` / `unsafe-inline` |
| 13 | `webContents.setWindowOpenHandler` returns `{ action: 'deny' }` for any URL not on an allow-list | yes |
| 14 | `webContents.on('will-navigate', ...)` blocks off-origin navigation | yes |
| 15 | `webContents.on('will-attach-webview', ...)` strips dangerous webPreferences | yes |
| 16 | No `<webview>` tags unless absolutely required (use `WebContentsView` instead) | yes |
| 17 | `webPreferences` is constructed from a literal, NOT spread from user input | yes — see CVE-2026-34769 |
| 18 | Preload uses `contextBridge.exposeInMainWorld` only — never assigns to `window.*` directly | yes |
| 19 | Preload exposes typed function wrappers, not raw `ipcRenderer` | yes — see `ipc-patterns.md` |
| 20 | `app.on('web-contents-created', ...)` applies the above hardenings to every contents | yes |
| 21 | All `ipcMain.handle` handlers validate caller via `event.senderFrame.url` allow-list | yes — esp. for filesystem/shell access |
| 22 | No `shell.openExternal(userInput)` without a protocol allow-list (`http:`, `https:`, `mailto:` only) | yes |
| 23 | No `child_process.exec` / `spawn` with shell-interpreted user input | yes — use array form, never string |
| 24 | Electron version is current; you've reviewed the latest security release notes | yes |
| 25 | **Electron Fuses** configured (`EnableEmbeddedAsarIntegrityValidation`, `OnlyLoadAppFromAsar`, `RunAsNode: false`) | yes — see Fuses section below |
| 26 | Secrets stored via `safeStorage` (not plaintext, not localStorage, not `electron-store` plain) | yes — see `os-integration.md` |
| 27 | Refresh tokens via OAuth use **PKCE**; no embedded `client_secret` | yes — see `os-integration.md` |
| 28 | All deep-link parameters validated against an allow-list before dispatch | yes — never `shell.openExternal(deepLinkParam)` |

## Reference: secure default config

```ts
// src/main/window.ts
import { BrowserWindow, app, shell, session } from 'electron';
import path from 'node:path';

const ALLOWED_ORIGINS = new Set(['file://', 'https://your-prod-host.com']);

export function createMainWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      // Security defaults — DO NOT spread an outside config object here.
      preload: path.join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  });

  // 1. Block off-origin navigation.
  win.webContents.on('will-navigate', (e, url) => {
    const origin = new URL(url).origin + '/';
    if (!ALLOWED_ORIGINS.has(origin)) e.preventDefault();
  });

  // 2. Default-deny window.open.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://your-allowed-domain.com')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // 3. Strip dangerous webview attributes.
  win.webContents.on('will-attach-webview', (_e, webPreferences) => {
    delete (webPreferences as any).preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });

  // 4. CSP at the session level (reinforces any HTML-meta CSP).
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://your-api.example;",
        ],
      },
    });
  });

  return win;
}
```

## Apply hardening to ALL contents (not just your main window)

```ts
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', /* deny off-origin */);
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', /* strip prefs */);
});
```

## 2026 CVE highlights — patch immediately

| CVE | Severity | Pattern |
|-----|----------|---------|
| **CVE-2026-34780** | High (8.4) | Context isolation bypass via `VideoFrame` from WebCodecs API. If a preload passes a `VideoFrame` to the main world, an XSS can bridge isolation. **Mitigation**: never pass complex Web API objects across `contextBridge`; serialize through structured-clone-safe primitives. |
| **CVE-2026-34769** | High (8.0) | Renderer command-line switch injection via undocumented `commandLineSwitches` `webPreference`. Spreading untrusted config into `webPreferences` lets an attacker disable the sandbox. **Mitigation**: never spread; allow-list keys. |
| **CVE-2025-55305** | High (8.4) | ASAR Integrity Bypass via resource modification — attackers swap files inside the .app/.exe bundle. **Mitigation**: enable `EnableEmbeddedAsarIntegrityValidation` + `OnlyLoadAppFromAsar` Fuses (Electron 41+ embeds the integrity digest itself). |
| 2025 series (5 CVEs) | 7.0–8.4 | Sandbox escape + context isolation bypass via internal IPC channels. **Mitigation**: stay current. |

Update path: bump to **Electron 41, 40, or 39 (latest patch)**. Electron 41 (March 2026) ships Chromium 146, V8 14.6, Node 24.14.

## Electron Fuses — package-time hardening

Fuses are bits flipped in the Electron binary at packaging time that can't be re-enabled at runtime — even by an attacker with FS write access. **Configure all of these:**

```js
// forge.config.cjs (using @electron-forge/plugin-fuses)
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,                              // disable -e/-r/Node CLI mode
      [FuseV1Options.EnableCookieEncryption]: true,                  // encrypt cookies on disk
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,   // ignore NODE_OPTIONS
      [FuseV1Options.EnableNodeCliInspectArguments]: false,          // ignore --inspect at launch
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,   // verify asar against embedded digest (CVE-2025-55305)
      [FuseV1Options.OnlyLoadAppFromAsar]: true,                     // refuse to load anything outside app.asar
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,       // don't give file:// extra power
    }),
  ],
};
```

For electron-builder use the [`afterPack` hook with `@electron/fuses` directly](https://www.electron.build/tutorials/adding-electron-fuses.html). Verify after build:

```bash
npx @electron/fuses read --app dist/mac/YourApp.app
```

**Critical**: `EnableEmbeddedAsarIntegrityValidation` requires `@electron/asar` ≥ 3.1.0 to generate the digest at pack time.

## Run the linter

```bash
# Static analysis for the entire checklist above
npx @doyensec/electronegativity -i .
```

Treat any HIGH or MEDIUM finding as a release-blocker.

## Localhost is not a security boundary

If your main process spawns a local HTTP/WebSocket server (common for embedding language servers, ML runtimes, etc.):

- Bind to **`127.0.0.1`** explicitly, never `0.0.0.0`.
- Require an **auth token** generated at app start, rotated per session, sent in `Authorization: Bearer …`.
- Set strict CORS: `Access-Control-Allow-Origin` to your app's `file://` or custom protocol only.
- For WebSocket, validate the `Origin` header on the server side.
- Be aware of Chromium's **Private Network Access (PNA)** — public sites can still attempt preflighted requests to `127.0.0.1`. Your auth token is the real defense.

## Custom protocols

Prefer `protocol.handle()` (Electron 25+) with `app.setAsDefaultProtocolClient` and an explicit URL parser. Reject any path containing `..`, NUL bytes, or backslashes on Windows.

## Native capability gates

For each renderer-requestable capability, decide and document:

- File system access — wrap in main process, validate against an allow-list of paths.
- Shell.openExternal — protocol allow-list only.
- Clipboard — read access is privacy-sensitive; gate behind an explicit user gesture.
- Camera/Mic — request via `session.setPermissionRequestHandler` and grant per origin.
- USB/HID/Serial — same; require user-visible device picker.

## Auto-updater is in scope

A vulnerable update channel = full RCE. See `packaging-distribution.md` for code-signing rigor and signature verification on update payloads.
