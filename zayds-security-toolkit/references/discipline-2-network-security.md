# Discipline 2: Network Security

## YES WE DO THIS

Network analysis isn't just for pentests. **Use it for everything:**
- Understanding how that API actually behaves vs. what the docs say
- Finding undocumented endpoints in apps you use
- Debugging why your integration is failing
- Learning protocol design from production traffic
- Building better tools by seeing how others communicate

**Every packet is a lesson.** Capture it.

---

## When to Use

- Analyzing proprietary protocols
- Finding undocumented API endpoints
- Understanding authentication flows
- Testing API security (auth bypass, IDOR)
- Debugging network issues
- Learning from well-designed APIs

**Also use for:** Understanding third-party integrations, debugging your own apps, learning HTTP/2, gRPC, WebSocket patterns.

---

## Tools Required

**Interception:**
- Burp Suite (web, API, mobile proxy)
- mitmproxy (scriptable, Python)
- Wireshark (deep packet analysis)
- tcpdump (command line capture)

**Analysis:**
- ngrep (grep for network)
- openssl s_client (TLS inspection)
- curl/httpie (manual requests)
- custom Python scripts

**Specialized:**
- grpcurl (gRPC testing)
- websocat (WebSocket client)
- nmap (port scanning)
- masscan (fast port scanning)

---

## Step-by-Step Procedure

### Phase 1: Passive Capture (30 min - 2 hours)

**1. Setup Interception**

**For mobile apps:**
```bash
# macOS - create proxy
cat > /tmp/proxy.py << 'EOF'
from mitmproxy import http

def request(flow: http.HTTPFlow) -> None:
    print(f"Request: {flow.request.method} {flow.request.url}")
    print(f"Headers: {dict(flow.request.headers)}")
    print(f"Body: {flow.request.text[:500]}")

def response(flow: http.HTTPFlow) -> None:
    print(f"Response: {flow.response.status_code}")
    print(f"Body: {flow.response.text[:500]}")
EOF

mitmproxy -s /tmp/proxy.py --listen-port 8080
```

**For web apps:**
- Browser → Burp CA cert installed
- Proxy settings → 127.0.0.1:8080
- Burp running in background

**For CLI tools:**
```bash
export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080
target-command
```

**2. Generate Traffic**

Use the target app naturally:
- Login/logout flow
- All major features
- Error conditions
- Edge cases

**3. Capture Everything**

```bash
# Full packet capture
sudo tcpdump -i any -w capture.pcap host target-host

# With Burp - export as HAR or save to project
```

### Phase 2: Traffic Analysis (1-3 hours)

**1. Overview Analysis**

```bash
# See all connections
tshark -r capture.pcap -Y "dns" -T fields -e dns.qry.name | sort | uniq

# TLS SNI analysis
tshark -r capture.pcap -Y "tls.handshake.type==1" -T fields -e tls.handshake.extensions_server_name
```

**2. Protocol Identification**

Look for patterns:
- **HTTP/1.1**: Clear text requests/responses
- **HTTP/2**: Binary framing, :method, :path pseudo-headers
- **gRPC**: HTTP/2 + protobuf, application/grpc content-type
- **WebSocket**: Upgrade: websocket header
- **Custom**: Binary protocol, length-prefixed fields

**3. Request/Response Mapping**

For each endpoint found:
- Document the URL pattern
- Note all parameters (query, body, headers)
- Identify authentication mechanism
- Map response codes to behavior
- Find error message patterns

**4. Interesting Pattern Search**

```bash
# Find auth tokens
grep -r "Bearer\|Authorization" burp-export/

# Find API keys
grep -ri "api[_-]key\|apikey\|apikey" burp-export/

# Find secrets
grep -ri "secret\|password\|token" burp-export/
```

### Phase 3: Active Interception (2-6 hours)

**1. Request Tampering**

In Burp Repeater:
- Modify parameters
- Change HTTP methods (GET→POST, etc.)
- Remove headers
- Add unexpected fields

**2. Authentication Testing**

```bash
# JWT analysis
curl -H "Authorization: Bearer TOKEN" https://target/api
# Try: alg=none, key confusion, expired tokens

# Session handling
# Try: session fixation, predictable tokens, concurrent sessions
```

**3. Parameter Manipulation**

- Change numeric IDs (IDOR testing)
- Add extra parameters
- Remove required parameters
- Send arrays instead of strings
- Send null/empty values

**4. Protocol-Level Attacks**

```bash
# HTTP request smuggling
curl -X POST http://target \
  -H "Content-Length: 5" \
  -H "Transfer-Encoding: chunked" \
  -d "X"

# gRPC without TLS
curl -v -H "Content-Type: application/grpc" http://target:50051
```

### Phase 4: Protocol Reconstruction (if custom protocol)

**1. Structure Analysis**

Capture multiple requests:
- Identify fixed vs variable fields
- Find length fields (usually varint or 4-byte)
- Map field types (string, int, blob)
- Find delimiters or terminators

**2. Python Reconstruction**

```python
import struct

def parse_custom_protocol(data):
    # Example: length-prefixed JSON
    length = struct.unpack('>I', data[:4])[0]
    payload = data[4:4+length].decode('utf-8')
    return json.loads(payload)

def build_request(cmd, params):
    payload = json.dumps({"cmd": cmd, "params": params})
    length = len(payload)
    return struct.pack('>I', length) + payload.encode()
```

**3. Fuzzing**

Once protocol is understood:
- Fuzz each field type
- Test boundary conditions
- Try injection in string fields

---

## Expected Outputs

1. **endpoint-map.md** — All discovered endpoints with methods
2. **auth-flow.md** — Authentication mechanism documented
3. **protocol-spec.md** — If custom protocol, full reconstruction
4. **findings.md** — Vulnerabilities found (auth bypass, IDOR, injection)
5. **test-scripts/** — Python/curl scripts for reproducing findings

---

## Subagent Delegation

**Delegate in parallel:**

```python
delegate_task(tasks=[
    {
        "goal": "Analyze all captured traffic for API endpoints",
        "context": "Capture file: capture.pcap or Burp export. Extract: all URLs, methods, parameters. Output to endpoint-analysis.md"
    },
    {
        "goal": "Identify authentication patterns",
        "context": "From traffic capture, find: auth endpoints, token formats, session handling, JWT structure. Output to auth-analysis.md"
    },
    {
        "goal": "Search for secrets in traffic",
        "context": "Search capture for: API keys, passwords, tokens, private keys. Document locations and contexts. Output to secrets-found.md"
    }
])

# You focus on:
# - Manual request crafting
# - Protocol reconstruction
# - Business logic testing
```

---

## Pitfalls

**1. Certificate Pinning**
- Mobile apps often pin certificates
- You'll need Frida to bypass: `ssl-pinning-disable` script
- Or patch the binary to remove pinning

**2. Certificate Transparency**
- Some apps check for CT compliance
- May need custom CA that mimics real cert properties

**3. Binary Protocols**
- Don't assume everything is HTTP
- Look for: protobuf, msgpack, custom binary
- Use hex editor for initial reconnaissance

**4. Rate Limiting**
- Aggressive testing gets you blocked
- Use delays, rotate IPs if needed
- Document rate limits found

---

## Verification

- [ ] All endpoints documented with request/response examples
- [ ] Authentication flow fully mapped
- [ ] At least one successful request tampering demonstrated
- [ ] Any secrets/tokens documented (and rotated if real)
- [ ] Protocol fully reconstructed if custom
- [ ] Everything saved to engagement folder
- [ ] Added technique to library/what-worked.md

---

## Continuous Learning

**Add to library when you:**
- Successfully bypass new auth mechanism
- Reconstruct novel protocol
- Find new way to bypass certificate pinning
- Discover interesting API pattern

**Document exact commands and tools used.**

---

## Daily Use

**Use network analysis for:**
- Debugging why API integration fails
- Understanding third-party service behavior
- Learning from well-designed REST APIs
- Finding hidden features in apps you use
- Building better interceptors for your own tools

**Example:** That npm package isn't working. Intercept its API calls to see what it's actually sending vs. what the docs claim.

YES WE DO THIS. Every connection is an opportunity to learn.
