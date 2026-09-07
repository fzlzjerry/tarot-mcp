# Running and configuring Tarot MCP

## Configuration

### Command Line Options

```bash
node dist/index.js [options]

Options:
  --transport <type>    Transport type: stdio, http, sse (default: stdio)
  --port <number>       Port for HTTP/SSE transport (default: $PORT or 3000)
  --host <address>      Bind address for HTTP transport (default: $HOST or 0.0.0.0)
  --help, -h           Show help message
```

### Environment Variables

| Variable                                  | Purpose                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT` / `HOST`                           | HTTP listener port and bind address                                                                                                                                                                                                                                                                                                      |
| `MCP_AUTH_TOKEN`                          | When set, MCP/REST endpoints require `Authorization: Bearer <token>`; `/health`, `/draw`, and versioned artwork stay public. **Set this for any public deployment.**                                                                                                                                                                     |
| `ALLOWED_ORIGINS`                         | Comma-separated browser origins allowed beyond localhost (`*` allows any)                                                                                                                                                                                                                                                                |
| `ALLOWED_HOSTS`                           | When set, requests must carry one of these Host headers                                                                                                                                                                                                                                                                                  |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Rate limit per IP (default 120 requests / 60s)                                                                                                                                                                                                                                                                                           |
| `MCP_MAX_TRANSPORT_SESSIONS`              | Cap on concurrent transport sessions per transport (default 100)                                                                                                                                                                                                                                                                         |
| `SESSION_STORE_PATH`                      | When set, reading sessions persist to this JSON file and survive restarts/redeploys (24h idle expiry still applies). Docker Compose enables it by default (`/data/sessions.json` on a named volume); without it sessions are memory-only and a restart invalidates existing sessionIds.                                                  |
| `TAROT_BROWSER_FALLBACK`                  | Local stdio visual-delivery mode: `auto` opens the browser only when the client does not declare MCP Apps HTML support; `off` disables browser handoff; `force` always opens the loopback table; `link` returns the handoff link without launching a browser. Default: `auto`. HTTP/SSE modes never launch a browser on the server host. |
| `TAROT_BROWSER_FALLBACK_PORT`             | Loopback handoff listener port for stdio browser fallback. Default: `0`, which asks the OS for an available random port.                                                                                                                                                                                                                 |
| `LOG_LEVEL` / `LOG_FORMAT`                | Level: `debug`, `info`, `warn` or `error` (default `info`). Format: `json` for JSON-lines; logs go to stderr.                                                                                                                                                                                                                            |

## MCP clients

### Cursor IDE

Add to your Cursor `mcp.json`:

```json
{
  "mcpServers": {
    "tarot": {
      "command": "npx",
      "args": ["tarot-mcp-server@latest"]
    }
  }
}
```

Or for local development:

```json
{
  "mcpServers": {
    "tarot": {
      "command": "node",
      "args": ["/path/to/tarot-mcp/dist/index.js"]
    }
  }
}
```

### ChatWise

For a local ChatWise stdio entry, enable both **Auto run** and **Long running**:

```text
Name: tarot
Type: STDIO
Command: /opt/homebrew/bin/node /Users/moraxcheng/tarot-mcp/dist/index.js
Environment: TAROT_BROWSER_FALLBACK="auto"
Auto run: On
Long running: On
```

ChatWise may refresh its MCP registry when focus returns from the system browser.
Some releases send the stdio child `SIGTERM` during that refresh even though the
browser-backed `tools/call` is still pending. When the connected client identifies
itself as ChatWise, Tarot MCP defers that lifecycle signal only while a browser
confirmation waiter is active, returns the confirmed result to the original call,
allows stdout to drain, and then exits normally. A real ChatWise process exit still
terminates the handoff immediately.

No additional HTTP server entry is needed for a local stdio client. If the
client declares the MCP Apps extension with the
`text/html;profile=mcp-app` MIME type, the table remains embedded in the client.
Otherwise, `TAROT_BROWSER_FALLBACK=auto` opens an ephemeral
`http://127.0.0.1:PORT/draw/#handoff=...` page. The fragment token attaches that
browser tab to the already prepared `drawId`, supports idempotent confirmation
and refresh recovery, and is not used by HTTP/SSE server transports. Once the URL
is opened automatically or delivered through MCP progress, the original
`begin_visual_reading` call remains pending. The server sends progress heartbeats
while waiting; confirming in the browser returns the confirmed reading from that
same call, which gives the AI a normal tool result and resumes the host turn.

Keep the MCP client connected until confirmation: the stdio process owns the
in-memory draw and loopback listener. Progress resets cooperative MCP timeouts,
but some clients impose a shorter hard maximum that heartbeats cannot extend. A
client that neither launches the browser nor exposes progress cannot receive a
URL while the call is pending; in `link` mode the compatibility behavior is to
return the pending draw with the URL immediately. A host may half-close stdin
after dispatching the call while it continues reading stdout; the pending browser
waiter deliberately keeps the loopback process alive until confirmation,
cancellation, or the draw's 30-minute expiry. A real MCP transport close, SIGINT,
or ordinary SIGTERM still stops the listener, while request cancellation releases
that request's waiter reference. The one compatibility exception is ChatWise's
registry-refresh SIGTERM during an active browser waiter, described above. If the
client process itself terminates, the page reports the disconnect and a new draw
must be started.

The embedded MCP App uses a different continuation contract. Its initial
`begin_visual_reading` returns the pending draw immediately so the host can render
the App. After the App calls `confirm_visual_reading`, it publishes the confirmed
structured reading through the host's model-context bridge and requests a host
message when those MCP App capabilities are available. That new host turn lets
the AI continue from the selected cards. The bridge contains only card ids,
names, orientations, positions, keywords, meanings, and interpretation text;
it never forwards image URLs, base64 artwork, or image content blocks. Hosts
without those capabilities still
show the completed reading in the App but may require the user to continue the
conversation manually.

### Streamable HTTP MCP Clients

For clients supporting MCP Streamable HTTP:

```json
{
  "mcpServers": {
    "tarot": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### Legacy SSE MCP Clients

For older clients supporting the legacy Server-Sent Events transport:

```json
{
  "mcpServers": {
    "tarot": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

The legacy `/sse` endpoint advertises `/messages?sessionId=...` as the matching client-to-server message endpoint.

Streamable HTTP and legacy SSE deployments do not automatically open the
default browser on the machine running the server. Their users continue to use
the embedded MCP App when supported or the explicitly hosted `/draw` Web page.
