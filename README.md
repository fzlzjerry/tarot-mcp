# 🔮 Tarot MCP Server

A professional-grade Model Context Protocol (MCP) server for Rider-Waite-Smith (RWS) tarot card readings, built with Node.js and TypeScript. This server provides comprehensive tarot functionality through both MCP protocol and HTTP API endpoints, featuring modern RWS interpretations and advanced reading analysis.

## Server config

```json
{
  "command": "npx",
  "args": ["tarot-mcp-server@latest"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

## 🚀 Current Implementation Status

**✅ FULLY IMPLEMENTED AND WORKING:**
- Complete 78-card Rider-Waite-Smith deck with detailed modern interpretations
- **25 professional tarot spreads** including Celtic Cross, Relationship Cross, Career Path, Spiritual Guidance, Year Ahead, Chakra Alignment, Shadow Work, **NEW: Daily Guidance, Yes/No, Weekly Forecast, Moon Phase spreads, Elemental Balance, Past Life Karma, Compatibility**
- **Custom Spread Creation**: AI can create custom tarot spreads when existing ones don't fit
- **Lunar Integration**: Moon phase detection with appropriate spreads and guidance
- **AI Spread Recommendations**: Intelligent spread suggestions based on question analysis
- **Daily Card Practice**: Single card draws for daily guidance
- **Card Comparison Tools**: Multi-card meaning analysis and interpretation
- Multi-transport MCP server (stdio, Streamable HTTP, legacy SSE)
- Advanced interpretation engine with elemental analysis
- Cryptographically secure card shuffling and drawing
- Context-aware meaning selection
- Professional-grade HTTP API with CORS support
- Docker containerization with health checks
- Comprehensive search and analytics tools
- Session management and reading history
- Full TypeScript implementation with strict typing
- Jest testing framework setup

## ✨ Features

### 🃏 Professional Tarot System
- **Modern RWS Meanings**: User-visible card keywords and meanings follow modern Rider-Waite-Smith interpretation patterns
- **Complete Rider-Waite-Smith Deck**: Comprehensive card database with detailed meanings, symbolism, astrology, and numerology
- **25 Professional Spreads**: Celtic Cross, Relationship Cross, Career Path, Spiritual Guidance, Chakra Alignment, Year Ahead, Daily Guidance, Yes/No, Weekly Forecast, Moon Phase spreads, Elemental Balance, Past Life Karma, Compatibility, and more
- **Custom Spread Creation**: AI can create unlimited custom spreads (1-15 positions) when existing spreads don't fit the specific question or context
- **Lunar Integration**: Automatic moon phase detection with themed spreads and guidance for each lunar cycle
- **AI Spread Recommendations**: Intelligent analysis of questions to recommend the most appropriate spread with confidence scoring
- **Specialized Reading Analysis**: Tailored interpretations for relationships, career, spiritual growth, and energy balancing
- **Intelligent Card Combinations**: Multi-dimensional analysis including elemental balance, suit patterns, and numerical progressions

### 🧠 Advanced Interpretation Engine
- **Context-Aware Readings**: Automatically selects relevant meanings based on question content (love, career, health, spiritual)
- **Elemental Analysis**: Fire, Water, Air, Earth balance assessment and missing element identification
- **Archetypal Patterns**: Major Arcana progression analysis and Fool's Journey insights
- **Position Dynamics**: Celtic Cross relationship analysis aligned to the registered spread positions
- **Energy Flow Assessment**: Three Card spread progression and overall reading energy analysis

### 🚀 Technical Excellence
- **Multi-Transport Support**: stdio, MCP Streamable HTTP, and legacy SSE protocols
- **Cryptographic Randomness**: Fisher-Yates shuffle with crypto-secure random number generation
- **50/50 Fair Distribution**: Equal probability for upright and reversed card orientations
- **Production Ready**: Docker containerization, health checks, and comprehensive error handling
- **Session Management**: Advanced context tracking and reading history
- **RESTful API**: Direct HTTP endpoints for seamless integration
- **Type Safety**: Full TypeScript implementation with strict typing

## 🎯 Live Reading Example

Here's what a professional Celtic Cross reading looks like:

```json
{
  "question": "What should I know about my career path this year?",
  "cards": [
    {"position": "Present Situation", "card": "The Emperor (upright)", "meaning": "Leadership opportunities and career advancement"},
    {"position": "Challenge", "card": "The Lovers (reversed)", "meaning": "Misaligned career choices or workplace conflicts"},
    {"position": "Foundation", "card": "Ace of Wands (upright)", "meaning": "Creative spark and new opportunities"},
    // ... 7 more cards
  ],
  "analysis": {
    "elementalBalance": "Strong Fire energy suggests action and creativity needed",
    "positionDynamics": "Conscious goals align with subconscious drives",
    "energyFlow": "Progression from challenge to resolution",
    "guidance": "Trust your leadership abilities while addressing relationship conflicts"
  }
}
```

**Key Features Demonstrated**:
- ✅ Context-aware interpretations (career-focused meanings)
- ✅ Position relationship analysis (conscious vs subconscious)
- ✅ Elemental balance assessment (Fire energy dominance)
- ✅ Professional guidance and actionable insights

## 🔮 Professional Tarot Spreads

Our server features **25 specialized tarot spreads** designed for different life areas and spiritual practices:

### 🔮 General Guidance
- **Single Card**: Daily guidance and quick insights
- **Three Card**: Past/Present/Future analysis with energy flow
- **Celtic Cross**: Comprehensive 10-card life analysis
- **Horseshoe**: 7-card situation guidance with obstacles and advice

### 💕 Relationships & Personal
- **Relationship Cross**: 7-card relationship dynamics analysis

### 🚀 Career & Life Path
- **Career Path**: 6-card professional development guidance
- **Decision Making**: 5-card choice evaluation and guidance
- **Year Ahead**: 13-card annual forecast with monthly insights

### 🧘 Spiritual & Energy Work
- **Spiritual Guidance**: 6-card spiritual development and higher self connection
- **Chakra Alignment**: 7-card energy center analysis and healing
- **Shadow Work**: 5-card psychological integration and growth

Each spread includes:
- **Specialized Analysis**: Tailored interpretation methods for each spread type
- **Position Dynamics**: Understanding relationships between card positions
- **Energy Assessment**: Elemental balance and flow analysis
- **Professional Guidance**: Actionable insights and spiritual wisdom

## 🏆 Why Choose This Tarot Server?

| Feature | This Server | Basic Tarot APIs | Generic Card Readers |
|---------|-------------|------------------|---------------------|
| **Modern RWS Meanings** | ✅ Contextual modern RWS meanings | ❌ Generic meanings | ❌ Simplified interpretations |
| **Advanced Analysis** | ✅ Elemental, numerical, archetypal | ❌ Basic card meanings | ❌ Single-layer interpretation |
| **Context Awareness** | ✅ Question-specific meanings | ❌ One-size-fits-all | ❌ Generic responses |
| **Professional Spreads** | ✅ Celtic Cross dynamics | ❌ Simple layouts | ❌ Basic positioning |
| **MCP Integration** | ✅ Native MCP + HTTP/SSE | ❌ HTTP only | ❌ Limited protocols |
| **Production Ready** | ✅ Docker, health checks, monitoring | ❌ Basic deployment | ❌ Development-focused |
| **Type Safety** | ✅ Full TypeScript | ❌ JavaScript only | ❌ Minimal typing |

## 🚀 Quick Start

### Local Development

1. **Clone and Install**
   ```bash
   git clone https://git.moraxcheng.me/Morax/tarot-mcp.git
   cd tarot-mcp
   npm install
   ```

2. **Build the Project**
   ```bash
   npm run build
   ```
   `npm run build` compiles TypeScript and copies `src/tarot/cards/card-data.json` into `dist/tarot/cards/card-data.json`. Do not use bare `tsc` for production builds, because the runtime loads this JSON asset next to the compiled files.

3. **Run as MCP Server (stdio)**
   ```bash
   npm start
   # or
   node dist/index.js
   ```

4. **Run as HTTP Server**
   ```bash
   npm run start:http
   # or
   node dist/index.js --transport http --port 3000
   ```

5. **Development Mode**
   ```bash
   npm run dev:http  # HTTP server with hot reload
   npm run dev       # stdio server with hot reload
   ```

### Docker Deployment

1. **Quick Deploy with Script**
   ```bash
   chmod +x deploy.sh
   ./deploy.sh
   ```

2. **Manual Docker Build**
   ```bash
   npm run docker:build
   npm run docker:run
   ```

3. **Docker Compose**
   ```bash
   npm run docker:compose
   # or
   docker compose up -d
   ```

## 📡 API Endpoints

When running in HTTP mode, the following endpoints are available:

### Health & Info
- `GET /health` - Health check with service status
- `GET /api/info` - Server information, capabilities, and available tools

### Tarot Cards
- `GET /api/cards` - List all cards with filtering options
  - `?category=all|major_arcana|minor_arcana|wands|cups|swords|pentacles`
- `GET /api/cards/:cardName` - Get detailed card information
  - `?orientation=upright|reversed` (default: upright)

### Professional Readings
- `POST /api/reading` - Perform a comprehensive tarot reading
  ```json
  {
    "spreadType": "single_card|three_card|celtic_cross|...",
    "question": "Your specific question here",
    "sessionId": "optional - use the Session ID returned by a previous reading"
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
    "sessionId": "optional - use the Session ID returned by a previous reading"
  }
  ```
- `GET /api/spreads` - List all available spread types with descriptions

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

## 🛠️ MCP Tools

The server provides **14 MCP tools**. The authoritative, always-current
catalog (schemas, annotations, output schemas) is served by the protocol
itself — call `tools/list` over MCP, or `GET /api/info` over HTTP.

| Tool | Purpose |
| --- | --- |
| `get_card_info` | Full card detail (meanings, symbolism, astrology) |
| `list_all_cards` | Card catalog, filterable by category |
| `list_available_spreads` | Spread catalog with positions |
| `perform_reading` | Reading with a built-in spread (session-aware) |
| `create_custom_spread` | Reading with a user-defined spread |
| `get_daily_card` | One-shot daily guidance draw |
| `get_moon_phase_reading` | Lunar-phase-aligned reading |
| `search_cards` | Multi-criteria card search |
| `find_similar_cards` | Cards with related meanings |
| `get_random_cards` | Random draws with filters |
| `recommend_spread` | Spread recommendation for a question |
| `get_card_meanings_comparison` | Compare 2-5 cards in a context |
| `get_database_analytics` | Card-database statistics |
| `get_session_history` | Summaries of a session's readings |

Reading and lookup tools accept `language: "en" | "zh"` (default `en`) for
fully localized Simplified Chinese output. Reading tools additionally
return machine-readable `structuredContent` (reading id, session id,
drawn cards) beside the Markdown text.

The server also exposes MCP **resources** (`tarot://cards`,
`tarot://cards/{id}`, `tarot://spreads`, `tarot://spreads/{type}`) and
**prompts** (`perform-reading`, `daily-draw`).


## 🔧 Configuration

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

| Variable | Purpose |
| --- | --- |
| `PORT` / `HOST` | HTTP listener port and bind address |
| `MCP_AUTH_TOKEN` | When set, all MCP/REST endpoints require `Authorization: Bearer <token>` (`/health` stays open). **Set this for any public deployment.** |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed beyond localhost (`*` allows any) |
| `ALLOWED_HOSTS` | When set, requests must carry one of these Host headers |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | Rate limit per IP (default 120 requests / 60s) |
| `MCP_MAX_TRANSPORT_SESSIONS` | Cap on concurrent transport sessions per transport (default 100) |
| `SESSION_STORE_PATH` | When set, reading sessions persist to this JSON file and survive restarts/redeploys (24h idle expiry still applies). Docker Compose enables it by default (`/data/sessions.json` on a named volume); without it sessions are memory-only and a restart invalidates existing sessionIds. |
| `LOG_LEVEL` / `LOG_FORMAT` | `debug|info|warn|error` (default info); `json` for JSON-lines logs. Logs always go to stderr. |


## 🎯 MCP Client Integration

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

## 📚 Usage Examples

### Professional Reading Examples

#### Single Card Daily Guidance
```bash
curl -X POST http://localhost:3000/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadType": "single_card",
    "question": "What energy should I embrace today?"
  }'
```
**Features**: Elemental analysis, daily guidance, spiritual insights

#### Three Card Relationship Reading
```bash
curl -X POST http://localhost:3000/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadType": "three_card",
    "question": "How can I improve my relationships?"
  }'
```
**Features**: Past/Present/Future flow, energy progression analysis

#### Celtic Cross Career Reading
```bash
curl -X POST http://localhost:3000/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadType": "celtic_cross",
    "question": "What should I know about my career path this year?"
  }'
```
**Features**: 10-card comprehensive analysis, position dynamics, conscious vs subconscious insights

#### Relationship Cross Analysis
```bash
curl -X POST http://localhost:3000/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadType": "relationship_cross",
    "question": "How can I improve my relationship with my partner?"
  }'
```
**Features**: 7-card relationship dynamics, compatibility assessment, unity/division analysis

#### Career Path Guidance
```bash
curl -X POST http://localhost:3000/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadType": "career_path",
    "question": "What should I know about my career development?"
  }'
```
**Features**: 6-card professional analysis, skills assessment, opportunity identification

#### Chakra Energy Alignment
```bash
curl -X POST http://localhost:3000/api/reading \
  -H "Content-Type: application/json" \
  -d '{
    "spreadType": "chakra_alignment",
    "question": "How can I balance my energy centers?"
  }'
```
**Features**: 7-card chakra analysis, energy balance assessment, spiritual healing guidance

#### Custom Spread Creation
```bash
curl -X POST http://localhost:3000/api/custom-spread \
  -H "Content-Type: application/json" \
  -d '{
    "spreadName": "AI Decision Making Spread",
    "description": "A custom spread designed to help AI make decisions when no existing spread fits the situation",
    "positions": [
      {
        "name": "Current Situation",
        "meaning": "The present state of affairs that needs to be addressed"
      },
      {
        "name": "Hidden Influences",
        "meaning": "Unseen factors affecting the situation"
      },
      {
        "name": "Option A",
        "meaning": "One potential direction or choice"
      },
      {
        "name": "Option B",
        "meaning": "An alternative direction or choice"
      },
      {
        "name": "Guidance",
        "meaning": "Wisdom and advice for making the best decision"
      }
    ],
    "question": "What is the best approach for creating a new tarot spread when existing ones don'\''t fit?"
  }'
```
**Features**: Unlimited custom spread creation (1-15 positions), AI-driven card drawing, position-specific interpretations

### Card Information Queries

#### Detailed Card Information
```bash
curl "http://localhost:3000/api/cards/The%20Fool?orientation=upright"
```

#### Browse Cards by Category
```bash
curl "http://localhost:3000/api/cards?category=major_arcana"
curl "http://localhost:3000/api/cards?category=wands"
```

#### List Available Spreads
```bash
curl "http://localhost:3000/api/spreads"
```

### Advanced Search and Analytics

The `/mcp` endpoint is a full MCP Streamable HTTP transport. Raw HTTP clients must first send an `initialize` request, keep the returned `mcp-session-id`, then send `notifications/initialized` before calling tools. MCP clients handle this automatically.

#### Search Cards by Keyword
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <initialized-session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_cards",
      "arguments": {
        "keyword": "love",
        "suit": "cups",
        "limit": 5
      }
    }
  }'
```

#### Find Similar Cards
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <initialized-session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "find_similar_cards",
      "arguments": {
        "cardName": "The Lovers",
        "limit": 3
      }
    }
  }'
```

#### Get Database Analytics
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <initialized-session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_database_analytics",
      "arguments": {
        "includeRecommendations": true
      }
    }
  }'
```

#### Get Random Cards for Practice
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Accept: application/json, text/event-stream" \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: <initialized-session-id>" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "get_random_cards",
      "arguments": {
        "count": 3,
        "arcana": "major"
      }
    }
  }'
```

## 🏗️ Architecture

### Professional Tarot Engine
```
src/
├── index.ts              # CLI entry point for stdio or HTTP transport
├── mcp/
│   ├── protocol-server.ts # Shared MCP protocol server and tool handlers
│   ├── http-server.ts     # Streamable HTTP, legacy SSE, and REST endpoints
│   └── tarot-service.ts   # MCP tool orchestration over tarot domain services
└── tarot/
    ├── cards/            # Card data, loading, search, and analytics
    ├── readings/         # Spreads, lunar utilities, readings, and sessions
    └── shared/           # Types, validation, and secure randomness
```

### Key Components

#### Advanced Interpretation Engine
- **Multi-Dimensional Analysis**: Individual cards + combinations + overall themes
- **Modern RWS Methods**: Based on Rider-Waite-Smith card structure, imagery, and modern contextual reading patterns
- **Context Awareness**: Question-specific meaning selection (love, career, health, spiritual)
- **Elemental Analysis**: Fire, Water, Air, Earth balance and missing element identification

#### Production-Ready Infrastructure
- **Multi-Transport Support**: stdio, MCP Streamable HTTP, legacy SSE, and HTTP REST helpers
- **Docker Containerization**: Complete deployment with health checks and monitoring
- **Error Handling**: Comprehensive error responses and logging
- **Type Safety**: Full TypeScript implementation with strict mode

## 🧪 Testing & Quality Assurance

### Test Suite
```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Code quality checks
npm run lint
npm run format
```

### Quality Metrics
- **Unit Tests**: Card manager, reading logic, and interpretation engine
- **Integration Tests**: API endpoints and MCP tool functionality
- **Type Safety**: 100% TypeScript with strict mode enabled
- **Code Coverage**: Comprehensive test coverage for core functionality
- **Modern RWS Validation**: Interpretations are tested against modern RWS semantic anchors and card imagery checks

### Research Validation
- **Accuracy Verification**: Data tests verify deck order, schema strictness, modern RWS anchors, and card imagery references
- **RWS Compliance**: Adherence to the 78-card Rider-Waite-Smith deck structure
- **Professional Standards**: Implementation of methods used by certified tarot readers
- **Symbolic Integrity**: Proper interpretation of traditional symbols and imagery

## 🚢 Deployment

### Production Deployment

1. **Build for production**
   ```bash
   npm run build
   node scripts/verify-build-assets.mjs
   ```

2. **Run with PM2 (recommended)**
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name tarot-mcp -- --transport http --port 3000
   ```

3. **Or use Docker**
   ```bash
   docker run -d -p 3000:3000 --name tarot-mcp tarot-mcp
   ```

### Reverse Proxy Setup

Example Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

We welcome contributions to improve the Tarot MCP Server! Here's how you can help:

### 🎯 Priority Areas
1. **Enhanced Interpretations**: Deeper psychological analysis and Jungian insights
2. **Timing Predictions**: Advanced timing predictions and seasonal influences
3. **Internationalization**: Support for multiple languages and cultural variations
4. **Visual Integration**: Card imagery and visual representation support
5. **Mobile Integration**: React Native or Flutter SDK development

### 📋 Contribution Process
1. **Fork the repository** and create a feature branch
2. **Keep meanings modern RWS** - User-visible card meanings must remain aligned with modern Rider-Waite-Smith semantics
3. **Maintain quality** - Follow TypeScript best practices and include comprehensive tests
4. **Document changes** - Update README and add examples for new features
5. **Submit pull request** with detailed description and test coverage

### 🔬 Research Standards
- **Primary Basis**: Rider-Waite-Smith deck structure, card imagery, and modern RWS semantic anchors
- **Verification**: Update `modern-rws-fixtures.ts` and data integrity tests when card meanings change
- **RWS Accuracy**: Maintain adherence to the 78-card Rider-Waite-Smith deck and modern interpretation language
- **Professional Language**: Use authentic tarot terminology and phrasing

### 🧪 Testing Requirements
- **Unit Tests**: All new functionality must include comprehensive tests
- **Integration Tests**: API endpoints and MCP tool validation
- **Type Safety**: Maintain 100% TypeScript coverage with strict mode
- **Documentation**: Include usage examples and API documentation

## 🗺️ Roadmap

### 📅 Version 2.0 (Planned)
- **Enhanced Interpretations**: Deeper psychological analysis and Jungian insights
- **Timing Predictions**: Seasonal influences and time-based guidance
- **Enhanced AI**: Machine learning for pattern recognition in readings
- **Visual Integration**: Card imagery and interactive visual representations

### 📅 Version 2.5 (Future)
- **Multi-Language Support**: Internationalization for global accessibility
- **Cultural Variations**: Support for different tarot traditions and interpretations
- **Advanced Analytics**: Reading history analysis and personal growth tracking
- **Mobile SDK**: Native mobile application support

### 📅 Version 3.0 (Vision)
- **Psychological Integration**: Advanced Jungian analysis and psychological tarot methods
- **Real-Time Collaboration**: Shared readings and collaborative interpretation
- **AI-Enhanced Insights**: Advanced pattern recognition and personalized guidance
- **Blockchain Integration**: Decentralized reading verification and authenticity

## 🔮 About This Modern RWS Tarot Implementation

### Modern RWS Accuracy
This server implements the Rider-Waite-Smith tarot deck with modern user-visible interpretations:

- **Modern RWS Semantics**: Card meanings use contemporary keywords and context-specific explanations
- **RWS Imagery**: Descriptions and symbolism stay grounded in recognizable Rider-Waite-Smith card art
- **Historical Awareness**: Classical correspondences inform metadata without overriding modern user-visible meanings
- **Reader Methods**: Advanced combination interpretation techniques for context-aware readings

### Comprehensive Card Database
**✅ COMPLETE**: All 78 cards of the Rider-Waite-Smith deck are fully implemented with extensive information for each card:

- **Multi-Context Meanings**: General, love, career, health, and spiritual interpretations
- **Orientation Specific**: Detailed upright and reversed meanings beyond simple opposites
- **Symbolic Analysis**: Comprehensive interpretation of Rider-Waite-Smith imagery
- **Astrological Correspondences**: Planetary and zodiacal associations
- **Numerological Significance**: Spiritual and practical number meanings
- **Elemental Associations**: Fire, Water, Air, Earth energies and their interactions

### Advanced Reading Methods
- **Celtic Cross Dynamics**: Professional 10-card analysis with position relationships
- **Three Card Flow**: Energy progression and temporal analysis
- **Elemental Balance**: Missing element identification and recommendations
- **Archetypal Patterns**: Major Arcana progression and spiritual themes
- **Context Awareness**: Question-specific meaning selection and relevance

### Professional Quality
The interpretations maintain traditional tarot wisdom while providing:
- **Authentic Language**: Professional tarot terminology and phrasing
- **Actionable Guidance**: Practical advice combined with spiritual insights
- **Depth and Nuance**: Multi-layered analysis beyond surface meanings
- **Accessibility**: Clear explanations suitable for both beginners and experienced readers
