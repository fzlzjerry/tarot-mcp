# Browser WebMCP

Reviewed against the September 4, 2026 WebMCP Community Group draft. This is an
experimental implementation, not a claim of certification or a finalized W3C
Standard. The specification itself explicitly distinguishes those statuses.

Primary references:

- [WebMCP specification and status](https://webmachinelearning.github.io/webmcp/)
- [Official imperative API explainer](https://github.com/webmachinelearning/webmcp/blob/main/README.md)
- [Chrome implementation documentation](https://developer.chrome.com/docs/ai/webmcp/imperative-api)

## What changed

The project previously exposed MCP transports, an MCP Apps resource and a REST
page. It did not register tools with the browser, so the website was not a
WebMCP provider. The `/draw/` page now registers browser tools through
`document.modelContext`, reusing its active React reading session and the same
HTTP validation and authentication as manual interactions.

## Provider contract

| Requirement                | Implementation                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------- |
| Native browser entry point | Feature-detect `document.modelContext.registerTool` in a secure context                      |
| Tool descriptors           | Unique names, descriptions, JSON Schema object inputs and async `execute` callbacks          |
| Shared input contract      | `src/tarot/shared/visual-reading-schema.ts` is reused by MCP and WebMCP                      |
| Serializable results       | Plain JSON-compatible objects; no fabricated JSON-RPC transport                              |
| Lifecycle                  | Await registration; abort its signal on unmount; roll back partial failures                  |
| Cancellation               | Forward a supplied execution signal to the HTTP request; discard late cancelled results      |
| Permissions                | Browser-mediated default same-origin exposure; no `exposedTo` widening or custom global shim |
| Unsupported browser        | Manual form and reading flow continue without registration                                   |
| MCP Apps                   | Uses its existing Apps bridge; does not register browser WebMCP tools                        |

No `provideContext`, `clearContext`, `navigator.modelContext`, or synthetic
`window.webmcp` registry is used. The declarative form API is not required for
this imperative provider.

## Tools

| Tool                       | Result and effect                                                          |
| -------------------------- | -------------------------------------------------------------------------- |
| `list_available_spreads`   | Read-only localized catalog with card counts, descriptions and positions   |
| `begin_visual_reading`     | Starts the visible reading from setup; rejects overlapping/active readings |
| `get_visual_reading_state` | Read-only stage, selection count, and result after confirmation            |

Users choose and confirm their cards in the table. The browser provider exposes
no tool for selecting or finalizing on their behalf. State results omit hidden
card identities before confirmation, opaque slot IDs, draw capabilities, session
authentication and image bytes. Reading output can include the user's question,
so it carries `untrustedContentHint`.

## Browser differences

The September 4 draft describes object arguments for the **consumer**
`executeTool` method. Chrome's September 1 documentation and the locally tested
Chrome 152.0.7977.76 use a JSON string for those arguments. Chrome 152 also omits
the callback's execution options. Our provider tolerates the omitted options;
when a newer implementation supplies `options.signal`, it propagates cancellation.
Chrome 152 cannot propagate a missing signal to the network request. Component
unmount and local reset still cancel requests owned by the page.

The app implements a provider; it does not call or emulate `executeTool` itself.
These consumer-side differences therefore belong in test/agent code, not in the
application's reading logic.

## Verify with a native browser

Use HTTPS or localhost and a browser exposing WebMCP. Local QA used an isolated
Chrome 152 profile with `--enable-experimental-web-platform-features`; ordinary
browser support depends on browser version and feature/origin-trial settings.

On `/draw/`, the following DevTools example targets that Chrome implementation:

```js
const context = document.modelContext;
if (!context) throw new Error("This browser does not expose WebMCP.");
const tools = await context.getTools();
const catalog = tools.find((tool) => tool.name === "list_available_spreads");
const result = await context.executeTool(
  catalog,
  JSON.stringify({ language: "en" }),
);
console.log(JSON.parse(result));
```

To verify the full flow, invoke `begin_visual_reading` with a valid reading input,
check that the page changes to shuffle/cut, select and confirm cards in the UI,
then invoke `get_visual_reading_state`. It must return the same confirmed reading
shown in the table. Starting a second reading while the first is active must
fail. Reloading/unmounting must not leave duplicate tool registrations.

Automated UI tests additionally cover StrictMode cleanup, permission rejection,
partial registration rollback, missing APIs, Chrome 152 callbacks, supplied abort
signals, and exclusion of private draw data. These are application regression
tests, not the browser's Web Platform Tests conformance suite.
