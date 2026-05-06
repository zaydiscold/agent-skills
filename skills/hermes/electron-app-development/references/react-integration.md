# React + Electron Patterns

React 19 in the renderer is the 2026 default. The patterns below address the gap between "React works in any browser" and "renderer is a special browser process with main-process state behind it."

## Contents

- [Cleanup IPC subscriptions in `useEffect`](#cleanup-ipc-subscriptions-in-useeffect)
- [Don't fetch in render — use `useEffect` or React 19's `use()`](#dont-fetch-in-render--use-useeffect-or-react-19s-use)
- [Multi-window: main is the source of truth](#multi-window-main-is-the-source-of-truth)
- [Window controls (custom title bar)](#window-controls-custom-title-bar)
- [Platform-specific UI](#platform-specific-ui)
- [File drops](#file-drops)
- [Notifications](#notifications)
- [Routing](#routing)
- [Persisted state across restarts](#persisted-state-across-restarts)
- [Performance](#performance)
- [Suspense + IPC](#suspense--ipc)

---

## Cleanup IPC subscriptions in `useEffect`

Forgetting cleanup is the single most common bug. Symptom: state updates fire multiple times after HMR, or after closing/reopening a window.

```tsx
useEffect(() => {
  const off = window.api.on('settings:changed', (s) => setSettings(s));
  return off;       // unsubscribes on unmount + on HMR
}, []);
```

Always return the unsubscribe function from `useEffect`. The preload `on()` helper from `ipc-patterns.md` returns this; if you used raw `ipcRenderer.on`, you must call `removeListener` manually.

## Don't fetch in render — use `useEffect` or React 19's `use()`

```tsx
// ❌ Bad — fires on every render
const todos = await window.api.invoke('db:query-todos', {});

// ✅ Good (classic)
const [todos, setTodos] = useState<Todo[]>([]);
useEffect(() => {
  window.api.invoke('db:query-todos', {}).then(setTodos);
}, []);

// ✅ Good (React 19 with Suspense)
const todosPromise = useMemo(() => window.api.invoke('db:query-todos', {}), []);
const todos = use(todosPromise);     // requires <Suspense> ancestor
```

## Multi-window: main is the source of truth

Don't use a renderer-local Zustand store for cross-window state. The main process owns it; each window subscribes.

```tsx
// renderer/stores/app-state.ts
import { create } from 'zustand';
import type { AppState } from '@shared/types';

export const useAppState = create<{
  state: AppState | null;
  setState: (s: AppState) => void;
}>((set) => ({ state: null, setState: (state) => set({ state }) }));

// renderer/main.tsx
window.api.invoke('state:get').then(useAppState.getState().setState);
window.api.on('state:changed', useAppState.getState().setState);
```

## Window controls (custom title bar)

If you use a frameless window with custom min/max/close buttons, expose them via IPC:

```ts
// shared/ipc.ts
'window:minimize': [[], void];
'window:toggle-maximize': [[], void];
'window:close': [[], void];

// renderer
<button onClick={() => window.api.invoke('window:minimize')}>—</button>
<button onClick={() => window.api.invoke('window:toggle-maximize')}>▢</button>
<button onClick={() => window.api.invoke('window:close')}>×</button>
```

Use CSS `-webkit-app-region: drag` for the draggable title-bar area, `no-drag` for buttons:

```css
.titlebar { -webkit-app-region: drag; }
.titlebar button { -webkit-app-region: no-drag; }
```

## Platform-specific UI

```ts
// shared/platform.ts (loaded by renderer via preload constants)
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,        // 'darwin' | 'win32' | 'linux'
  arch: process.arch,
});
```

Then in React:

```tsx
const isMac = window.platform.os === 'darwin';
return isMac ? <MacTitleBar /> : <WindowsTitleBar />;
```

## File drops

```tsx
function Dropzone() {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files).map((f) => f.path);
        // f.path is Electron-specific; main process needs the path, not the File object.
        await window.api.invoke('files:import', files);
      }}
    >
      Drop here
    </div>
  );
}
```

(`File.path` is non-standard but Electron exposes it for the renderer's drag-drop. Validate paths in main.)

## Notifications

Use the **web `Notification` API** in renderer — Electron maps it to native notifications on all platforms:

```tsx
function notify(title: string, body: string) {
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else {
    Notification.requestPermission().then(() => new Notification(title, { body }));
  }
}
```

For richer features (actions, persistent), use `Notification` from `electron` in main and send via IPC.

## Routing

`react-router` v7 with `MemoryRouter`:

```tsx
import { MemoryRouter, Routes, Route } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  </MemoryRouter>,
);
```

Avoid `BrowserRouter` — Electron's `file://` URLs don't have a real history backend.

## Persisted state across restarts

Renderer reads via IPC on mount; writes go through IPC. **Don't use `localStorage` for important state** — it's per-origin and tied to the renderer cache; can be cleared by users or by an Electron upgrade.

```tsx
// On mount: hydrate from main.
useEffect(() => {
  window.api.invoke('settings:get').then(setSettings);
}, []);

// On change: persist via main.
useEffect(() => {
  window.api.invoke('settings:set', settings);
}, [settings]);
```

## Performance

- Use **`react-window`** or **`react-virtualized`** for any list >500 items. Electron's renderer is Chromium but each window adds memory cost; avoid 100k DOM nodes.
- **Code-split routes**: each `import('./Settings')` becomes a chunk Vite splits automatically.
- **Avoid `useEffect` for derived state** — prefer `useMemo` or compute during render.
- For heavy work (image processing, search indexing), spawn a **utility process** via `MessageChannelMain` rather than blocking the renderer. See Electron's `utilityProcess` API.

## Suspense + IPC

React 19's `<Suspense>` works with Promises. You can write:

```tsx
function TodoList() {
  const todos = use(todosPromise);     // suspends until resolved
  return <ul>{todos.map(...)}</ul>;
}

<Suspense fallback={<Spinner />}>
  <TodoList />
</Suspense>
```

Cache the promise outside the component (or in a module-level Map keyed by query) to avoid re-fetching every render.
