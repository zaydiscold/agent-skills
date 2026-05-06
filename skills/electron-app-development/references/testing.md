# Testing Electron Apps

Three layers: unit (Vitest), integration (Vitest with mocked Electron), end-to-end (Playwright).

## Contents

- [Unit tests with Vitest](#unit-tests-with-vitest)
- [E2E tests with Playwright](#e2e-tests-with-playwright)
- [Testing IPC handlers without booting Electron](#testing-ipc-handlers-without-booting-electron)
- [Snapshot the secure config](#snapshot-the-secure-config)
- [Crash & log testing](#crash--log-testing)
- [Performance tests](#performance-tests)
- [CI matrix](#ci-matrix)

---

## Unit tests with Vitest

```ts
// src/main/utils/path-allow-list.test.ts
import { describe, it, expect } from 'vitest';
import { isPathAllowed } from './path-allow-list';

describe('isPathAllowed', () => {
  it('rejects path traversal', () => {
    expect(isPathAllowed('/Users/me/../../etc/passwd')).toBe(false);
  });
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',                      // for main-process code
    coverage: { provider: 'v8' },
  },
});
```

For renderer code, use `environment: 'jsdom'` and mock `window.api`:

```ts
// src/renderer/test-setup.ts
import { vi } from 'vitest';
(globalThis as any).window.api = {
  invoke: vi.fn(),
  on: vi.fn(() => () => {}),
};
```

## E2E tests with Playwright

`@playwright/test` has first-class Electron support via `electron.launch()`.

```ts
// e2e/app.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';

test('app launches and shows main window', async () => {
  const app = await electron.launch({
    args: [path.join(__dirname, '..', 'out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test' },
  });
  const win = await app.firstWindow();
  await expect(win).toHaveTitle(/YourApp/);

  // Click a button rendered by React.
  await win.getByRole('button', { name: 'New' }).click();
  await expect(win.getByText('Untitled')).toBeVisible();

  await app.close();
});
```

Run against the **packaged build**, not dev-mode — bugs around preload paths, asar, and code signing only show up against the real artifact.

```bash
npm run build
npx playwright test
```

## Testing IPC handlers without booting Electron

Refactor each handler into a pure function and test it directly:

```ts
// src/main/ipc/db.ts
export async function queryTodosHandler(deps: { db: DB }, filter: TodoFilter) {
  return deps.db.todos.find(filter);
}

ipcMain.handle('db:query-todos', (_e, filter) =>
  queryTodosHandler({ db }, filter));
```

```ts
// src/main/ipc/db.test.ts
import { queryTodosHandler } from './db';
const fakeDb = { todos: { find: () => [{ id: '1', title: 'a', done: false }] } };
expect(await queryTodosHandler({ db: fakeDb }, {})).toHaveLength(1);
```

This is faster than spinning up Electron and lets you test edge cases.

## Snapshot the secure config

A regression test that fails if anyone touches `webPreferences`:

```ts
import { describe, it, expect } from 'vitest';
import { createMainWindow } from './window';

describe('createMainWindow security', () => {
  it('uses hardened webPreferences', () => {
    // Mock BrowserWindow to capture the config.
    const captured: any = {};
    vi.mock('electron', () => ({
      BrowserWindow: class { constructor(opts: any) { Object.assign(captured, opts); } },
      // ...
    }));
    createMainWindow();
    expect(captured.webPreferences).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    });
  });
});
```

## Crash & log testing

- Wire `electron-log` early; assert log file exists in CI.
- Use Sentry's Electron SDK for production crash reports — it captures both main-process and renderer crashes, plus uploads native minidumps.

## Performance tests

- Boot time: launch the packaged app, measure `did-finish-load` event time. Target <2s on a 2020-era laptop.
- Memory: run for 10 minutes with a synthetic workload; `process.memoryUsage()` should plateau, not grow linearly.

## CI matrix

Test against Electron's two latest stable majors at minimum (e.g., 40 and 41) — Electron deprecates rapidly.

```yaml
strategy:
  matrix:
    electron: ['40.x', '41.x']
    os: [macos-14, windows-latest, ubuntu-latest]
```
