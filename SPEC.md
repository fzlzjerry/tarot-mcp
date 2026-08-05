# Tarot MCP Visual Reading

## Value Proposition

Tarot readers can ask for a reading conversationally, then select real face-down
cards in an embedded MCP view or the server-hosted `/draw` page. The server keeps
card identities and orientations hidden until the user confirms the required
number of cards.

Core actions:

1. Start a built-in, daily, moon-phase, or custom visual reading.
2. Select and reorder the required number of face-down cards.
3. Confirm once, reveal the cards, and inspect localized meanings.

## Why MCP UI

Conversation remains the best place to express the question and choose a spread;
visual selection, placement, and reveal are clearer on a shared interactive
surface. The LLM supplies intent and interpretation while the server supplies the
deck, secure randomization, sessions, and canonical tarot data.

## UX Flow

1. A local stdio client that declares `text/html;profile=mcp-app` receives the
   pending draw immediately and renders the embedded view. Otherwise the default
   fallback opens a temporary `127.0.0.1` browser table and keeps the original
   `begin_visual_reading` tool call pending. Web users configure the question,
   language, and reading kind on `/draw`.
2. The UI displays 78 indistinguishable card backs and the target spread layout.
3. Each click moves one card into the next spread position. Selection can be
   undone until the required count is reached.
4. Confirmation atomically resolves the opaque slots to cards and orientations.
5. Cards reveal individually or together; selecting a revealed card shows its
   position meaning, orientation, keywords, and localized meaning.

## Interfaces

- MCP tools: `begin_visual_reading`, `confirm_visual_reading`.
- MCP resource: `ui://tarot-mcp/visual-reading.html` using
  `text/html;profile=mcp-app`.
- REST: `POST /api/visual-readings`,
  `POST /api/visual-readings/:drawId/confirm`.
- Web: `GET /draw` and versioned local card-art assets.
- Local stdio browser handoff: an ephemeral loopback-only `/draw` page plus
  internal resolve/confirm endpoints scoped to one prepared draw. These routes
  are not a remotely hosted HTTP/SSE fallback.

`begin_visual_reading` accepts `readingKind` (`spread`, `daily`, `moon`, or
`custom`) plus the fields required by that kind. It returns the frozen spread and
selection count; opaque deck slots are view-only metadata for MCP and ordinary
JSON for Web.

`confirm_visual_reading` accepts an ordered slot-id array. Its reading payload
preserves existing fields and adds stable card ids, localized display names,
keywords, and meanings. The MCP protocol boundary removes all image fields and
bytes from `content`, `structuredContent`, and `_meta`; only the embedded App
resource owns its bundled MCP-sized artwork. REST/Web payloads continue to
include versioned static image URIs.

When the stdio MCP client does not advertise the `io.modelcontextprotocol/ui`
extension with `text/html;profile=mcp-app`, browser fallback registers the
already prepared pending draw and opens
`http://127.0.0.1:PORT/draw/#handoff=TOKEN`. A short-lived, draw-scoped token lets
the Web client resolve the original opaque slots and confirm against the same
`VisualDrawManager` record. The handoff never creates a replacement draw or a
second shuffle. The Web client temporarily stages the fragment token in
`sessionStorage`, removes it from the address bar, and retains it only in that
browser tab so confirmation retries and a refresh can recover the same result.

## Conversation Continuation Contract

Browser fallback and the embedded MCP App deliberately continue the host
conversation in different ways:

- **Local stdio browser fallback:** once the loopback URL is opened or delivered
  to the client through an MCP progress notification, the original
  `begin_visual_reading` `tools/call` remains pending. The server emits progress
  heartbeats while waiting. A successful browser confirmation first completes
  the browser HTTP response, then resolves that same MCP call with the confirmed
  reading. The host therefore receives a normal tool result and can resume the
  AI turn without requiring another user message.
- **Embedded MCP App:** the original `begin_visual_reading` call returns the
  pending draw immediately because that result creates the App surface. The App
  performs `confirm_visual_reading` through the host, publishes the confirmed
  structured reading with `ui/update-model-context`, and requests continuation
  with `ui/message` when the host advertises those capabilities. The confirmed
  cards are then available to the model in the host-created turn. Both bridge
  payloads contain semantic text/JSON only—never `imageUri`, `embeddedImage`,
  base64 artwork, or image content blocks. If the host
  lacks model-context or message support, the App still renders the result but
  the user may need to continue the conversation manually.

Progress delivery is also how `link` mode can expose the browser URL without
ending the long-running call. A compatibility client that provides neither an
automatic browser launch nor progress delivery cannot discover that URL while
the call is pending; for that case, the server returns the pending result and URL
immediately instead of leaving an unreachable waiter.

## State and Compatibility

- Pending draws expire after 30 minutes; confirmed results remain retryable for
  24 hours. Draw state is process-local and capped at 1,000 pending draws.
- A retained-cache admission guard stops new draws once 1,000 confirmed or
  expired records are resident; already accepted draws keep their full retry
  TTL instead of being evicted early.
- The same ordered confirmation is idempotent and never creates duplicate session
  history. A conflicting confirmation fails.
- New tarot sessions are created only at confirmation. Existing server-shaped
  session ids retain current stale-session errors.
- Daily and moon readings remain one-shot. Existing immediate tools and REST
  endpoints keep their current behavior.
- Browser handoff records are scoped to one `drawId`, inherit the pending draw's
  expiration, and cannot authorize unrelated API or MCP calls.

## Browser Fallback Policy

- `TAROT_BROWSER_FALLBACK=auto` is the default: local stdio opens the browser
  only when the client has not declared the MCP Apps HTML MIME capability.
- `off` disables the browser handoff, `force` always opens the loopback table,
  and `link` emits the handoff URL without launching the system browser.
- `TAROT_BROWSER_FALLBACK_PORT=0` is the default and selects an available random
  loopback port; an explicit port may be configured when a stable local port is
  required.
- Streamable HTTP and legacy SSE modes never launch a browser on the server
  machine. Their visual surface remains the MCP App or the explicitly hosted
  `/draw` page.
- The handoff listener binds only to `127.0.0.1`, validates its local Origin and
  Host boundary, and shuts down on a genuine protocol close or ordinary process
  signal. ChatWise is a narrow compatibility exception: if its registry refresh
  sends `SIGTERM` while a browser-confirmation waiter is active, the server defers
  shutdown until that waiter settles and the original JSON-RPC response has had
  time to drain. The exception applies only when the initialized MCP client name
  is `chatwise`; SIGINT, parent-process exit, and signals outside an active waiter
  still shut down immediately.
  While a browser-confirmation waiter exists, the loopback listener keeps the
  process alive even if a host half-closes stdin; stdin EOF alone is not a tool
  cancellation because that host may still be reading the result from stdout.
  That waiter-held reference lasts until confirmation, cancellation, or the
  pending draw's 30-minute expiry.
- The MCP client must keep the stdio server connected until the browser confirms
  the selection. If that local connection closes, the browser reports the
  disconnect in the selected UI language and directs the user to start a new
  draw from the MCP client while keeping the connection open.
- Browser wait progress includes periodic heartbeats so cooperative MCP clients
  can reset their request timeout. Clients may still enforce a shorter hard
  tool-call deadline; cancellation aborts only that request waiter and cleans up
  its listener without invalidating another waiter for the same draw. The last
  settled waiter releases its process reference after one event-loop turn so the
  final JSON-RPC response can flush without leaving an idle child alive.
- ChatWise stdio configuration must enable its `Long running` option. That setting
  prevents normal end-of-generation cleanup; the signal deferral above covers the
  separate registry-refetch lifecycle path.

## Visual System

- Complete 78-card `midnight-art-nouveau-v1` deck plus a rotationally symmetric
  back, generated for this project without third-party card imagery.
- Midnight indigo, warm ivory, antique-gold line work, flat Art Nouveau
  composition, no generated text, logos, signatures, or watermarks.
- Deterministic borders, ranks, and suit pips are composited after generation.
- Web assets: 512x768 WebP. MCP assets: 192x288 WebP.
- All 78 MCP faces plus the back are bundled inside the self-contained App
  resource (raw artwork at most 600 KB; base64 artwork at most 800 KB; complete
  HTML at most 1.5 MB), rather than being attached to any tool result.

## Constraints

- Preserve stdio, Streamable HTTP, legacy SSE, resources, prompts, REST parity,
  Chinese/English output, and current session persistence.
- `/draw` and immutable art are public static assets; APIs remain protected by
  configured Bearer authentication. Browser tokens use `sessionStorage` only.
- The stdio loopback handoff token is short-lived, bound to one draw, and limited to
  resolving and confirming the draw that created it; it is carried in a URL
  fragment rather than a query string.
- UI supports keyboard selection, explicit focus, screen-reader labels, reduced
  motion, 320px reflow, and text labels for reversed cards.
- Deployment and multi-instance shared draw state are outside this implementation.
