# AI Coding Agent Instructions for Tarot MCP Server

## Project Overview
This is a **professional-grade Model Context Protocol (MCP) server** for Rider-Waite tarot readings, built with TypeScript/Node.js. The server provides both MCP protocol and HTTP API endpoints with comprehensive tarot functionality.

## Architecture & Key Components

### Multi-Transport Entry Point
- **`src/index.ts`**: Main entry with command-line parsing (`--transport stdio|http|sse --port 3000`)
- **Transports**: stdio (MCP default), HTTP REST API, SSE (Server-Sent Events)
- **Production**: Docker containerized with health checks and non-root user

### Core Server Structure
```
src/
├── index.ts              # Multi-transport entry point
├── tarot-server.ts       # Core MCP tool handler (12 tools available)
├── http-server.ts        # Express server with CORS, SSE, and health endpoints
└── tarot/                # Tarot engine modules
    ├── types.ts          # TypeScript definitions for all domain objects
    ├── card-data.ts      # Complete 78-card Rider-Waite database
    ├── card-manager.ts   # Card data management and search
    ├── spreads.ts        # 25 professional spread definitions
    ├── reading-manager.ts # Advanced interpretation engine
    ├── session-manager.ts # Session tracking and history
    ├── card-search.ts    # Multi-criteria search and similarity
    ├── card-analytics.ts # Database analytics and reporting
    ├── lunar-utils.ts    # Moon phase calculations and recommendations
    └── utils.ts          # Cryptographic randomness utilities
```

### Critical Initialization Pattern
The **`TarotServer.create()`** static factory method is **required** - never use `new TarotServer()`. This ensures proper async initialization of the card database:

```typescript
// ✅ Correct
const tarotServer = await TarotServer.create();

// ❌ Wrong - will fail
const tarotServer = new TarotServer();
```

## Core Domain Logic

### Card Drawing & Randomness
- **Cryptographically secure**: Uses `crypto.getRandomValues()` via `getSecureRandom()` in `utils.ts`
- **50/50 distribution**: Equal probability for upright/reversed orientations
- **Fisher-Yates shuffle**: Proper card randomization in `card-manager.ts`

### Interpretation Engine Features
- **Context-aware meanings**: Question analysis determines love/career/health/spiritual focus
- **Multi-dimensional analysis**: Elemental balance, suit patterns, numerical progressions
- **Spread-specific logic**: Celtic Cross position dynamics, Three Card flow analysis
- **Advanced patterns**: Court card analysis, Major Arcana progressions, elemental balance

### Spread System (25 Spreads)
Key spreads with specialized analysis:
- **`celtic_cross`**: 10-card comprehensive with position relationship analysis
- **`three_card`**: Past/Present/Future with energy flow assessment
- **`relationship_cross`**: 7-card relationship dynamics
- **`career_path`**: 6-card professional guidance
- **`chakra_alignment`**: 7-card energy center analysis
- **Custom spreads**: 1-15 positions via `create_custom_spread` tool

## Development Workflow

### Build & Test Commands
```bash
# Development
npm run dev          # stdio transport with hot reload
npm run dev:http     # HTTP server with hot reload

# Production
npm run build        # TypeScript compilation to dist/
npm start           # Run built stdio server
npm run start:http  # Run built HTTP server

# Testing
npm test            # Jest with ESM support
npm run test:watch  # Watch mode
npm run test:coverage # Coverage reports

# Docker
npm run docker:build && npm run docker:run
./deploy.sh         # Complete deployment script
```

### TypeScript Configuration
- **ES2022/ESNext modules**: Uses `.js` extensions in imports despite `.ts` source
- **Strict mode enabled**: Full type safety required
- **ESM-first**: Jest configured for ESM with `ts-jest/presets/default-esm`

### Import Patterns
Always use `.js` extensions in imports (required for ESM):
```typescript
import { TarotCardManager } from "./tarot/card-manager.js";  // ✅ Correct
import { TarotCardManager } from "./tarot/card-manager";     // ❌ Wrong
```

## API Integration Points

### MCP Tools (12 Available)
Key tools for AI integration:
- **`perform_reading`**: Main reading function with 25+ spread types
- **`create_custom_spread`**: Dynamic spread creation (1-15 positions)
- **`get_card_info`**: Detailed card information with context
- **`search_cards`**: Multi-criteria search (keyword, suit, element, etc.)
- **`recommend_spread`**: AI-driven spread recommendations
- **`get_moon_phase_reading`**: Lunar-based readings with automatic phase detection

### HTTP Endpoints
When running with `--transport http`:
- **`POST /api/reading`**: Direct reading endpoint
- **`POST /api/custom-spread`**: Custom spread creation
- **`GET /health`**: Health check with endpoint discovery
- **`GET /sse`**: MCP over Server-Sent Events

## Testing Strategy

### File Locations
- **Tests**: `src/tarot/__tests__/*.test.ts`
- **Jest config**: ESM-configured in `jest.config.js`
- **Coverage**: Excludes test files, includes all `src/**/*.ts`

### Test Patterns
Focus on core business logic:
- Card manager functionality and search
- Reading interpretation accuracy
- Spread configuration validation
- Cryptographic randomness verification

## Data & Configuration

### Card Database
- **Location**: `src/tarot/card-data.json` (78 complete cards)
- **Structure**: Research-verified Rider-Waite with multiple contexts (general, love, career, health, spiritual)
- **Quality**: Professional interpretations from Biddy Tarot, Labyrinthos sources

### Spread Definitions
- **Location**: `src/tarot/spreads.ts`
- **Pattern**: Each spread has `name`, `description`, `cardCount`, `positions[]`
- **Validation**: `isValidSpreadType()` and `getSpread()` helpers

## Project-Specific Conventions

### Error Handling
- **MCP tools**: Return descriptive strings, never throw
- **HTTP endpoints**: Use try/catch with proper status codes
- **Async patterns**: Always await `TarotServer.create()`

### Moon Phase Integration
- **Automatic detection**: `calculateMoonPhase()` in `lunar-utils.ts`
- **Themed spreads**: New moon intentions, full moon release
- **Recommendations**: Context-aware lunar guidance

### Session Management
- **Optional**: Sessions track reading history when `sessionId` provided
- **Stateless**: Server works without sessions for simple use cases
- **History**: Full reading preservation with timestamps

## Production Deployment

### Docker Strategy
- **Multi-stage**: Build in container, optimized production image
- **Security**: Non-root user (`tarot:nodejs`)
- **Health checks**: HTTP endpoint monitoring
- **Default**: SSE transport on port 3000

### Environment Variables
- **`NODE_ENV`**: development/production
- **`PORT`**: Override default 3000

## Key Dependencies
- **`@modelcontextprotocol/sdk`**: Core MCP protocol implementation
- **`express`**: HTTP server with CORS support
- **`zod`**: Runtime type validation (limited use)
- **TypeScript/Jest**: Development and testing infrastructure

## Common Pitfalls to Avoid
1. **Never instantiate TarotServer directly** - always use `TarotServer.create()`
2. **Don't forget `.js` extensions** in imports
3. **Session IDs are optional** - don't require them
4. **Card orientations are 50/50** - respect the cryptographic randomness
5. **Context matters** - question analysis drives interpretation selection
