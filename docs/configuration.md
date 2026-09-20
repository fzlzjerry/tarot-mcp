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

The embedded MCP App uses a different continuation contract. Only
`begin_visual_reading` creates the widget. Confirmation returns data without
sending a host message. The reader reveals the cards, then explicitly chooses
**Interpret in chat**. The App attempts supported model-context delivery and
then a text message containing the complete semantic reading; context-update
failure does not block the message. Standard `ui/message` is preferred when the
host advertises `message.text`. Otherwise the App feature-detects the documented
[ChatGPT `sendFollowUpMessage` compatibility method](https://developers.openai.com/plugins/reference#windowopenai-component-bridge)
and sends the same semantic reading through that interface. Both paths have a
10-second timeout. A rejected or timed-out standard send never triggers an
automatic second attempt through the compatibility interface.

What acceptance proves depends on the host. The specification lets a host stage
a `ui/message` in its message box for the reader to send, and Claude does
exactly that. When the ChatGPT component bridge (`window.openai`) is absent, an
accepted standard message is therefore reported as handed over rather than sent:
the App says the reading may be waiting in the message box, keeps the control
available as **Hand it over again**, and records no delivery, so an explicit
second request hands the same reading over again. With that bridge present the
message becomes the reader's turn, which is the delivery the App records.

Simultaneous continuation requests for one reading are merged. Delivery is
recorded only on a ChatGPT-bridge host, after the standard result has no
`isError: true` or the documented follow-up promise resolves. Failure preserves
the cards and permits a manual retry; check the conversation first, since a lost
response cannot prove that the message was not delivered. Hosts with neither
interface get a manual-continuation notice. Local interpretation stays available. Neither
bridge payload contains image URLs, image bytes, opaque slots, or credentials.
Explicit restart opens the shared setup form inside the same widget. On hosts
with `window.openai.widgetState` and synchronous `setWidgetState`, the MCP App
privately checkpoints its current order, selection, confirmed semantic reading,
revealed cards, and acknowledged continuation state. The result is saved before
calling either continuation bridge. Recreating the iframe and replaying the same
pending tool result restores the confirmed result page, not the shuffle stage.

Submitted selections also persist an exact frozen confirmation before dispatch.
If a confirmation response is lost and the widget remounts, the cards stay locked:
removal, clearing, card selection, and ordinary confirmation cannot replace them.
The notification retries only the original draw and ordered slots. An explicit
input rejection clears that lock and persists the editable selection; known
expiry or conflict still requires a new reading. Recovery metadata keeps only
machine codes/statuses, not raw transport error messages.

Restoration waits for the original host payload and validates draw identity,
the complete unique deck, selection membership/count, and revealed indices.
Snapshots for a different draw are never reused. No image bytes/URIs or secrets
are persisted, and the checkpoint's model-visible content is empty. Missing
host persistence stays in-memory; this does not add cross-browser or cross-device
storage. An interrupted send without acknowledgement is not marked sent and is
never automatically repeated.

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

## Private ChatGPT via Secure MCP Tunnel

This deployment is for a personal developer connection. It does not create a
public directory listing, publish an anonymous API, or add an OAuth account
system. Follow the [official Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
and [ChatGPT connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

### Server and secrets

The topology is one `tarot-mcp` HTTP container and the pinned official
`ghcr.io/openai/tunnel-client:v0.0.14` container on the project Docker bridge.
No Docker socket or Cloudflare/Harpoon companion is configured. The only
published port is `127.0.0.1:3000:3000`; tunnel health on 8080 stays private.
The tunnel needs outbound HTTPS to `api.openai.com:443` and access to
`http://tarot-mcp:3000/mcp`. No public domain, inbound internet port, or TLS
reverse proxy is required.

Copy `.env.example` to `.env` on the selected server and fill it privately:

| Variable | Purpose |
| --- | --- |
| `MCP_AUTH_TOKEN` | Shared Bearer credential for the private MCP service and local Web access |
| `CONTROL_PLANE_TUNNEL_ID` | Tunnel belonging to the intended Platform organization and associated ChatGPT workspace |
| `CONTROL_PLANE_API_KEY` | Create a Restricted key at [Platform API keys](https://platform.openai.com/settings/organization/api-keys) with Tunnels Read + Use; never use an Admin API key |

Only `tunnel-client` receives the control-plane credentials. They are not passed
to Node, Vite, the HTML bundle, tool results, or UI state. The existing ignore
rules exclude actual `.env` files from git and Docker build context. Do not
print the resolved Compose configuration or enable raw HTTP logging.

Before startup, verify the pinned image's official provenance; stop on failure:

```sh
gh attestation verify oci://ghcr.io/openai/tunnel-client:v0.0.14 -R openai/tunnel-client && \
bash deploy.sh
```

If the server's `gh` does not support `attestation`, do not skip verification.
Use a current official GitHub CLI, or verify on a trusted workstation and compare
the server's pulled image RepoDigest with the verified digest before startup.
After startup, confirm the running container uses that inspected image. A failed
signature/provenance check is a stop condition, not a reason to change images or
disable verification.

Run from the repository root with a running Docker engine, Compose v2 or newer,
curl, and the GitHub CLI. The script first runs Compose `config --quiet`, then
`up -d --build` without a prior `down`. It checks local tarot `/health` and then
polls tunnel `/readyz` through the Node container, with a bounded per-probe
timeout and a 120-second readiness window. Failures identify the failing layer
and show bounded service logs; a healthy tunnel is not a claim that ChatGPT has
connected.

The equivalent manual private readiness probe is:

```sh
docker compose -f docker-compose.yml -f docker-compose.tunnel.yml exec -T tarot-mcp node -e "fetch('http://tunnel-client:8080/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

`MCP_EXTRA_HEADERS` and `MCP_DISCOVERY_EXTRA_HEADERS` both use
`Authorization: env:MCP_AUTHORIZATION`, resolving the service Bearer value only
for the configured MCP origin. See the pinned [configuration reference](https://github.com/openai/tunnel-client/blob/v0.0.14/docs/configuration.md).
Top-level tool `securitySchemes: [{type: 'noauth'}]` means no additional end-user
OAuth; it does not make this private service publicly unauthenticated.

### Connect the intended account and workspace

1. Create or select a tunnel at
   [Platform tunnel settings](https://platform.openai.com/settings/organization/tunnels).
   Associate the personal Platform organization and the intended ChatGPT
   workspace. Running/selecting a tunnel requires Tunnels **Read + Use**;
   creation also requires **Manage**. Request missing permissions from the
   appropriate administrator rather than changing account roles automatically.
2. Enable Developer mode in ChatGPT **Settings → Security and login** when the
   account/workspace permits it. Open [ChatGPT Plugins](https://chatgpt.com/plugins)
   and choose **+**. Name: **Tarot**. Description:
   **A private, interactive tarot ritual with manual shuffling, cutting, card selection, and reveal.**
3. Choose **Tunnel** as the connection, and select or enter the same `tunnel_id`.
   If authentication is requested, choose **No Authentication**. Do not enter
   the service's fixed Bearer token into ChatGPT as a fabricated API-key login.
4. After discovery, start a new conversation and request the manual visual
   ritual. Approve any host tool/message permission prompts interactively. Only
   begin should create a widget; confirmation should neither create another
   widget nor request interpretation before the reader finishes revealing.
5. Click **Interpret in chat** after all cards are revealed and verify that
   the conversation matches their positions and orientations without drawing
   again. After metadata or UI updates, **Refresh** this private connection and
   use a new conversation. Test fullscreen return and same-widget restart in the
   actual host; a narrow standalone browser window is not that proof.

The standalone Web UI remains available locally or over the operator's own SSH
local forwarding. Use the same `MCP_AUTH_TOKEN` in its existing Connection
settings. Keep origins restricted; do not expose `/draw` publicly or set
`ALLOWED_ORIGINS=*` for this personal setup.

The `tarot-sessions` volume stays in place and retains history across restarts.
Pending draws are memory-only: restarting tarot invalidates them, and the UI
requires a new reading. A tunnel outage must be reported as unavailable, not as
a successful connection. Only perform stop/restart fault drills when explicitly
authorized by the operator.

## Private Claude connector via reverse proxy

Claude's custom connectors (web, desktop and mobile) accept a remote MCP URL and
an optional OAuth client; they have no field for a static `Authorization` header.
This service authenticates with a fixed Bearer token, so a TLS reverse proxy
publishes exactly one unguessable path that maps to `/mcp` and injects the header
upstream. The connector URL is therefore the credential: treat it like a
password, keep it out of access logs, and rotate it by changing the path
segment. Everything else on the public hostname returns 404, so `/draw`, `/api`
and the bare `/mcp` endpoint stay unpublished. The ChatGPT tunnel is unaffected;
both connections use the same container.

Requirements: a DNS record for the public hostname pointing at the server, a
certificate for it, and the hostname in `ALLOWED_HOSTS`. Add the latter to
`.env`, since the Compose override defaults to container/loopback hosts only:

```sh
ALLOWED_HOSTS=tarot-mcp,localhost,127.0.0.1,tarot.example.com
```

The proxy location must disable response buffering; the Streamable HTTP
server-to-client stream is Server-Sent Events, and a buffering proxy withholds
events until the stream ends. Dropping `Origin` keeps the service's browser
DNS-rebinding guard from rejecting a non-browser client that sends one:

```nginx
location = /c/REPLACE_WITH_RANDOM_PATH/mcp {
    access_log off;

    proxy_pass http://127.0.0.1:3000/mcp;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_set_header Origin "";
    # Literal MCP_AUTH_TOKEN value from .env.
    proxy_set_header Authorization "Bearer <token>";

    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
    proxy_read_timeout 1800s;
    proxy_send_timeout 1800s;
}

location / {
    return 404;
}
```

Generate the path segment with at least 128 bits of entropy, for example
`head -c 24 /dev/urandom | base64 | tr '+/' '-_' | tr -d '='`. Keep the rendered
configuration file readable only by root: it contains the service token. Store
any copy of the path outside the repository directory, because the image build
copies the whole tree and would bake the secret into a layer.

In Claude, open **Settings → Connectors → Add custom connector**, name it
**Tarot**, paste `https://<host>/c/<secret>/mcp`, and leave the OAuth fields
empty. Claude reports the tool count after discovery; the connector settings page
also counts interactive tools, which confirms that `_meta.ui.resourceUri` was
parsed. Claude caches `tools/list` per connector session, so metadata changes
need a connector refresh, while changed tool results appear immediately.

Verify the published path before connecting Claude, using a real MCP handshake
rather than a plain GET:

```sh
curl -sS -D- -o /dev/null -X POST https://<host>/c/<secret>/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

A successful response carries `Mcp-Session-Id`. Reuse that header on a
`GET` with `Accept: text/event-stream` to confirm the proxy holds the stream open
and returns `content-type: text/event-stream`.

Widget rendering in Claude is not guaranteed. This server declares the MCP Apps
extension and `_meta.ui.resourceUri` unconditionally rather than gating on the
client's advertised capability, because Claude's web host renders apps without
advertising the extension. Remote HTTP connectors still hit a host-side gap where
the frame never mounts and the reply degrades to the text fallback
([anthropics/claude-ai-mcp#61](https://github.com/anthropics/claude-ai-mcp/issues/61));
mobile has been reported to render the same connector correctly. Claude Code does
not advertise the UI extension at all, so it receives text tool results only, and
HTTP transports never open a browser table: a text-only Claude client can run the
non-visual reading tools, but cannot complete the manual draw ritual.
