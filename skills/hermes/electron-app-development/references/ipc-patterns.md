# Electron IPC Patterns (Type-Safe, 2026)

The default for new code: **`ipcRenderer.invoke` + `ipcMain.handle`** with end-to-end TypeScript types and a single source-of-truth channel map.

## Contents

- [Why not `send`/`on`?](#why-not-sendon)
- [The pattern: typed channel map](#the-pattern-typed-channel-map)
- [Security: validate the caller](#security-validate-the-caller)
- [Push / streaming updates (main → renderer)](#push--streaming-updates-main--renderer)
- [Anti-patterns to refuse](#anti-patterns-to-refuse)
- [Error handling contract](#error-handling-contract)
- [Mature alternatives (when to reach for them)](#mature-alternatives-when-to-reach-for-them)
- [Multi-window state](#multi-window-state)

---

## Why not `send`/`on`?

| Concern | `send`/`on` | `invoke`/`handle` |
|---------|-------------|-------------------|
| Return value | Manual `reply` channel + correlation ID | Built-in Promise |
| Errors | Silent — no rejection contract | Rejects the Promise |
| Type safety | Hard — async correlation defeats inference | Easy — single function signature |
| Use case | Fire-and-forget broadcast (`mainWindow.webContents.send`) | Everything else |

Use `send` only for *push* updates from main → renderer (e.g., "settings changed", "external file event").

## The pattern: typed channel map

### Step 1 — Define channels in a shared package

```ts
// src/shared/ipc.ts  (imported by main, preload, AND renderer)

export type IpcChannels = {
  // request channel  →  [args, returnType]
  'app:get-version': [[], string];
  'app:open-path': [[path: string], void];
  'db:query-todos': [[filter: { done?: boolean }], Todo[]];
  'db:save-todo': [[todo: Todo], { id: string }];
  'window:minimize': [[], void];
};

export type IpcChannel = keyof IpcChannels;
export type IpcArgs<C extends IpcChannel> = IpcChannels[C][0];
export type IpcReturn<C extends IpcChannel> = IpcChannels[C][1];
```

### Step 2 — Main process registers handlers with type checking

```ts
// src/main/ipc.ts
import { ipcMain } from 'electron';
import type { IpcChannel, IpcArgs, IpcReturn } from '../shared/ipc';

function handle<C extends IpcChannel>(
  channel: C,
  fn: (...args: IpcArgs<C>) => IpcReturn<C> | Promise<IpcReturn<C>>,
) {
  ipcMain.handle(channel, async (_event, ...args) => {
    // Validate sender — see Security: caller-frame check below.
    return fn(...(args as IpcArgs<C>));
  });
}

handle('app:get-version', () => app.getVersion());
handle('app:open-path', async (p) => {
  if (!isPathAllowed(p)) throw new Error('forbidden');
  await shell.openPath(p);
});
handle('db:query-todos', (filter) => db.todos.find(filter));
```

### Step 3 — Preload exposes a typed wrapper, NOT raw ipcRenderer

```ts
// src/preload/index.ts  (CommonJS — preload runs in a special context)
import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, IpcArgs, IpcReturn } from '../shared/ipc';

const api = {
  invoke<C extends IpcChannel>(channel: C, ...args: IpcArgs<C>): Promise<IpcReturn<C>> {
    return ipcRenderer.invoke(channel, ...args);
  },
  on(channel: string, listener: (...args: any[]) => void) {
    const wrapped = (_e: unknown, ...a: any[]) => listener(...a);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type PreloadApi = typeof api;
```

### Step 4 — Renderer uses the typed `window.api`

```ts
// src/renderer/types.d.ts
import type { PreloadApi } from '../preload';
declare global { interface Window { api: PreloadApi } }
export {};
```

```tsx
// src/renderer/Todos.tsx
import { useEffect, useState } from 'react';
import type { Todo } from '../shared/types';

export function Todos() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    window.api.invoke('db:query-todos', { done: false }).then(setTodos);
  }, []);

  return <ul>{todos.map((t) => <li key={t.id}>{t.title}</li>)}</ul>;
}
```

Now renaming a handler in main breaks the channel string in *every* call site at compile time.

## Security: validate the caller

Any handler that touches the filesystem, shell, or sensitive data MUST verify the sender frame:

```ts
ipcMain.handle('app:open-path', async (event, path: string) => {
  const url = event.senderFrame?.url ?? '';
  if (!url.startsWith('file://') && !url.startsWith('https://your-prod-host')) {
    throw new Error('IPC denied: untrusted frame');
  }
  // ... allow-list path check ...
});
```

Why: a successful XSS in your renderer can call `window.api.invoke(...)`. The frame URL check at minimum prevents an attached `<webview>` or sub-frame from invoking sensitive channels.

## Push / streaming updates (main → renderer)

For one-way events from main:

```ts
// main
mainWindow.webContents.send('settings:changed', newSettings);

// preload
on(channel: 'settings:changed', listener: (s: Settings) => void) { /* … */ }

// renderer
useEffect(() => {
  const off = window.api.on('settings:changed', (s) => setSettings(s));
  return off;  // CRITICAL: cleanup. Otherwise listeners leak across HMR.
}, []);
```

## Anti-patterns to refuse

| Anti-pattern | Why it's bad |
|--------------|-------------|
| `contextBridge.exposeInMainWorld('ipcRenderer', ipcRenderer)` | Exposes every channel — XSS = full main-process API access |
| `nodeIntegration: true` so renderer can `require('fs')` | Single XSS = full RCE |
| `ipcMain.on('do-x', (e, args) => { e.reply('did-x', work(args)) })` | Hand-rolled correlation; use `handle` instead |
| String-based channel names with no shared types | Refactor breaks silently across processes |
| Throwing strings instead of `Error` from handlers | Loses stack; renderer sees `[object Object]` |
| Long-running handlers without progress | Use `send` for progress; or expose a separate `…:cancel` channel |

## Error handling contract

```ts
// main
handle('db:save-todo', async (todo) => {
  try {
    return await db.todos.insert(todo);
  } catch (err) {
    // Re-throw an Error — Electron serializes name + message + stack.
    throw new Error(`SaveFailed: ${(err as Error).message}`);
  }
});

// renderer
try {
  await window.api.invoke('db:save-todo', todo);
} catch (err) {
  // err is an Error instance with .message and .stack.
}
```

## Mature alternatives (when to reach for them)

- **`interprocess`** — community library that auto-generates typed bindings. Worth it if you have 50+ channels.
- **`electron-trpc`** — tRPC over IPC. Excellent DX if your team already knows tRPC.
- **`@electron-toolkit/preload`** — official-ish helpers.

For most apps, the hand-rolled typed pattern above is enough and has zero runtime overhead.

## Multi-window state

The **main process is the source of truth** for state shared across windows. Do not try to keep two renderer Zustand stores in sync via IPC — that path leads to race conditions.

```ts
// main: a small mutable store + broadcast
let appState: AppState = loadFromDisk();
function setState(patch: Partial<AppState>) {
  appState = { ...appState, ...patch };
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('state:changed', appState);
  }
  saveToDisk(appState);
}

handle('state:get', () => appState);
handle('state:set', (patch) => setState(patch));
```

Renderer subscribes to `state:changed` once per window.
