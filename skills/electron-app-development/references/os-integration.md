# OS Integration: deep links, OAuth, file associations, secrets, drag-drop

The unglamorous but essential surface where your Electron app meets the user's operating system.

## Contents

- [1. Deep links / custom protocols](#1-deep-links--custom-protocols)
- [2. OAuth 2.0 with PKCE (the only correct way)](#2-oauth-20-with-pkce-the-only-correct-way)
- [3. Secrets storage with `safeStorage`](#3-secrets-storage-with-safestorage)
- [4. File associations](#4-file-associations)
- [5. Drag-and-drop into the app](#5-drag-and-drop-into-the-app)
- [6. Drag-and-drop OUT of the app (e.g., dragging a generated PDF to Finder)](#6-drag-and-drop-out-of-the-app-eg-dragging-a-generated-pdf-to-finder)
- [7. Native menus](#7-native-menus)
- [8. Global shortcuts](#8-global-shortcuts)
- [9. Notifications](#9-notifications)
- [10. Tray (with template-image macOS support)](#10-tray-with-template-image-macos-support)
- [11. Open external links safely](#11-open-external-links-safely)
- [12. Login items (start at boot)](#12-login-items-start-at-boot)

---

## 1. Deep links / custom protocols

### Registration

```ts
import { app } from 'electron';

if (process.defaultApp) {
  // dev: pass argv so the OS knows how to relaunch us
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('myapp', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('myapp');
}
```

Add to `electron-builder.yml` so the OS knows about it from the installer:

```yaml
mac:
  extendInfo:
    CFBundleURLTypes:
      - CFBundleURLName: MyApp
        CFBundleURLSchemes: [myapp]
protocols:
  - name: MyApp
    schemes: [myapp]
```

### Receive on launch / second-instance — three required handlers

**Always** install all three; each platform delivers the URL differently.

```ts
const got = app.requestSingleInstanceLock();
if (!got) { app.quit(); }

// Windows / Linux: deep link is in argv when the second instance launches.
app.on('second-instance', (_e, argv) => {
  focusMainWindow();
  const url = argv.find((a) => a.startsWith('myapp://'));
  if (url) handleDeepLink(url);
});

// macOS: 'open-url' event. NEVER arrives in argv on macOS.
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// First launch via deep link: parse argv at startup.
app.whenReady().then(() => {
  const initialUrl = process.argv.find((a) => a.startsWith('myapp://'));
  if (initialUrl) handleDeepLink(initialUrl);
});
```

### Validate the URL — treat it as untrusted input

```ts
function handleDeepLink(rawUrl: string) {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return; }
  if (url.protocol !== 'myapp:') return;
  // Validate path against an allow-list.
  const validPaths = new Set(['/auth/callback', '/open-project', '/share']);
  if (!validPaths.has(url.pathname)) return;
  // Now route into your app router…
}
```

Common attack: `myapp://auth/callback?token=...&redirect=javascript:alert(1)` — your route handler then opens the redirect via `shell.openExternal`. **Validate every parameter.**

## 2. OAuth 2.0 with PKCE (the only correct way)

Electron apps are "Public Client Native Applications" per RFC 8252. **Use PKCE, never embed a client secret.**

### Flow

```
User clicks "Sign in"
  → main process generates code_verifier + code_challenge (S256)
  → opens system browser via shell.openExternal(authorize_url)
      with code_challenge in the URL
  → user signs in, provider redirects to myapp://auth/callback?code=...
  → 'open-url' / 'second-instance' fires
  → main process exchanges code + code_verifier for tokens at /token endpoint
  → store refresh token via safeStorage; access token in memory
```

### Implementation

```ts
import crypto from 'node:crypto';
import { shell, safeStorage } from 'electron';

function pkce() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

async function login() {
  const { verifier, challenge } = pkce();
  const state = crypto.randomBytes(16).toString('base64url');
  pendingAuth = { verifier, state };           // remember in main-process memory

  const url = new URL('https://idp.example/authorize');
  url.searchParams.set('client_id', PUBLIC_CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', 'myapp://auth/callback');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'openid email offline_access');
  await shell.openExternal(url.toString());
}

// Called from handleDeepLink for /auth/callback
async function handleAuthCallback(url: URL) {
  if (url.searchParams.get('state') !== pendingAuth?.state) {
    throw new Error('CSRF: state mismatch');
  }
  const code = url.searchParams.get('code');
  if (!code) throw new Error('No code');

  const res = await net.fetch('https://idp.example/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: pendingAuth!.verifier,
      client_id: PUBLIC_CLIENT_ID,
      redirect_uri: 'myapp://auth/callback',
    }),
  });
  const { access_token, refresh_token, expires_in } = await res.json();
  // Encrypt + persist refresh_token. Keep access_token in memory only.
  saveRefreshToken(refresh_token);
  setAccessTokenInMemory(access_token, Date.now() + expires_in * 1000);
}
```

### What NOT to do

- ❌ Embed `client_secret` in the app — it's not secret if it ships in your bundle.
- ❌ Use a `BrowserWindow` to host the auth UI inside your app — phishing risk and many providers block it (Google, GitHub).
- ❌ Use `localhost` redirect with a random port — works but more fragile than custom protocol.
- ❌ Store refresh tokens in localStorage / `electron-store` plaintext.

## 3. Secrets storage with `safeStorage`

`safeStorage` (built-in since Electron 13) replaces `keytar` (archived/unmaintained). It uses Keychain on macOS, DPAPI on Windows, and Secret Service (gnome-libsecret/kwallet) on Linux.

```ts
import { safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

function tokenFile() { return path.join(app.getPath('userData'), 'token.bin'); }

function saveRefreshToken(token: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS keychain unavailable — refusing to store secret in plaintext');
  }
  const enc = safeStorage.encryptString(token);
  fs.writeFileSync(tokenFile(), enc);
}

function loadRefreshToken(): string | null {
  try {
    const enc = fs.readFileSync(tokenFile());
    return safeStorage.decryptString(enc);
  } catch {
    return null;
  }
}
```

### Gotchas

- `safeStorage` calls **must happen after `app.whenReady()`**. Calling earlier returns garbage on some platforms.
- On Linux, the user's keyring may be locked. Wrap calls in try/catch and fall back to "please sign in again."
- Encryption is bound to the user account — backups across machines won't decrypt. That's a feature.
- Don't migrate from keytar by reading both — copy keytar data once, write to safeStorage, delete keytar entry.

## 4. File associations

Make your app the default opener for `.foo` files.

`electron-builder.yml`:

```yaml
fileAssociations:
  - ext: foo
    name: FOO Document
    description: Foo document
    icon: build/foo-icon.icns
    role: Editor
mac:
  extendInfo:
    CFBundleDocumentTypes:
      - CFBundleTypeName: FOO Document
        CFBundleTypeRole: Editor
        LSItemContentTypes: [com.example.foo]
```

### Receive the open

```ts
// macOS
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  openInApp(filePath);
});

// Windows / Linux: file path arrives in argv
app.on('second-instance', (_e, argv) => {
  const file = argv.find((a) => a.endsWith('.foo'));
  if (file) openInApp(file);
});

// First-launch: parse argv
const initialFile = process.argv.find((a) => a.endsWith('.foo'));
if (initialFile) app.whenReady().then(() => openInApp(initialFile));
```

## 5. Drag-and-drop into the app

```tsx
function Dropzone() {
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
      onDrop={(e) => {
        e.preventDefault();
        // f.path is non-standard but Electron exposes it.
        // SECURITY: validate paths in main; never trust dropped paths blindly.
        const paths = Array.from(e.dataTransfer.files).map((f) => (f as any).path);
        window.api.invoke('files:import', paths);
      }}
    >
      Drop here
    </div>
  );
}
```

In Electron 32+, `File.path` was removed from the standard Web File API; use `webUtils.getPathForFile(file)` instead:

```ts
// preload
import { webUtils } from 'electron';
contextBridge.exposeInMainWorld('webUtils', { getPathForFile: webUtils.getPathForFile });

// renderer
const path = window.webUtils.getPathForFile(file);
```

## 6. Drag-and-drop OUT of the app (e.g., dragging a generated PDF to Finder)

```tsx
function startDrag(filePath: string) {
  window.api.invoke('drag:start', filePath);
}

// main
ipcMain.handle('drag:start', (event, filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: path.join(__dirname, 'assets/drag-icon.png'),
  });
});
```

## 7. Native menus

```ts
import { Menu } from 'electron';

const template: Electron.MenuItemConstructorOptions[] = [
  ...(process.platform === 'darwin' ? [{
    label: app.name,
    submenu: [
      { role: 'about' as const },
      { type: 'separator' as const },
      { role: 'services' as const },
      { type: 'separator' as const },
      { role: 'hide' as const },
      { role: 'hideOthers' as const },
      { role: 'unhide' as const },
      { type: 'separator' as const },
      { role: 'quit' as const },
    ],
  }] : []),
  {
    label: 'File',
    submenu: [
      { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => newFile() },
      { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
      { type: 'separator' },
      process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' },
    ],
  },
  // …
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
```

Use `role` whenever possible — Electron handles platform conventions (Edit → Cut/Copy/Paste/Undo/Redo) for free.

## 8. Global shortcuts

```ts
import { globalShortcut } from 'electron';

app.whenReady().then(() => {
  const ok = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    toggleQuickWindow();
  });
  if (!ok) log.warn('Global shortcut registration failed (may conflict with system)');
});

app.on('will-quit', () => globalShortcut.unregisterAll());
```

Don't bind common shortcuts (Cmd+Space, Cmd+Tab, Cmd+C/V). Let users customize via a settings UI.

## 9. Notifications

```tsx
// Renderer — use the standard Web Notification API; Electron maps to native.
function notify(title: string, body: string, onClick?: () => void) {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
    return;
  }
  const n = new Notification(title, { body, icon: '/assets/notif-icon.png' });
  if (onClick) n.onclick = onClick;
}
```

For richer notifications (actions, persistent, sound) use `Notification` from main:

```ts
import { Notification } from 'electron';
new Notification({
  title: 'Update ready',
  body: 'Click to install',
  actions: [{ type: 'button', text: 'Install' }],   // macOS/Windows only
}).on('action', (_e, idx) => idx === 0 && installUpdate()).show();
```

## 10. Tray (with template-image macOS support)

```ts
import { Tray, nativeImage, Menu } from 'electron';

const icon = nativeImage.createFromPath(path.join(__dirname, 'assets/trayTemplate.png'));
icon.setTemplateImage(true);          // macOS — auto-adapts to menu bar light/dark

tray = new Tray(icon);
tray.setToolTip('YourApp');
tray.setContextMenu(Menu.buildFromTemplate([
  { label: 'Open', click: showWindow },
  { label: 'Quit', role: 'quit' },
]));
```

Filename ending in `Template.png` plus `setTemplateImage(true)` is the convention.

## 11. Open external links safely

```ts
import { shell } from 'electron';

function safeOpen(url: string) {
  const u = new URL(url);
  if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return;
  shell.openExternal(url);
}

// Renderer link clicks → main → safeOpen.
mainWin.webContents.setWindowOpenHandler(({ url }) => {
  safeOpen(url);
  return { action: 'deny' };
});
```

## 12. Login items (start at boot)

```ts
app.setLoginItemSettings({
  openAtLogin: true,
  openAsHidden: true,           // start to tray
  args: ['--hidden'],
});
```

For Mac App Store apps, you must use `SMLoginItemSetEnabled` instead — different API; consult Apple docs.
