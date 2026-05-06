# Production Architecture Patterns (real-world apps, May 2026)

Patterns extracted from VSCode, Obsidian, Discord, Slack, Linear, Cursor, Codex, and Claude Desktop. These are battle-tested at scale; copy them, don't reinvent.

## Contents

- [Pattern 1 — VSCode's "shared process"](#pattern-1--vscodes-shared-process)
- [Pattern 2 — Extension/plugin host isolation (VSCode, Obsidian)](#pattern-2--extensionplugin-host-isolation-vscode-obsidian)
- [Pattern 3 — Streaming responses from main → renderer](#pattern-3--streaming-responses-from-main--renderer)
- [Pattern 4 — Process model: which work goes where](#pattern-4--process-model-which-work-goes-where)
- [Pattern 5 — Linear-style optimistic local-first](#pattern-5--linear-style-optimistic-local-first)
- [Pattern 6 — Single-instance + deep-link entry](#pattern-6--single-instance--deep-link-entry)
- [Pattern 7 — Crash isolation hierarchy](#pattern-7--crash-isolation-hierarchy)
- [Pattern 8 — Settings & preferences storage](#pattern-8--settings--preferences-storage)
- [Pattern 9 — Window restoration](#pattern-9--window-restoration)
- [Pattern 10 — Tray-resident apps (always-on utilities)](#pattern-10--tray-resident-apps-always-on-utilities)
- [Pattern 11 — Migrating BrowserView → WebContentsView](#pattern-11--migrating-browserview--webcontentsview)
- [Pattern 12 — Disclaiming TCC on macOS (Electron 41+)](#pattern-12--disclaiming-tcc-on-macos-electron-41)

---

## Pattern 1 — VSCode's "shared process"

**Problem:** opening 5 VSCode windows shouldn't spawn 5 file-watcher daemons, 5 terminal hosts, 5 extension installers. Renderer-per-window is mandatory; *services* should be shared.

**Solution:** A hidden Electron window with `show: false`, no UI, Node.js enabled. All other windows talk to it over **MessagePorts** for cross-window services.

```ts
// src/main/shared-process.ts
import { BrowserWindow, MessageChannelMain } from 'electron';

let sharedWindow: BrowserWindow | null = null;

export function getSharedProcess() {
  if (sharedWindow) return sharedWindow;
  sharedWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/shared.cjs'),
      contextIsolation: true,
      sandbox: false,                    // shared process runs trusted code
      nodeIntegration: false,
    },
  });
  sharedWindow.loadFile(path.join(__dirname, '../shared-process/index.html'));
  return sharedWindow;
}

// Connect a renderer window to the shared process via MessagePort.
export function connectToShared(rendererWin: BrowserWindow, kind: 'fs-watch' | 'terminal') {
  const { port1, port2 } = new MessageChannelMain();
  rendererWin.webContents.postMessage('shared-port', { kind }, [port1]);
  getSharedProcess().webContents.postMessage('shared-client', { kind, win: rendererWin.id }, [port2]);
}
```

In the shared process renderer, run a long-lived service (file watcher, terminal multiplexer, MCP server) that all windows query. This is how VSCode's terminals and file-watching survive window close/reopen and stay efficient.

## Pattern 2 — Extension/plugin host isolation (VSCode, Obsidian)

If your app has user-installable plugins, never run them in your main window's renderer. They WILL eventually be malicious or buggy.

**VSCode's model:** one **extension host** (`utilityProcess`) per window. Extensions have a frozen API surface. Renderer ↔ host communication via RPC over MessagePorts.

```ts
// main/extension-host.ts
import { utilityProcess, MessageChannelMain } from 'electron';

export function spawnExtensionHost(rendererWin: BrowserWindow) {
  const child = utilityProcess.fork(
    path.join(__dirname, '../ext-host/index.js'),
    [],
    { stdio: 'pipe' },
  );
  const { port1, port2 } = new MessageChannelMain();
  child.postMessage({ type: 'init' }, [port1]);
  rendererWin.webContents.postMessage('ext-host-port', null, [port2]);
  return child;
}
```

The extension-host JS file imports a controlled API (file system, network) and exposes only those methods to plugins via the MessagePort. Compare to Obsidian, which loads plugins **into** the main renderer — this is faster but means a malicious plugin gets full vault access.

## Pattern 3 — Streaming responses from main → renderer

For LLM streaming, file imports, or any long task, push chunks via `webContents.send`:

```ts
// main
async function streamChat(prompt: string, win: BrowserWindow) {
  const id = crypto.randomUUID();
  win.webContents.send('chat:start', { id });
  for await (const chunk of llm.stream(prompt)) {
    win.webContents.send('chat:chunk', { id, delta: chunk });
  }
  win.webContents.send('chat:done', { id });
}

ipcMain.handle('chat:request', (e, prompt) => {
  streamChat(prompt, BrowserWindow.fromWebContents(e.sender)!);
});
```

In renderer, accumulate by id:

```tsx
const [stream, setStream] = useState('');
useEffect(() => {
  const off1 = window.api.on('chat:start', ({ id }) => setStream(''));
  const off2 = window.api.on('chat:chunk', ({ delta }) => setStream((s) => s + delta));
  return () => { off1(); off2(); };
}, []);
```

Used by Claude Desktop, Cursor, Codex — every AI app does this.

## Pattern 4 — Process model: which work goes where

| Work type | Process | Why |
|-----------|---------|-----|
| UI rendering | Renderer | That's literally what it's for |
| OS calls (fs, shell, dialog) | Main | Only place with Node access |
| CPU-heavy (image proc, search index, regex over GB) | **utilityProcess** | Don't block main; main handles all OS calls |
| Network to LLMs / APIs | Main or **utilityProcess** | Use `net.fetch` for system proxy / certs |
| Cross-window services (file watch, terminal, MCP server) | Hidden **shared process** (BrowserWindow `show:false`) | Single instance, persists across windows |
| Plugins / untrusted code | **utilityProcess** with restricted API | Crash-safe, sandbox-able, isolatable |
| Native module integration | Main or utilityProcess | Both can `require()` native modules |

Rule of thumb: **main process is for orchestration, not work.** Push work to utility processes.

## Pattern 5 — Linear-style optimistic local-first

Pattern: SQLite (better-sqlite3 + Drizzle) is the source of truth on the device; renderer queries it via IPC; sync-down-from-server happens in main process; UI is always instant because it never waits on network.

```ts
// main/sync.ts
async function syncLoop() {
  const lastSync = db.meta.get('lastSync')?.value ?? 0;
  const updates = await api.fetchUpdatesSince(lastSync);
  db.transaction(() => {
    for (const u of updates) db.upsert(u);
    db.meta.set('lastSync', Date.now());
  });
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('data:changed', updates.map((u) => u.id));
  }
  setTimeout(syncLoop, 30_000);
}
```

Renderer subscribes to `data:changed` and re-runs its IPC queries. UI never blocks on network.

## Pattern 6 — Single-instance + deep-link entry

```ts
const got = app.requestSingleInstanceLock();
if (!got) { app.quit(); }

app.on('second-instance', (_e, argv) => {
  // Windows/Linux: deep link arrives in argv as `myapp://...`
  const deepLink = argv.find((a) => a.startsWith('myapp://'));
  focusMainWindow();
  if (deepLink) handleDeepLink(deepLink);
});

// macOS: deep link arrives via 'open-url' event, not argv
app.on('open-url', (e, url) => { e.preventDefault(); handleDeepLink(url); });

app.setAsDefaultProtocolClient('myapp');
```

Every Electron app that handles deep links needs this exact 3-block pattern. Forgetting any block breaks one platform.

## Pattern 7 — Crash isolation hierarchy

```
Main process crashes      → entire app dies (fatal — log + restart with `process.relaunch()`)
Renderer crashes          → that window dies (handle 'render-process-gone'; offer reload)
utilityProcess crashes    → catch on 'exit'; restart the process; surface a banner
GPU process crashes       → Chromium auto-restarts; usually fine
```

```ts
mainWin.webContents.on('render-process-gone', (_e, details) => {
  log.error('renderer crashed', details);
  if (details.reason !== 'clean-exit') {
    dialog.showMessageBoxSync(mainWin, {
      type: 'error',
      message: `The window crashed (${details.reason}). Reload?`,
      buttons: ['Reload', 'Quit'],
    }) === 0 ? mainWin.reload() : app.quit();
  }
});

app.on('child-process-gone', (_e, details) => {
  log.error('child crashed', details);   // utility, gpu, plugin, etc.
});
```

## Pattern 8 — Settings & preferences storage

| Need | Tool |
|------|------|
| Tiny config (theme, last-window-pos, feature flags) | `electron-store` (JSON file in userData) |
| User data (notes, projects, history) | `better-sqlite3` + Drizzle |
| Secrets (tokens, API keys, refresh tokens) | `safeStorage.encryptString` then write to disk |
| Cache (LLM responses, network) | LRU in main, persisted to a file via `app.getPath('cache')` |

**Never use `localStorage` for important state.** It's renderer-scoped, can be cleared by the user, and is wiped if you change origins.

## Pattern 9 — Window restoration

Save and restore window bounds, monitor, maximized state:

```ts
const state = electronStore.get('windowState') ?? { width: 1200, height: 800 };

const win = new BrowserWindow({
  ...state,
  show: false,
});
if (state.maximized) win.maximize();

win.on('close', () => {
  if (!win.isMaximized()) {
    const b = win.getBounds();
    electronStore.set('windowState', { ...b, maximized: false });
  } else {
    electronStore.set('windowState', { ...electronStore.get('windowState'), maximized: true });
  }
});
```

Use `electron-window-state` if you want this with multi-monitor handling included.

## Pattern 10 — Tray-resident apps (always-on utilities)

For apps like Raycast, Magnet, or any "available everywhere" tool:

```ts
import { Tray, Menu, globalShortcut } from 'electron';

let tray: Tray | null = null;
let win: BrowserWindow | null = null;

app.whenReady().then(() => {
  tray = new Tray(path.join(__dirname, 'tray-icon-template.png'));
  tray.on('click', toggleWindow);

  globalShortcut.register('Cmd+Space', toggleWindow);

  // Hide from dock on macOS — make it tray-only.
  if (process.platform === 'darwin') app.dock?.hide();
});

function toggleWindow() {
  if (!win) win = createTrayWindow();
  win.isVisible() ? win.hide() : positionAndShow(win);
}
```

Pin the tray icon as a **template image** on macOS (black-and-transparent, will adapt to light/dark menu bar automatically). Filename ending in `Template.png` is the convention.

## Pattern 11 — Migrating BrowserView → WebContentsView

Electron 30+ deprecated `BrowserView`. Use `WebContentsView` + `BaseWindow` instead:

```ts
// OLD (deprecated)
const view = new BrowserView({ /* prefs */ });
mainWindow.setBrowserView(view);
view.setBounds({ x: 0, y: 100, width: 800, height: 500 });

// NEW
import { BaseWindow, WebContentsView } from 'electron';
const win = new BaseWindow({ width: 1200, height: 800 });
const view = new WebContentsView({ webPreferences: { /* … */ } });
win.contentView.addChildView(view);
view.setBounds({ x: 0, y: 100, width: 800, height: 500 });
```

Migrate before BrowserView is removed in a future major.

## Pattern 12 — Disclaiming TCC on macOS (Electron 41+)

If your `utilityProcess` shouldn't inherit microphone/camera/screen-recording permissions from the main process (e.g., you spawn an MCP server and don't want it to count against your TCC prompts), use the new `disclaim` option:

```ts
const child = utilityProcess.fork(scriptPath, args, {
  disclaim: true,         // macOS-only; child process is TCC-disclaimed
});
```

This is a security defense-in-depth — limits the child's blast radius if compromised.
