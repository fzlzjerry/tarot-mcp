# HTTP and MCP interfaces

## HTTP endpoints

When running in HTTP mode, the following endpoints are available:

### Health & Info

- `GET /health` - Health check with service status
- `GET /api/info` - Server information, capabilities, and available tools

### Tarot Cards

- `GET /api/cards` - List all cards with filtering options
  - `?category=all|major_arcana|minor_arcana|wands|cups|swords|pentacles`
  - `?language=en|zh` (default: en)
- `GET /api/cards/:cardName` - Get detailed card information
  - `?orientation=upright|reversed` (default: upright)
  - Accepts English names, Chinese names, or stable card ids
  - `?language=en|zh` (default: en)

### Professional Readings

- `POST /api/reading` - Perform a comprehensive tarot reading
  ```json
  {
    "spreadType": "single_card|three_card|celtic_cross|...",
    "question": "Your specific question here",
    "sessionId": "optional - use the Session ID returned by a previous reading",
    "language": "optional - en or zh"
  }
  ```
- `POST /api/custom-spread` - Create and perform a custom tarot spread
  ```json
  {
    "spreadName": "Your Custom Spread Name",
    "description": "What this spread explores",
    "positions": [
      {
        "name": "Position Name",
        "meaning": "What this position represents"
      }
    ],
    "question": "Your specific question",
    "sessionId": "optional - use the Session ID returned by a previous reading",
    "language": "optional - en or zh"
  }
  ```
- `GET /api/spreads?language=en|zh` - List all available spread types with descriptions
- `POST /api/visual-readings` - Prepare an opaque two-stage visual draw (`readingKind`: `spread`, `daily`, `moon`, or `custom`)
- `POST /api/visual-readings/:drawId/confirm` - Confirm ordered slot IDs and reveal exactly one idempotent reading
- `POST /api/tools/:toolName` - Invoke any MCP tool over REST using the request body as its arguments. This provides HTTP parity for search, recommendations, analytics, daily/lunar readings, comparison, and session-history tools.

### Visual UI and artwork

- `GET /draw` - Shared visual reading app (public static page)
- `GET /assets/cards/midnight-art-nouveau-v1/:cardId.webp` - 512×768 Web artwork
- `GET /assets/cards/midnight-art-nouveau-v1/mcp/:cardId.webp` - 192×288 MCP artwork

The static UI and versioned artwork are public/cacheable. `/api/*`, `/mcp`, `/sse`, and `/messages` continue to require Bearer authentication whenever `MCP_AUTH_TOKEN` is set.

### Advanced Features

- **Celtic Cross Analysis**: 10-card comprehensive reading with position dynamics
- **Three Card Flow**: Past/Present/Future with energy progression analysis
- **Elemental Balance**: Automatic analysis of Fire, Water, Air, Earth energies
- **Context-Aware Interpretations**: Meanings selected based on question content
- **Advanced Card Search**: Multi-criteria search with keyword, suit, element, and arcana filtering
- **Similarity Analysis**: Find cards with related meanings and themes
- **Database Analytics**: Comprehensive statistics and quality metrics
- **Secure Randomization**: Cryptographically secure card drawing and shuffling

### MCP Protocol

- `POST /mcp` - MCP Streamable HTTP client-to-server endpoint with session initialization
- `GET /mcp` - MCP Streamable HTTP server-to-client stream for an initialized session
- `DELETE /mcp` - MCP Streamable HTTP session termination
- `GET /sse` - Legacy Server-Sent Events endpoint for older MCP clients
- `POST /messages?sessionId=...` - Legacy SSE client-to-server message endpoint advertised by `/sse`

## MCP tools

The server provides **16 MCP tools**. The authoritative, always-current
catalog (schemas, annotations, output schemas) is served by the protocol
itself — call `tools/list` over MCP, or `GET /api/info` over HTTP.

| Tool                           | Purpose                                                        |
| ------------------------------ | -------------------------------------------------------------- |
| `get_card_info`                | Full card detail (meanings, symbolism, astrology)              |
| `list_all_cards`               | Card catalog, filterable by category                           |
| `list_available_spreads`       | Spread catalog with positions                                  |
| `perform_reading`              | Reading with a built-in spread (session-aware)                 |
| `begin_visual_reading`         | Prepare a hidden deck; browser fallback waits for confirmation |
| `confirm_visual_reading`       | App-only ordered confirmation; retries return the same reading |
| `create_custom_spread`         | Reading with a user-defined spread                             |
| `get_daily_card`               | One-shot daily guidance draw                                   |
| `get_moon_phase_reading`       | Lunar-phase-aligned reading                                    |
| `search_cards`                 | Multi-criteria card search                                     |
| `find_similar_cards`           | Cards with related meanings                                    |
| `get_random_cards`             | Random draws with filters                                      |
| `recommend_spread`             | Spread recommendation for a question                           |
| `get_card_meanings_comparison` | Compare 2-5 cards in a context                                 |
| `get_database_analytics`       | Card-database statistics                                       |
| `get_session_history`          | Summaries of a session's readings                              |

All user-facing tools accept `language: "en" | "zh"` (default `en`) for
localized Simplified Chinese output. Card lookup and search also accept
Chinese card names and Chinese keywords, while spread recommendation recognizes
common Chinese question phrases. Reading tools additionally
return machine-readable `structuredContent` (reading id, session id,
drawn cards) beside the Markdown text. MCP card records contain only semantic
reading data: canonical `name`, stable `cardId`, localized `displayName`,
orientation, position, keywords, and selected meaning. They do not attach
`imageUri`, embedded image bytes, `cardImages`, or `backImage` to the model's
tool result. Opaque slots alone stay in begin-result `_meta`; the single-file MCP
App bundles its own lightweight artwork, while REST/Web responses retain their
versioned static `imageUri` values.

The server also exposes MCP **resources** (`tarot://cards`,
`tarot://cards/{id}`, `tarot://spreads`, `tarot://spreads/{type}`) and
the MCP App resource `ui://tarot-mcp/visual-reading.html` using
`text/html;profile=mcp-app`, plus **prompts** (`perform-reading`, `daily-draw`).

## Two-stage visual reading

```bash
curl -X POST http://localhost:3000/api/visual-readings \
  -H "Content-Type: application/json" \
  -d '{
    "readingKind": "spread",
    "spreadType": "three_card",
    "question": "What should I understand next?",
    "language": "en"
  }'
```

Choose the required opaque `slotId` values from the returned 78-card deck in
the desired position order, then confirm once:

```bash
curl -X POST http://localhost:3000/api/visual-readings/DRAW_ID/confirm \
  -H "Content-Type: application/json" \
  -d '{"selectedSlotIds":["SLOT_1","SLOT_2","SLOT_3"]}'
```
