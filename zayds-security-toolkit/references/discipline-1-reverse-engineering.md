# Discipline 1: Reverse Engineering

## YES WE DO THIS

Reverse engineering isn't just for malware. **Use it for everything:**
- Understanding how that black-box library actually works
- Intercepting that app's API calls to learn the protocol
- Finding hidden features in tools you use daily
- Learning from well-engineered binaries

**Every binary is a textbook.** Read it.

---

## When to Use

- Analyzing proprietary software, mobile apps, firmware
- Understanding undocumented APIs or protocols
- Finding vulnerabilities in native code
- Bypassing client-side protections
- Learning from production-grade implementations

**Also use for:** Understanding how your dependencies work, learning optimization techniques, finding undocumented features in tools you use.

---

## Tools Required

**Core:**
- Ghidra (free, powerful) or IDA (if available)
- radare2 / Cutter (command line, scriptable)
- otool (macOS-specific analysis)
- nm, strings, objdump

**Dynamic:**
- Frida (dynamic instrumentation)
- lldb / gdb (debugging)
- dtruss / dtrace (system call tracing)

**Specialized:**
- apktool (Android)
- jadx (Android decompilation)
- 010 Editor (hex/binary analysis)
- Wireshark (protocol analysis)

---

## Step-by-Step Procedure

### Phase 1: Reconnaissance (15-30 min)

**1. File Identification**
```bash
file target-binary
md5sum target-binary
sha256sum target-binary
ls -la target-binary
```

**2. Strings Extraction**
```bash
strings -a target-binary > strings.txt
grep -iE "(password|secret|key|token|api|http|https)" strings.txt
```

Look for:
- Hardcoded credentials
- API endpoints
- Debug messages revealing internal structure
- Error messages showing logic paths
- Configuration keys

**3. Symbol Analysis**
```bash
nm target-binary                    # List symbols
nm -C target-binary                 # Demangle C++
grep -iE "(crypt|hash|auth|login)" symbols.txt
```

**4. Dependencies**
```bash
# macOS
otool -L target-binary              # Dynamic libraries

# Linux
ldd target-binary                   # Dynamic dependencies
readelf -d target-binary | grep NEEDED
```

**5. Entropy Check (packed/encrypted?)**
```bash
ent target-binary                   # High entropy = likely packed
```

### Phase 2: Static Analysis (1-4 hours)

**1. Ghidra Import**
- File → Import File → Select binary
- Language: Usually auto-detected (x86:LE:64:default for Intel Macs, x86:LE:64:default for most Linux)
- Options: Default are fine
- Analyze → Yes (let it run)

**2. Initial Navigation**
- Window → Functions (see all functions)
- Search → For Strings (find interesting strings)
- Window → Memory Map (see sections)

**3. Key Function Identification**

Search for these patterns:
```
Cryptographic: AES, DES, RSA, SHA, MD5, HMAC constants
Network: connect, send, recv, socket, curl, AF_INET
File: open, read, write, mmap
Auth: login, auth, token, password, credential
Process: exec, system, popen, fork
```

**4. Decompilation Reading**

Read pseudo-C and map to actual functionality:
- Identify main logic flow
- Find crypto implementations
- Locate network communication
- Find file I/O paths

**5. Cross-Reference Analysis**

For any interesting function:
- Right-click → References → Show References to
- See where it's called from
- Understand the context

### Phase 3: Dynamic Analysis (2-6 hours)

**1. Basic Execution Observation**
```bash
# Run with tracing
DYLD_PRINT_LIBRARIES=1 ./target-binary 2>&1 | grep -iE "(dylib|framework)"

# System call tracing
dtruss -f ./target-binary 2>&1 | head -100
```

**2. Frida Instrumentation**

Attach and hook:
```javascript
// Hook function by name
Interceptor.attach(Module.findExportByName(null, "target_function"), {
    onEnter: function(args) {
        console.log("Called target_function");
        console.log("Arg0:", args[0]);
        console.log("Arg1:", Memory.readUtf8String(args[1]));
    },
    onLeave: function(retval) {
        console.log("Returned:", retval);
    }
});
```

**3. Network Interception**

```bash
# If proxy-aware
mitmproxy --mode reverse:target-host:443

# For HTTP
mitmweb --listen-port 8080
# Configure proxy in target app
```

**4. File System Monitoring**
```bash
# See what files the app touches
sudo fs_usage -w | grep target-binary
```

### Phase 4: Protocol Reconstruction

If the binary communicates over network:

1. Capture traffic with Wireshark/mitmproxy
2. Identify protocol patterns (length-prefixed, JSON, protobuf, etc.)
3. Map request/response pairs
4. Reconstruct in Python for testing

**Protobuf Detection:**
- Look for varint patterns (0x08, 0x10, etc.)
- Search for `.proto` references
- Check if field numbers are sequential

---

## Expected Outputs

After analysis, you should have:

1. **function-map.md** — Key functions identified with addresses
2. **crypto-locations.md** — Where encryption happens, what algorithms
3. **network-protocol.md** — API endpoints, request/response formats
4. **anti-analysis.md** — Debugger detection, obfuscation found
5. **exploitation-path.md** — Vulnerabilities and how to exploit them

---

## Subagent Delegation

**Delegate these tasks in parallel:**

```python
delegate_task(tasks=[
    {
        "goal": "Extract and analyze all strings from binary",
        "context": "Target: ~/target-binary. Find: credentials, URLs, API endpoints, config keys. Output to strings-analysis.md"
    },
    {
        "goal": "Analyze symbols and function names",
        "context": "Run nm, categorize functions by type: crypto, network, file, auth, UI. Output to symbols-analysis.md"
    },
    {
        "goal": "Ghidra automated analysis export",
        "context": "Import binary, run auto-analysis, export: function list, cross-references, crypto constants. Output to ghidra-export.md"
    }
])

# You focus on:
# - Dynamic analysis with Frida
# - Manual decompilation reading
# - Protocol reconstruction
```

---

## Pitfalls

**1. Analysis Paralysis**
- Don't try to understand every function
- Focus on: entry points, network, crypto, auth
- Ignore: UI rendering, logging, non-critical paths

**2. Trusting Decompilation Blindly**
- Ghidra's pseudo-C can be wrong
- Always verify with disassembly for critical paths
- Cross-reference with dynamic analysis

**3. Missing Anti-Analysis**
- If something doesn't make sense, check for obfuscation
- Timing checks, ptrace, debugger detection
- Code that "should" run but doesn't = anti-analysis

**4. No Documentation**
- If you don't write it down, you forget it
- Add to library/what-worked.md immediately
- Future you will thank present you

---

## Verification

Before considering analysis complete:

- [ ] Can you explain what the binary does in 3 sentences?
- [ ] Can you identify the main entry point?
- [ ] Have you found all network communication paths?
- [ ] Do you understand the crypto/auth mechanisms?
- [ ] Can you intercept/modify behavior dynamically?
- [ ] Is everything documented in the engagement folder?
- [ ] Have you added a technique to library/what-worked.md?

---

## Continuous Learning

**Add to library when you:**
- Successfully identify a new anti-analysis technique
- Bypass a new protection mechanism
- Reconstruct a novel protocol
- Find a faster Ghidra workflow

**Document:**
- What worked
- What didn't
- Why it worked/didn't
- Exact commands/configs used

---

## Integration with Daily Work

**Use reverse engineering for:**
- Understanding npm packages with native bindings
- Debugging Electron apps
- Learning from well-architected software
- Finding undocumented API endpoints
- Understanding how your tools work under the hood

**Example:** You're using a library and the docs are wrong. Reverse engineer the `.node` binary to find the actual API.

YES WE DO THIS. Every binary is a learning opportunity.
