# Performance Tuning

Concrete techniques to take an Electron app from "feels heavy" to "feels native." Every tip here has been used by VSCode, Slack, Notion, Atom, or Discord.

## Contents

- [Boot time targets](#boot-time-targets)
- [Technique 1 — V8 snapshots (Atom team: -50%; VSCode uses since 2017)](#technique-1--v8-snapshots-atom-team--50-vscode-uses-since-2017)
- [Technique 2 — ASAR + minimal `require()` graph](#technique-2--asar--minimal-require-graph)
- [Technique 3 — Show window before renderer fully loads](#technique-3--show-window-before-renderer-fully-loads)
- [Technique 4 — Code-split the renderer (Vite handles automatically)](#technique-4--code-split-the-renderer-vite-handles-automatically)
- [Technique 5 — Move CPU work to `utilityProcess`](#technique-5--move-cpu-work-to-utilityprocess)
- [Technique 6 — Idle work via `requestIdleCallback`](#technique-6--idle-work-via-requestidlecallback)
- [Technique 7 — Memory: don't pay for what you don't show](#technique-7--memory-dont-pay-for-what-you-dont-show)
- [Technique 8 — Native dependencies hurt cold start](#technique-8--native-dependencies-hurt-cold-start)
- [Technique 9 — Bundle profiling](#technique-9--bundle-profiling)
- [Technique 10 — Throttle / batch IPC](#technique-10--throttle--batch-ipc)
- [Technique 11 — Minimize main-process work per frame](#technique-11--minimize-main-process-work-per-frame)
- [Technique 12 — Disable hardware acceleration only if needed](#technique-12--disable-hardware-acceleration-only-if-needed)
- [Memory profiling](#memory-profiling)
- [Diagnostic flags](#diagnostic-flags)
- [Honest perspective on "Electron is slow"](#honest-perspective-on-electron-is-slow)

---

## Boot time targets

| Tier | Cold start | What it takes |
|------|-----------|--------------|
| **Fast** | <500ms | V8 snapshot + minimal main + lazy renderer |
| **Good** | <1.5s | ASAR + lazy `require()` + small initial bundle |
| **Acceptable** | <3s | ASAR + decent code-splitting |
| **Bad** | >3s | What most untuned Electron apps do |

Measure: `process.hrtime.bigint()` at very start of main, again at `did-finish-load`. Log the diff to `electron-log` so you can compare across releases.

## Technique 1 — V8 snapshots (Atom team: -50%; VSCode uses since 2017)

V8 snapshots serialize an initialized JS heap to a binary file. At boot, V8 deserializes instead of executing — skipping the cost of `require()` parsing.

**Reported wins:**
- Atom: 50% startup reduction
- Snapshot removes ~81% of `require()` time
- ~36% overall startup improvement

### Setup

```bash
npm install --save-dev electron-link mksnapshot
```

```js
// build/snapshot.js
const path = require('path');
const electronLink = require('electron-link');

(async () => {
  const baseDirPath = path.resolve(__dirname, '..');
  const mainPath = path.join(baseDirPath, 'out/main/index.js');
  const result = await electronLink({
    baseDirPath,
    mainPath,
    cachePath: path.join(baseDirPath, 'cache', 'snapshot'),
    shouldExcludeModule: (modulePath) =>
      // Modules that touch the filesystem at require-time can't be snapshotted.
      ['fs', 'electron', 'better-sqlite3'].some((m) => modulePath.includes(m)),
  });
  // Write `result.snapshotScript` to a file, then run mksnapshot on it.
})();
```

Use Electron's `app.commandLine.appendSwitch('js-flags', '--snapshot-blob=/path/to/snapshot.bin')` to load it at startup.

**Caveat:** snapshots are fragile — any module that does `require()` at import-time of native code or reads files synchronously must be excluded. Bisect by removing dependencies from the snapshot list until it works.

## Technique 2 — ASAR + minimal `require()` graph

```js
// electron-builder.yml
asar: true
asarUnpack:
  - "node_modules/better-sqlite3/build/**"      # native modules can't live in asar
  - "resources/llm-models/*"                     # large binary assets
```

**Defer `require()`** for anything not needed at first paint:

```ts
// ❌ Bad — loaded at startup
import { autoUpdater } from 'electron-updater';
import Sentry from '@sentry/electron/main';
import { setupTelemetry } from './telemetry';

// ✅ Good — lazy
async function initBackgroundServices(win: BrowserWindow) {
  // Wait for ready-to-show, then defer.
  setTimeout(async () => {
    const { autoUpdater } = await import('electron-updater');
    autoUpdater.checkForUpdatesAndNotify();
    const Sentry = await import('@sentry/electron/main');
    Sentry.init({ dsn: '…' });
  }, 1000);
}
```

## Technique 3 — Show window before renderer fully loads

```ts
const win = new BrowserWindow({ show: false, /* … */ });
win.once('ready-to-show', () => win.show());           // ← shows when first paint is ready
```

Or even faster — show a splash window:

```ts
const splash = new BrowserWindow({ width: 400, height: 300, frame: false, show: true });
splash.loadFile('splash.html');                         // pure HTML, no JS

const main = new BrowserWindow({ show: false, /* … */ });
main.once('ready-to-show', () => {
  main.show();
  splash.close();
});
```

## Technique 4 — Code-split the renderer (Vite handles automatically)

```tsx
const Settings = lazy(() => import('./Settings'));
const Editor = lazy(() => import('./Editor'));

<Suspense fallback={<Spinner />}>
  <Routes>
    <Route path="/settings" element={<Settings />} />
    <Route path="/" element={<Editor />} />
  </Routes>
</Suspense>
```

Vite emits per-route chunks. Initial bundle stays small.

## Technique 5 — Move CPU work to `utilityProcess`

**Before:** main process indexes 50k files synchronously → UI freezes for 12 seconds → users report "app froze."

**After:**

```ts
// main/index-service.ts
import { utilityProcess, MessageChannelMain } from 'electron';

const child = utilityProcess.fork(path.join(__dirname, '../indexer/index.js'));
const { port1, port2 } = new MessageChannelMain();
child.postMessage({ type: 'init' }, [port1]);
mainWindow.webContents.postMessage('indexer-port', null, [port2]);

// Renderer talks to indexer DIRECTLY via the MessagePort — main process is out of the loop.
```

```ts
// indexer/index.js — runs in utilityProcess
process.parentPort.once('message', ({ ports: [port] }) => {
  port.on('message', async ({ data }) => {
    if (data.type === 'index-files') {
      for (const f of data.files) {
        const result = await indexOne(f);
        port.postMessage({ type: 'progress', file: f, result });
      }
      port.postMessage({ type: 'done' });
    }
  });
  port.start();
});
```

The renderer streams progress back, never blocks. Main process is uninvolved.

## Technique 6 — Idle work via `requestIdleCallback`

```tsx
useEffect(() => {
  const id = (window as any).requestIdleCallback(() => {
    prefetchData();
    warmCaches();
  }, { timeout: 5000 });
  return () => (window as any).cancelIdleCallback(id);
}, []);
```

In main, use `setImmediate` chains to avoid blocking the event loop.

## Technique 7 — Memory: don't pay for what you don't show

- Hidden window? `win.webContents.setBackgroundThrottling(true)` (default true) lets Chromium throttle JS.
- Truly unused window? `win.destroy()` and recreate later — keeping a hidden window costs ~80–150 MB.
- Renderer animations: `document.visibilityState === 'hidden'` → pause RAF loops.

## Technique 8 — Native dependencies hurt cold start

`better-sqlite3` adds ~80ms to require(); `sharp` adds ~150ms; `node-pty` ~50ms. Lazy-require them on first use, not at startup.

```ts
let dbInstance: Database | null = null;
function db() {
  if (dbInstance) return dbInstance;
  const Database = require('better-sqlite3');
  dbInstance = new Database(path);
  return dbInstance;
}
```

## Technique 9 — Bundle profiling

```bash
# What's in your app.asar?
npx asar list dist/mac/YourApp.app/Contents/Resources/app.asar | head -50

# Total asar size by directory
npx asar list dist/mac/YourApp.app/Contents/Resources/app.asar |
  awk -F/ '{print $2}' | sort | uniq -c | sort -rn
```

Common waste: `moment` (use `date-fns`), full `lodash` (use `lodash-es` + tree-shaking), full `aws-sdk` v2 (use modular v3).

## Technique 10 — Throttle / batch IPC

Each `webContents.send` round-trips. If you `send` 100 times per second, you'll see 5–10% CPU just on IPC overhead.

**Batch:**

```ts
let buffer: Update[] = [];
let scheduled = false;
function queueUpdate(u: Update) {
  buffer.push(u);
  if (!scheduled) {
    scheduled = true;
    setImmediate(() => {
      win.webContents.send('updates', buffer);
      buffer = []; scheduled = false;
    });
  }
}
```

## Technique 11 — Minimize main-process work per frame

Anything inside an `ipcMain.handle` runs in the main process and blocks every other IPC. Keep handlers fast (<10ms). Long handlers → push to utilityProcess.

## Technique 12 — Disable hardware acceleration only if needed

Some Linux GPUs are buggy. If you see rendering glitches:

```ts
app.disableHardwareAcceleration();
```

But: this hurts battery and animation smoothness. Only do it conditionally for known-bad GPUs.

## Memory profiling

```ts
// Print main-process memory periodically
setInterval(() => {
  const m = process.memoryUsage();
  log.info(`heap: ${(m.heapUsed/1e6).toFixed(1)}MB / ${(m.heapTotal/1e6).toFixed(1)}MB rss: ${(m.rss/1e6).toFixed(1)}MB`);
}, 60_000);
```

For renderer: open DevTools → Memory tab → Heap snapshot before and after a suspected leak. Diff retained objects.

## Diagnostic flags

```bash
# Detailed startup timing
electron --enable-logging --v=1 .

# Trace IPC
electron --inspect=9229 .            # then attach Chrome DevTools

# GPU process logs
electron --enable-logging=stderr --vmodule=*/gpu/*=1 .
```

## Honest perspective on "Electron is slow"

The 2026 Twitter pulse complains constantly: *Claude Desktop is slower than ChatGPT (native), Discord eats RAM, Craft uses 2GB vs Obsidian's 300MB*. The complaints are real, but **the reason is rarely Electron itself** — it's apps that:

1. Don't lazy-require.
2. Render 100k DOM nodes without virtualization.
3. Keep dead BrowserWindows around.
4. Run synchronous work in main.
5. Re-render the entire renderer tree on every state change.

VSCode is also Electron and performs well. Obsidian is Electron and uses 300 MB. The stack is not the bottleneck — discipline is.
