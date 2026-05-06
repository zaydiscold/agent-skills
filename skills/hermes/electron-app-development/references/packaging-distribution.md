# Packaging, Code Signing, Notarization, Auto-Update

The hardest part of shipping Electron is not building — it's **macOS code signing + notarization**. Plan a full first day.

## Contents

- [Choosing a packager: Forge vs electron-builder](#choosing-a-packager-forge-vs-electron-builder)
- [macOS: code signing + notarization](#macos-code-signing--notarization)
- [Windows: code signing](#windows-code-signing)
- [Linux](#linux)
- [macOS Universal Binary (arm64 + x64)](#macos-universal-binary-arm64--x64)
- [MSIX auto-updates (Electron 41+)](#msix-auto-updates-electron-41)
- [Auto-update](#auto-update)
- [Mac App Store / Microsoft Store](#mac-app-store--microsoft-store)
- [CI/CD (GitHub Actions sketch)](#cicd-github-actions-sketch)
- [Troubleshooting](#troubleshooting)

---

## Choosing a packager: Forge vs electron-builder

| Concern | Electron Forge (official) | electron-builder (community) |
|---------|---------------------------|------------------------------|
| Maintained by | Electron core team | Community (well-maintained) |
| Out-of-box DX | Templates, integrated CLI | Single YAML config |
| Auto-update lib | `update.electronjs.org` (free Electron service) or `electron-updater` | `electron-updater` (best-in-class) |
| Linux support | Yes | Yes — including AppImage staged rollouts |
| Recommended for | New projects, simple deploys | Apps that need staged rollouts, custom update channels, GitHub Releases |

**Default recommendation in 2026:** Forge for prototypes and v1, switch to electron-builder if you need staged rollouts or non-GitHub distribution.

## macOS: code signing + notarization

### Prerequisites

1. Apple Developer Program membership ($99/yr).
2. **Developer ID Application** certificate (NOT "Mac App Store" cert unless you're going through MAS).
3. `entitlements.mac.plist` — minimum:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
   <plist version="1.0">
   <dict>
     <key>com.apple.security.cs.allow-jit</key><true/>
     <key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
     <key>com.apple.security.cs.disable-library-validation</key><true/>
     <key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
   </dict>
   </plist>
   ```
   Add capabilities (camera, mic, USB) only if you actually use them — App Sandbox prefers minimum.
4. App-specific password from appleid.apple.com (for `xcrun notarytool`).

### Forge config (forge.config.cjs)

```js
const { MakerSquirrel } = require('@electron-forge/maker-squirrel');
const { MakerDMG } = require('@electron-forge/maker-dmg');
const { MakerDeb } = require('@electron-forge/maker-deb');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './build/icon',                 // .icns on mac, .ico on win
    osxSign: {
      identity: 'Developer ID Application: Your Name (TEAMID)',
      'hardened-runtime': true,
      entitlements: 'build/entitlements.mac.plist',
      'entitlements-inherit': 'build/entitlements.mac.plist',
      'gatekeeper-assess': false,
    },
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    },
  },
  makers: [
    new MakerSquirrel({
      certificateFile: process.env.WINDOWS_CERT_FILE,
      certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
    }),
    new MakerDMG({}),
    new MakerDeb({}),
  ],
  publishers: [/* GitHub Releases, S3, etc. */],
};
```

### electron-builder config (electron-builder.yml)

```yaml
appId: com.yourorg.yourapp
productName: YourApp
directories: { output: dist }
files:
  - out/**/*
  - package.json
asar: true
mac:
  category: public.app-category.productivity
  icon: build/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize: false                          # we'll use @electron/notarize via afterSign
afterSign: build/notarize.js
win:
  target: [{ target: nsis, arch: [x64, arm64] }]
  icon: build/icon.ico
  signtoolOptions:
    signingHashAlgorithms: [sha256]
    signtoolPath: # optional: path to your signtool.exe
linux:
  target: [AppImage, deb, rpm]
  icon: build/icon.png
publish:
  provider: github
  releaseType: release
```

```js
// build/notarize.js
const { notarize } = require('@electron/notarize');
exports.default = async function ({ appOutDir, packager, electronPlatformName }) {
  if (electronPlatformName !== 'darwin') return;
  await notarize({
    tool: 'notarytool',
    appPath: `${appOutDir}/${packager.appInfo.productFilename}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

### Verify signing locally

```bash
# Verify code signature
codesign --verify --deep --strict --verbose=2 "dist/mac/YourApp.app"

# Verify notarization stapled
xcrun stapler validate "dist/mac/YourApp.app"

# Gatekeeper assessment (what the user will see)
spctl --assess --verbose "dist/mac/YourApp.app"
```

If `spctl` says "rejected", you didn't notarize correctly.

## Windows: code signing

### Options (in order of preference, 2026)

1. **EV Code Signing certificate** — instant SmartScreen reputation, ~$200–400/yr. Required for kernel drivers; nice-to-have for apps.
2. **Standard Code Signing certificate** — cheaper but builds reputation slowly; SmartScreen will warn for the first weeks.
3. **Azure Trusted Signing** (Microsoft, 2024+) — pay-per-sign, no hardware token. Increasingly popular.

### Steps

1. Get the cert as a `.pfx` (or use HSM/Azure Trusted Signing).
2. Set environment vars: `WINDOWS_CERT_FILE`, `WINDOWS_CERT_PASSWORD`.
3. Sign the installer AND the app `.exe` inside it (Forge/builder do both).
4. Time-stamp every signature: `/tr http://timestamp.digicert.com /td sha256`.

### NSIS vs Squirrel.Windows

- **NSIS (electron-builder default)**: per-machine or per-user, modern, supports custom UI.
- **Squirrel.Windows (Forge default)**: per-user, app gets installed to `%LOCALAPPDATA%`, auto-update built-in. **Quirk**: handles `--squirrel-firstrun` flag. Skip update check on first run.

## Linux

Targets: AppImage (universal), deb (Debian/Ubuntu), rpm (Fedora), snap, flatpak. For most apps: AppImage + deb covers ~90% of users.

No signing requirement — but desktop integration (`.desktop` file, icon themes) matters. Both packagers handle this.

## macOS Universal Binary (arm64 + x64)

Two approaches:

### Forge / electron-builder native support

```yaml
# electron-builder.yml
mac:
  target:
    - target: dmg
      arch: [universal]      # or ['x64', 'arm64'] for separate DMGs
```

Forge: `--arch=universal` flag.

The packagers internally use `@electron/universal` to lipo two separate builds together.

### Manual via `@electron/universal`

When you need full control (e.g., custom native modules):

```ts
import { makeUniversalApp } from '@electron/universal';

await makeUniversalApp({
  x64AppPath: 'dist/mac/YourApp.app',
  arm64AppPath: 'dist/mac-arm64/YourApp.app',
  outAppPath: 'dist/mac-universal/YourApp.app',
  // For native .node files that differ per arch — keep both:
  x64ArchFiles: '**/*.node',
  mergeASARs: true,            // combine x64 + arm64 asar into one
  singleArchFiles: '**/some-arch-only-binary',  // skip lipo; ship as-is
});
```

**Pitfalls:**

- Native modules (sharp, better-sqlite3) ship per-arch `.node` files — they don't lipo. You must let both copies live side-by-side, and Electron picks the right one by arch at runtime.
- Code signing must happen AFTER universal merge, not before.
- Notarization tested per-arch (Apple's `notarytool` validates the universal binary).
- File size: universal apps are ~1.8× the size of single-arch (not 2× because lipo dedupes shared resources).

## MSIX auto-updates (Electron 41+)

New in Electron 41: MSIX auto-updater speaks the same JSON format as Squirrel.Mac. This unlocks publishing to Microsoft Store + side-loaded MSIX from your own server with one update channel.

```ts
import { autoUpdater } from 'electron';
autoUpdater.setFeedURL({ url: 'https://your-update-server/win-msix' });
autoUpdater.checkForUpdates();
```

Update payload at the URL is JSON shaped like Squirrel.Mac's:

```json
{
  "url": "https://your-cdn/YourApp-1.4.0.msix",
  "name": "1.4.0",
  "notes": "Bug fixes",
  "pub_date": "2026-05-05T00:00:00Z"
}
```

This is the cleanest way to ship MSIX without going through the Store. Note: still requires code-signed MSIX with valid trust chain or sideloading is blocked.

## Auto-update

### Decision tree

| Need | Use |
|------|-----|
| Free, GitHub Releases-based, simple | **`update.electronjs.org`** (Forge) |
| Staged rollouts, progress events, Linux support, custom server | **`electron-updater`** (electron-builder) |
| Mac App Store / Microsoft Store distribution | The store handles it — disable in-app updater |

### electron-updater integration

```ts
// src/main/auto-update.ts
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { app, BrowserWindow, dialog } from 'electron';

autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

export function initAutoUpdate(win: BrowserWindow) {
  // Skip in dev and on Squirrel first run.
  if (!app.isPackaged) return;
  if (process.argv.includes('--squirrel-firstrun')) return;

  autoUpdater.on('update-available', (info) =>
    win.webContents.send('update:available', info));
  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      message: `Version ${info.version} ready to install.`,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  autoUpdater.on('error', (err) => log.error('autoUpdate error', err));

  // Initial check + every 4 hours.
  autoUpdater.checkForUpdatesAndNotify();
  setInterval(() => autoUpdater.checkForUpdatesAndNotify(), 4 * 60 * 60 * 1000);
}
```

### Staged rollouts

In your `latest.yml` (electron-builder):

```yaml
version: 1.4.0
files: [...]
stagingPercentage: 10   # 10% of users get this update first
releaseDate: 2026-05-05T17:00:00.000Z
```

Bump `stagingPercentage` over a few days. Watch crash reports.

### Update channel signing

`electron-updater` verifies the new version's code signature on macOS/Windows before launching it. **Do not** disable this. On Linux (AppImage), there's no OS-level signature check, so HTTPS + integrity hash in `latest-linux.yml` is your only defense.

## Mac App Store / Microsoft Store

### Mac App Store
- Different cert: "Mac App Store" Distribution + Installer.
- Stricter sandbox — most filesystem capabilities require entitlements.
- No `electron-updater`; the store handles it.
- Forge has `MakerPKG`; electron-builder has `mas` target.

### Microsoft Store
- MSIX packaging. electron-builder has `appx` target; Forge supports via `electron-windows-store`.
- Avoid the store if you need `electron-updater` — they conflict.

## CI/CD (GitHub Actions sketch)

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']
jobs:
  build:
    strategy:
      matrix:
        os: [macos-14, windows-latest, ubuntu-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Import macOS cert
        if: matrix.os == 'macos-14'
        env:
          CERT_BASE64: ${{ secrets.MAC_CERT_P12 }}
          CERT_PASSWORD: ${{ secrets.MAC_CERT_PASSWORD }}
        run: |
          echo "$CERT_BASE64" | base64 --decode > cert.p12
          security create-keychain -p "" build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p "" build.keychain
          security import cert.p12 -k build.keychain -P "$CERT_PASSWORD" -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple: -s -k "" build.keychain
      - name: Build & publish
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          WINDOWS_CERT_FILE: ./win-cert.pfx
          WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npm run release
```

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Code signing identity not found` | Cert not in keychain or wrong name | `security find-identity -v -p codesigning` |
| `notarytool exited with status 1` (no detail) | Use `xcrun notarytool log <submission-id>` | Read the JSON; usually a hardened-runtime issue or unsigned helper |
| Helper apps unsigned (`Electron Helper.app`, `Electron Helper (GPU).app`) | Forge/builder didn't traverse | Set `osxSign.deep: true` (Forge) or `signIgnore: false` (builder) |
| `quarantine` flag remains after install | Notarization not stapled | Run `xcrun stapler staple` on the .app/.dmg |
| Windows SmartScreen warning persists | Standard cert needs reputation building | Switch to EV cert or wait 1–4 weeks of installs |
| Auto-update silently fails | URL incorrect in `app-update.yml` | Verify `dev-app-update.yml` for testing, ensure `publish.provider` matches |
| `NODE_MODULE_VERSION mismatch` after build | Native module not rebuilt for Electron's Node | `npx electron-builder install-app-deps` or `electron-rebuild` |
| First-run app crashes on Windows | Squirrel firstrun update check | Skip update check when `--squirrel-firstrun` in argv |
