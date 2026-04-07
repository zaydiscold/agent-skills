# Discipline 5: Client-Side Security

## YES WE DO THIS

Client-side analysis isn't just for iOS security. **Use it for everything:**
- Understanding how that desktop app works
- Finding hidden features in tools you use
- Debugging Electron apps
- Understanding native Node modules
- Learning app architecture patterns

**Every app is a black box to open.** Open it.

---

## When to Use

- Analyzing macOS/iOS apps
- Testing Electron applications
- Understanding native modules
- Finding client-side vulnerabilities
- Extracting secrets from binaries

**Also use for:** Understanding how your tools work, debugging app issues, learning Swift/Obj-C, finding undocumented features.

---

## Tools Required

**Static Analysis:**
- otool (macOS binary analysis)
- codesign (signature verification)
- strings (string extraction)
- nm (symbol table)
- Ghidra/radare2 (disassembly)

**Dynamic Analysis:**
- Frida (dynamic instrumentation)
- lldb (debugging)
- objection (iOS runtime exploration)
- dtruss/dtrace (system call tracing)

**Forensics:**
- SQLite tools
- PlistBuddy (macOS preferences)
- Keychain analysis tools

---

## Step-by-Step Procedure

### Phase 1: Static Analysis (1-3 hours)

**1. Entitlements Analysis (macOS)**

```bash
# Extract entitlements
codesign -d --entitlements - /Applications/Target.app

# Look for:
# - com.apple.security.network.client (network access)
# - com.apple.security.temporary-exception (sandbox bypass)
# - keychain-access-groups (keychain scope)
# - com.apple.developer.team-identifier
```

**2. Code Signing Verification**

```bash
# Full signature info
codesign -dvv /Applications/Target.app

# Look for:
# - Authority (developer ID, App Store, ad-hoc)
# - Timestamp
# - Sealed resources (tamper detection)
```

**3. Dynamic Dependencies**

```bash
# Linked libraries
otool -L /Applications/Target.app/Contents/MacOS/Target

# Check for:
# - Unusual libraries
# - Outdated versions
# - Custom frameworks
```

**4. String Analysis**

```bash
# Extract strings
strings -a /Applications/Target.app/Contents/MacOS/Target | \
  grep -iE "(api|key|token|secret|password|http)"

# Swift-specific
strings -a Target.app | grep -E "^\[.*\]" | head -50
```

**5. Class Dump (if Obj-C/Swift)**

```bash
# Obj-C class dump via strings
strings Target.app | grep -E "\[.*\s.*\]" | sort -u

# Swift metadata
strings Target.app | grep -E "^\$s.*" | head -20
```

### Phase 2: Bundle Analysis (30 min - 1 hour)

**1. App Structure**

```bash
# Explore bundle
ls -la /Applications/Target.app/Contents/
cat /Applications/Target.app/Contents/Info.plist

# Resources
ls -la /Applications/Target.app/Contents/Resources/

# Frameworks
ls -la /Applications/Target.app/Contents/Frameworks/
```

**2. Configuration Files**

```bash
# Plist analysis
PlistBuddy -c Print /Applications/Target.app/Contents/Info.plist

# Embedded provisioning profile
cat /Applications/Target.app/Contents/embedded.provisionprofile 2>/dev/null | strings

# Check for config files
find /Applications/Target.app -name "*.json" -o -name "*.xml" -o -name "*.plist"
```

**3. Resource Analysis**

```bash
# JS/HTML in resources (Electron apps)
find /Applications/Target.app -name "*.js" -o -name "*.html"

# Extract ASAR if Electron
npx asar extract /Applications/Target.app/Contents/Resources/app.asar /tmp/electron-source
```

### Phase 3: Dynamic Analysis (2-6 hours)

**1. Runtime Inspection with Frida**

```bash
# Attach to running app
frida -n "Target" -l inspect.js

# JavaScript for Frida
Interceptor.attach(Module.findExportByName(null, "CCCrypt"), {
    onEnter: function(args) {
        console.log("Crypto operation detected");
        console.log("Key:", hexdump(args[2]));
    }
});
```

**2. File System Monitoring**

```bash
# Monitor file access
sudo fs_usage -w | grep Target | tee filesystem-activity.log

# Look for:
# - Config file locations
# - Cache directories
# - SQLite databases
# - Log files
```

**3. Network Monitoring**

```bash
# Network connections
sudo nettop -P -d | grep Target

# Or with dtrace
dtrace -n 'syscall::connect*:entry { printf("%s %s", execname, copyinstr(arg1)); }'
```

**4. Debugging with lldb**

```bash
# Attach
lldb -p $(pgrep Target)

# Breakpoints
(lldb) breakpoint set --name "[TargetClass sensitiveMethod]"
(lldb) breakpoint set --regex "password|token|secret"

# Examine
(lldb) register read
(lldb) memory read $rsi
(lldb) po $rdi  # Print Obj-C object
```

### Phase 4: Data Forensics (1-2 hours)

**1. Preferences & Settings**

```bash
# User defaults
defaults read com.company.Target

# Look for:
# - Session tokens
# - Cached credentials
# - Feature flags
# - User identifiers
```

**2. Cache Analysis**

```bash
# Common cache locations
~/Library/Caches/com.company.Target/
~/Library/Application\ Support/Target/

# SQLite databases
find ~/Library -name "*.db" -o -name "*.sqlite" | xargs ls -la
```

**3. Keychain Analysis**

```bash
# Dump keychain (requires auth)
security dump-keychain | grep -A5 -B5 Target

# Or specific queries
security find-generic-password -s "Target" -g 2>&1
```

**4. Log Analysis**

```bash
# Unified logs
log show --predicate 'process == "Target"' --last 1h

# Console app logs
ls ~/Library/Logs/DiagnosticReports/ | grep Target
```

### Phase 5: Binary Patching (Advanced)

**1. Anti-Analysis Bypass**

```bash
# Patch debugger detection
# Find: if (ptrace(PTRACE_TRACEME, 0, 0, 0) == -1)
# Patch: NOP out the check
```

**2. Function Hooking**

```bash
# DYLD_INSERT_LIBRARIES
DYLD_INSERT_LIBRARIES=/path/to/hook.dylib /Applications/Target.app/Contents/MacOS/Target
```

**3. Entitlement Modification**

For research only (breaks signature):
```bash
# Remove sandbox restrictions
# Edit: Target.app/Contents/Resources/entitlements.plist
# Then: codesign --entitlements entitlements.plist -f -s - Target.app
```

---

## Electron-Specific Analysis

**1. ASAR Extraction**

```bash
# Extract source
cd /Applications/Target.app/Contents/Resources/
npx asar extract app.asar source/

# Now you have full JS source
```

**2. Main Process vs Renderer**

- Main process: Node.js environment (more access)
- Renderer: Chromium sandbox
- IPC between them: potential attack surface

**3. Native Module Analysis**

```bash
# .node files are dylibs
file app/node_modules/*/build/Release/*.node
otool -L app/node_modules/*/build/Release/*.node
```

**4. Update Mechanism**

```bash
# Check update server
# Look for: electron-updater, autoUpdater
# Potential: MITM update, downgrade attacks
```

---

## Expected Outputs

1. **entitlements-analysis.md** — Full entitlements, security implications
2. **runtime-behavior.md** — File system, network, process activity
3. **secrets-found.md** — Hardcoded keys, tokens, credentials
4. **forensics.md** — Cache, preferences, keychain contents
5. **vulnerabilities.md** — Client-side security issues

---

## Subagent Delegation

```python
delegate_task(tasks=[
    {
        "goal": "Static binary analysis",
        "context": "Target: /Applications/Target.app. Extract: entitlements, strings, symbols, dependencies. Output to static-analysis.md"
    },
    {
        "goal": "Bundle resource analysis",
        "context": "Explore app bundle. Find: config files, embedded resources, Electron ASAR content, JS source. Output to bundle-analysis.md"
    },
    {
        "goal": "Forensic data collection",
        "context": "Find: preferences, caches, SQLite databases, keychain items, logs. Document locations and contents. Output to forensics-report.md"
    }
])

# You focus on:
# - Dynamic analysis with Frida
# - Runtime debugging
# - Binary patching experiments
```

---

## Pitfalls

**1. Code Signing**
- Modified apps won't run without re-signing
- Use: `codesign --force --deep --sign - Target.app`
- Or: Disable Gatekeeper (research machines only)

**2. SIP (System Integrity Protection)**
- Can't debug system binaries easily
- Some paths are protected
- Use VM for deep system analysis

**3. Sandboxing**
- Apps may have limited file system access
- Network restrictions
- Inter-process restrictions

**4. Anti-Analysis**
- Debugger detection
- Timing checks
- Code obfuscation

---

## Verification

- [ ] All entitlements documented
- [ ] Hardcoded secrets extracted
- [ ] Runtime behavior mapped
- [ ] Cache/forensics analyzed
- [ ] At least one dynamic hook demonstrated
- [ ] Everything documented
- [ ] Added technique to library/what-worked.md

---

## Continuous Learning

**Add to library when you:**
- Bypass new anti-analysis technique
- Find novel secret extraction method
- Discover new entitlement bypass
- Reverse interesting protocol

---

## Daily Use

**Use client-side analysis for:**
- Understanding how your tools work
- Debugging desktop app issues
- Finding config options
- Learning app architecture

**Example:** That Electron app is slow. Analyze it to find the bottleneck.

YES WE DO THIS. Every app is a learning opportunity.
