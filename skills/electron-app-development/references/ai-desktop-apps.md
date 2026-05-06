# AI Desktop Apps (Cursor / Codex / Claude Desktop / Windsurf pattern)

The 2026 hot category. Despite Tauri's bundle/RAM advantages, **all four major AI coding-agent desktops are Electron** — Cursor, OpenAI Codex, Claude Desktop, Windsurf. The ecosystem moat (VSCode fork lineage, web-tech UI, vast plugin libraries) wins.

This reference captures the recognizable architecture they share.

## Contents

- [The reference architecture](#the-reference-architecture)
- [Component 1 — Streaming LLM via utilityProcess](#component-1--streaming-llm-via-utilityprocess)
- [Component 2 — MCP server lifecycle](#component-2--mcp-server-lifecycle)
- [Component 3 — Local model integration](#component-3--local-model-integration)
- [Component 4 — Workspace indexing (RAG / search)](#component-4--workspace-indexing-rag--search)
- [Component 5 — Tool calling round-trip](#component-5--tool-calling-round-trip)
- [Component 6 — Chat history persistence](#component-6--chat-history-persistence)
- [Component 7 — Tray + global shortcut for "summon"](#component-7--tray--global-shortcut-for-summon)
- [Component 8 — Settings UI (model picker, API keys, MCP config)](#component-8--settings-ui-model-picker-api-keys-mcp-config)
- [Component 9 — Telemetry / crash reporting](#component-9--telemetry--crash-reporting)
- [Component 10 — App-shape shortcuts](#component-10--app-shape-shortcuts)
- [Pitfalls observed in the wild](#pitfalls-observed-in-the-wild)

---

## The reference architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer (React)                      │
│   • Chat UI, code diffs, file tree                       │
│   • Streaming text via IPC events                        │
│   • Monaco/CodeMirror editor                             │
└────────────────┬────────────────────────────────────────┘
                 │ window.api.invoke / window.api.on
                 ▼
┌─────────────────────────────────────────────────────────┐
│                    Main process                          │
│   • Window/menu/tray/global shortcuts                    │
│   • Auth (PKCE OAuth via system browser)                 │
│   • SQLite (chat history, user prefs)                    │
│   • Spawns utilityProcesses for heavy work               │
└─┬──────────────────────┬─────────────────────┬──────────┘
  │                      │                     │
  ▼                      ▼                     ▼
┌────────────┐   ┌──────────────┐   ┌──────────────────────┐
│ utility-   │   │ utility-     │   │ MCP servers           │
│ process    │   │ process      │   │ (spawned per session) │
│ "LLM"      │   │ "Indexer"    │   │ • Filesystem MCP      │
│ • Streams  │   │ • Walks      │   │ • Bash MCP            │
│   from     │   │   workspace  │   │ • GitHub MCP          │
│   Anthropic│   │ • Builds     │   │ • Browser MCP         │
│   /OpenAI  │   │   embeddings │   │ • Custom user MCP     │
└────────────┘   └──────────────┘   └──────────────────────┘
```

## Component 1 — Streaming LLM via utilityProcess

Don't run LLM streaming in the main process — long-lived HTTP keeps main busy and blocks IPC for everyone. Use a dedicated utility process per active conversation, or one shared streamer with a job queue.

```ts
// main/llm-host.ts
import { utilityProcess, MessageChannelMain } from 'electron';

const llmProc = utilityProcess.fork(path.join(__dirname, '../llm/index.js'), [], {
  serviceName: 'llm-streamer',
  disclaim: process.platform === 'darwin' ? true : undefined,
});

ipcMain.handle('llm:chat', async (event, { messages, model }) => {
  const id = crypto.randomUUID();
  const { port1, port2 } = new MessageChannelMain();
  event.sender.postMessage('llm-stream-port', { id }, [port1]);
  llmProc.postMessage({ type: 'start', id, messages, model }, [port2]);
  return { id };
});
```

```ts
// llm/index.js — runs in utilityProcess
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ports = new Map<string, MessagePortMain>();

process.parentPort.on('message', async ({ data, ports: [port] }) => {
  if (data.type === 'start') {
    ports.set(data.id, port);
    port.start();
    try {
      const stream = client.messages.stream({ model: data.model, messages: data.messages, max_tokens: 4096 });
      for await (const event of stream) {
        port.postMessage({ type: 'event', event });
      }
      port.postMessage({ type: 'done' });
    } catch (err) {
      port.postMessage({ type: 'error', message: (err as Error).message });
    }
  }
});
```

The renderer receives the `MessagePort` directly from main and listens to it — main is out of the per-token hot path.

## Component 2 — MCP server lifecycle

Cursor, Claude Desktop, and Codex all support [Model Context Protocol](https://modelcontextprotocol.io/) servers. Each MCP server is a subprocess speaking JSON-RPC over stdio.

```ts
// main/mcp-host.ts
import { utilityProcess } from 'electron';
import { spawn, ChildProcess } from 'node:child_process';

interface McpServerConfig { command: string; args: string[]; env?: Record<string, string>; }

class MCPHost {
  private servers = new Map<string, ChildProcess>();

  start(name: string, config: McpServerConfig) {
    const child = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
    });
    child.stderr.on('data', (b) => log.debug(`[mcp:${name}]`, b.toString()));
    child.on('exit', (code) => log.info(`[mcp:${name}] exited ${code}`));
    this.servers.set(name, child);
    return child;
  }

  async call(name: string, method: string, params: unknown): Promise<unknown> {
    const c = this.servers.get(name);
    if (!c) throw new Error('mcp not running');
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const onData = (buf: Buffer) => {
        const lines = buf.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.id === id) {
              c.stdout.off('data', onData);
              msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
            }
          } catch {}
        }
      };
      c.stdout.on('data', onData);
      c.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  }

  stopAll() { for (const c of this.servers.values()) c.kill('SIGTERM'); }
}
```

User-configurable MCP servers (like Claude Desktop's `claude_desktop_config.json`) — same idea, just load the list from a config file the user can edit.

## Component 3 — Local model integration

Patterns from the search results:

| Backend | Pattern |
|---------|---------|
| **Ollama** | HTTP at `localhost:11434`. Spawn ollama as a sidecar `child_process` if you want a contained install. |
| **llama.cpp** | Spawn `llama-server` as a sidecar; OpenAI-compatible API at chosen port. |
| **LM Studio** | User-installed; HTTP API at `localhost:1234`. |
| **vLLM / TGI** | Same shape. |

```ts
// Probe local models on startup, present to user.
async function discoverLocalModels(): Promise<LocalModel[]> {
  const out: LocalModel[] = [];
  try {
    const r = await net.fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(500) });
    if (r.ok) out.push(...((await r.json()).models.map((m: any) => ({ provider: 'ollama', name: m.name }))));
  } catch {}
  try {
    const r = await net.fetch('http://localhost:1234/v1/models', { signal: AbortSignal.timeout(500) });
    if (r.ok) out.push(...((await r.json()).data.map((m: any) => ({ provider: 'lmstudio', name: m.id }))));
  } catch {}
  return out;
}
```

**Local servers are NOT a security boundary** — see security-checklist.md. Even though it's "your" Ollama, any browser tab can hit it. Don't trust localhost responses with user secrets unless you started the process and own the port.

## Component 4 — Workspace indexing (RAG / search)

Cursor's "open project" → embeds files into a local vector DB → uses for context. Pattern:

```ts
// main/indexer-host.ts — utilityProcess
const indexer = utilityProcess.fork(path.join(__dirname, '../indexer/index.js'));
indexer.postMessage({ type: 'index-workspace', root: workspacePath });
```

```js
// indexer/index.js
const Database = require('better-sqlite3');
const { pipeline } = require('@xenova/transformers');           // local embeddings
const db = new Database(/* userData/index.db */);
db.exec('CREATE TABLE IF NOT EXISTS embeddings(path TEXT, chunk INT, vec BLOB)');

let embed;
async function init() { embed = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'); }

process.parentPort.on('message', async ({ data }) => {
  if (data.type === 'index-workspace') {
    for (const file of walkWorkspace(data.root)) {
      const chunks = splitFile(file);
      for (const [i, c] of chunks.entries()) {
        const v = await embed(c, { pooling: 'mean', normalize: true });
        db.prepare('INSERT INTO embeddings VALUES (?,?,?)').run(file, i, Buffer.from(v.data.buffer));
      }
    }
  }
});
```

For a vector DB, options: keep it simple with brute-force cosine over a few thousand chunks; for >100k chunks use `sqlite-vss` or `lancedb` (both bundled-friendly).

## Component 5 — Tool calling round-trip

```ts
// LLM emits tool_use → main routes to MCP → returns result → LLM continues
async function runWithTools(userMsg: string) {
  let messages = [{ role: 'user', content: userMsg }];
  while (true) {
    const result = await llm.chat({ messages, tools: mcpTools });
    if (result.stop_reason === 'tool_use') {
      const toolUse = result.content.find((b) => b.type === 'tool_use');
      const toolResult = await mcpHost.call(toolUse.server, toolUse.name, toolUse.input);
      messages = [...messages, { role: 'assistant', content: result.content },
                              { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }] }];
      continue;
    }
    return result;
  }
}
```

## Component 6 — Chat history persistence

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER,
  updated_at INTEGER,
  model TEXT
);
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  role TEXT,            -- 'user' | 'assistant' | 'tool'
  content TEXT,         -- JSON content blocks
  created_at INTEGER
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
```

Use better-sqlite3 with WAL mode. Re-index for full-text search via `fts5`.

## Component 7 — Tray + global shortcut for "summon"

Most AI desktop apps register `Cmd+Space` (or similar) for instant summon — see `os-integration.md` for the global shortcut pattern.

## Component 8 — Settings UI (model picker, API keys, MCP config)

```tsx
function ApiKeyInput() {
  const [key, setKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  useEffect(() => { window.api.invoke('settings:has-api-key', 'anthropic').then(setHasKey); }, []);
  return (
    <div>
      <input type="password" placeholder={hasKey ? '••••••••' : 'API key'} value={key} onChange={(e) => setKey(e.target.value)} />
      <button onClick={async () => { await window.api.invoke('settings:set-api-key', 'anthropic', key); setKey(''); setHasKey(true); }}>Save</button>
    </div>
  );
}

// main: encrypts via safeStorage and writes to userData
ipcMain.handle('settings:set-api-key', (_e, provider, key) => {
  fs.writeFileSync(keyFile(provider), safeStorage.encryptString(key));
});
```

## Component 9 — Telemetry / crash reporting

- **Sentry Electron SDK** auto-wires both processes, captures minidumps for native crashes.
- **Default to off** for telemetry. Surface a one-time consent screen on first launch.
- Strip prompts and file paths from crash reports — they often contain user content.

```ts
import * as Sentry from '@sentry/electron/main';

if (await isTelemetryEnabled()) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    beforeSend(event) {
      // Strip user content
      if (event.contexts?.user_messages) delete event.contexts.user_messages;
      return event;
    },
  });
}
```

## Component 10 — App-shape shortcuts

| Cursor / Codex / Claude Desktop / Windsurf all do these |
|------|
| Cmd+K — command palette / quick action |
| Cmd+L — focus chat / new conversation |
| Cmd+I — inline edit / suggest |
| Cmd+Shift+P — full command palette |
| Cmd+Enter — send message |
| Cmd+/ — toggle help |
| Esc — cancel running stream / close palette |

## Pitfalls observed in the wild

- **Streaming chunks not batched** → renderer re-renders 200x/sec, UI freezes. Batch by `requestAnimationFrame` or 16ms.
- **Holding entire conversation in renderer state** → 100k-token chats become unscrollable. Virtualize the message list.
- **API keys in plaintext electron-store** → safeStorage them.
- **MCP servers spawned but never killed** → on `before-quit`, `mcpHost.stopAll()`.
- **Local model running while window is closed** → CPU at 100% in background. Hook `window-all-closed` to stop it (or warn user).
- **No abort path for streaming** → users can't stop a generating response. Expose `llm:cancel` IPC that closes the MessagePort and aborts the SDK call.
