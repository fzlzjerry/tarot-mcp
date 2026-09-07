# Tarot MCP

A bilingual tarot reading service and visual card table, built with TypeScript,
React and Vite. It includes a complete 78-card Rider–Waite–Smith deck, original
Midnight Art Nouveau artwork, 25 built-in spreads, and daily, moon-phase and
custom readings.

Write a question, shuffle and cut, choose face-down cards, then confirm and
explore the reading. Card identities and orientations stay on the server until
confirmation. Repeating the same confirmation returns the same result.

## Run locally

Requires Node.js 20.19 or later and npm.

```sh
npm ci
npm run start:http -- --host 127.0.0.1
```

`npm ci` runs the package's `prepare` build. Open
[the card table](http://127.0.0.1:3000/draw/). To rebuild after changes:

```sh
npm run build
```

For server development, `npm run dev:http -- --host 127.0.0.1` executes the
TypeScript source. Rebuild the UI with `npm run build:ui` after frontend edits;
these commands do not start a Vite development server or hot reload the page.

## Which protocol is this?

| Surface        | Implementation                                                                | Entry point                                       |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------- |
| MCP server     | Official MCP SDK; stdio, Streamable HTTP and legacy SSE                       | `node dist/index.js`, `/mcp`, `/sse`              |
| MCP Apps       | Official Apps SDK; single-file embedded React UI                              | `ui://tarot-mcp/visual-reading.html`              |
| Browser WebMCP | Experimental imperative provider using `document.modelContext.registerTool()` | `/draw/` in a supporting browser                  |
| HTTP API       | Express routes used by the standalone web page                                | `/api/visual-readings` and `/api/tools/:toolName` |

WebMCP is a **Community Group draft, not a finalized W3C Standard**. The browser
provider follows the September 4, 2026 draft's registration surface and also
handles Chrome 152's execution callbacks. Unsupported browsers retain the manual
card table. MCP Apps and an HTTP MCP endpoint alone are not WebMCP.
See [the WebMCP implementation notes](docs/webmcp.md) for the source references,
exposed tools, browser differences and verification instructions.

## Connect an MCP client

For a local checkout, use the absolute built entry path:

```json
{
  "mcpServers": {
    "tarot": {
      "command": "node",
      "args": ["/absolute/path/to/tarot-mcp/dist/index.js"]
    }
  }
}
```

For a client accepting a remote Streamable HTTP URL, use
`http://127.0.0.1:3000/mcp`. If `MCP_AUTH_TOKEN` is configured, supply its Bearer
authorization header. The web page accepts the same token under Connection
settings and stores it only in the current browser tab's session storage.

An MCP Apps client renders the table in its conversation. For local stdio clients
without Apps support, the default browser fallback opens a temporary loopback
page for the same pending draw. The original tool call stays pending until the
user confirms, allowing the conversation to continue with the result. HTTP/SSE
servers do not open a browser on the server machine.

[Client and environment configuration](docs/configuration.md) covers Cursor,
ChatWise's long-running option, browser fallback modes, session persistence,
authentication and origin/host allowlists.

## Code map

| Location                     | Responsibility                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `src/tarot/cards/`           | Canonical deck, card validation, search, analysis and formatting                  |
| `src/tarot/readings/`        | Spreads, reading interpretation, visual draw lifecycle and sessions               |
| `src/tarot/shared/`          | Domain types, shared visual input schema, localization and utilities              |
| `src/mcp/handlers/`          | Tool implementations calling the domain services                                  |
| `src/mcp/protocol-server.ts` | MCP protocol, Apps capabilities and browser handoff delivery                      |
| `src/mcp/http-server.ts`     | HTTP listener, middleware and public static assets                                |
| `src/mcp/http/`              | REST routing, MCP transport sessions and JSON-RPC errors                          |
| `ui/src/useDrawSession.ts`   | Async requests, cancellation, retries and reading transitions                     |
| `ui/src/DrawApp.tsx`         | Card selection, animation state and stage composition                             |
| `ui/src/webmcp/`             | Browser feature detection, tool registration and live page access                 |
| `ui/src/styles/`             | Ordered styles for setup, controls, ritual, draw, reading and responsive behavior |
| `assets/cards/`              | Web and MCP artwork variants, manifest and QA evidence                            |
| `scripts/art/`               | Reproducible artwork processing and verification                                  |

Original PNGs, artwork provenance and QA files are retained because they are
inputs or evidence for the deck pipeline. Full-resolution sources and contact
sheets are excluded from the distributable build; they are not duplicate runtime
assets. See [the artwork workflow](scripts/art/README.md).

## Checks

```sh
npm run build          # Server, Web UI, self-contained MCP App and assets
npm run test:all       # Domain, transport, UI and WebMCP regression tests
npm run lint
npm run verify:build   # Deck integrity and packaged asset checks
```

`npm run test:coverage` measures the server suite. Transport tests need permission
to listen on loopback ports and create local IPC sockets.

The UI suite covers selection order, cut/shuffle behavior, confirmation retries,
reveal and details, localization, host handoff, and WebMCP lifecycle/cancellation.
Native browser checks are described in [WebMCP verification](docs/webmcp.md).

## Deploy

```sh
docker compose up --build -d
```

Configure authentication, allowed hosts/origins and HTTPS for a public service.
Compose persists reading sessions on its configured volume. Pending visual draws
remain process-local; a multi-instance deployment needs shared draw state or
sticky routing.

## Further documentation

- [HTTP endpoints and MCP tools](docs/api.md)
- [Configuration and MCP clients](docs/configuration.md)
- [WebMCP status and verification](docs/webmcp.md)
- [Visual reading behavior and compatibility](SPEC.md)
- [Product direction](PRODUCT.md) and [design system](DESIGN.md)
- [Artwork license and provenance](assets/ASSET_LICENSE.md)

Code is licensed under [MIT](LICENSE). Artwork has its own documented provenance
and licensing terms.
