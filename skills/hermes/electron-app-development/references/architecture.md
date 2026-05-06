# Electron Architecture (2026)

## Contents

- [The three processes](#the-three-processes)
- [Recommended file layout (electron-vite + React)](#recommended-file-layout-electron-vite--react)
- [`electron.vite.config.ts`](#electronviteconfigts)
- [Main process bootstrap](#main-process-bootstrap)
- [Persistence: better-sqlite3 + drizzle](#persistence-better-sqlite3--drizzle)
- [Native modules — must be rebuilt for Electron's Node ABI](#native-modules--must-be-rebuilt-for-electrons-node-abi)
- [Renderer state](#renderer-state)
- [Routing](#routing)
- [Hot Module Replacement](#hot-module-replacement)
- [Single vs multi-window apps](#single-vs-multi-window-apps)
- [Custom URL scheme (optional)](#custom-url-scheme-optional)
- [Logging](#logging)

---

## The three processes

| Process | Runtime | Lives in | Can do |
|---------|---------|----------|--------|
| **Main** | Node.js (full APIs) | One per app | OS-level: BrowserWindow, Menu, Tray, dialog, shell, fs, net, child_process, native modules |
| **Preload** | Special isolated context (Node primitives + DOM, but `window` is NOT renderer's) | One per `BrowserWindow` | Bridge — narrow, typed surface exposed via `contextBridge` |
| **Renderer** | Chromium (no Node by default — and never enable Node) | One per window/frame | Web APIs only. Touches OS only via the preload bridge |

Mental model: **renderer = your web app, main = the OS, preload = a customs checkpoint between them.**

## Recommended file layout (electron-vite + React)

```
my-app/
├── package.json
├── electron.vite.config.ts          # ONE config for all three processes
├── electron-builder.yml             # OR forge.config.cjs (pick one packager)
├── tsconfig.json
├── tsconfig.node.json
├── src/
│   ├── main/
│   │   ├── index.ts                 # app.whenReady, createMainWindow, IPC registration
│   │   ├── window.ts                # BrowserWindow factory with secure defaults
│   │   ├── ipc/
│   │   │   ├── index.ts             # central registerHandlers()
│   │   │   ├── app.ts               # 'app:*' handlers
│   │   │   ├── db.ts                # 'db:*' handlers
│   │   │   └── …
│   │   ├── db/                      # better-sqlite3 + drizzle
│   │   ├── auto-update.ts
│   │   └── menu.ts
│   ├── preload/
│   │   └── index.ts                 # contextBridge.exposeInMainWorld('api', …)
│   ├── renderer/
│   │   ├── index.html
│   │   ├── main.tsx                 # createRoot + <App />
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── stores/                  # Zustand
│   │   └── types.d.ts               # window.api type augmentation
│   └── shared/
│       ├── ipc.ts                   # IpcChannels type
│       └── types.ts                 # domain types reused everywhere
├── resources/                        # icons, tray images, entitlements.plist
└── build/                            # build-time assets (icons in correct sizes)
```

## `electron.vite.config.ts`

```ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': path.resolve(__dirname, 'src/shared') } },
    build: {
      rollupOptions: { input: { index: 'src/main/index.ts' } },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Preload MUST output CJS — Electron preload context expects sync require.
      rollupOptions: { input: { index: 'src/preload/index.ts' } },
    },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src/renderer') } },
    build: { rollupOptions: { input: 'src/renderer/index.html' } },
  },
});
```

## Main process bootstrap

```ts
// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './window';
import { registerIpcHandlers } from './ipc';
import { initAutoUpdate } from './auto-update';

app.whenReady().then(() => {
  registerIpcHandlers();
  const win = createMainWindow();
  win.once('ready-to-show', () => win.show());
  initAutoUpdate(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Single-instance lock — second launch focuses existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});
```

## Persistence: better-sqlite3 + drizzle

```ts
// src/main/db/index.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import * as schema from './schema';

const dbPath = path.join(app.getPath('userData'), 'app.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');         // crash-safe + concurrent reads
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('synchronous = NORMAL');       // good speed/safety trade-off
export const db = drizzle(sqlite, { schema });
```

Run migrations on app start with `drizzle-kit migrate` against the user data dir.

## Native modules — must be rebuilt for Electron's Node ABI

```bash
# Forge auto-rebuilds. If you're using electron-builder:
npx electron-builder install-app-deps

# Or manually:
npx @electron/rebuild -f -w better-sqlite3
```

The error you'll see if you forget: `NODE_MODULE_VERSION X. This version of Node.js requires Y.`

## Renderer state

- **Zustand** for renderer-local UI state (per-window).
- **Main process** for cross-window or persistent state (see `ipc-patterns.md` → "Multi-window state").

## Routing

`react-router` v7 `MemoryRouter` works well. Avoid `BrowserRouter` — Electron file URLs aren't a real history backend.

## Hot Module Replacement

`electron-vite` HMR works for renderer out of the box. For main and preload, it restarts the app — that's fine; main process state should be cheap to rebuild.

## Single vs multi-window apps

- **Single-window** (most apps): one `BrowserWindow`, navigation via React Router inside.
- **Multi-window** (DAW, IDE-style): main process tracks `Map<WindowId, BrowserWindow>`, broadcasts state changes, each window has its own preload context but shares the same preload script.

## Custom URL scheme (optional)

```ts
import { protocol } from 'electron';
import { fileURLToPath } from 'node:url';

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const filePath = fileURLToPath('file://' + new URL(req.url).pathname);
    return net.fetch('file://' + filePath);
  });
});
```

Lets you load `app://renderer/index.html` instead of a fragile `file://` path. Important for service workers and some web APIs that require a "secure context".

## Logging

- `electron-log` is the de facto choice. Logs to `~/Library/Logs/<app>/main.log` on macOS, `%APPDATA%/<app>/logs` on Windows, `~/.config/<app>/logs` on Linux.
- Pipe renderer console messages to the same log via `webContents.on('console-message')` if you need them.
