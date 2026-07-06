# ---- Stage 1: Build ----
# Pinned digest for reproducible builds (node:22-alpine as of 2026-07).
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS builder

# Set working directory
WORKDIR /app

# Install all dependencies (including devDependencies needed for the build).
# --ignore-scripts: the `prepare` script would run the build before sources
# are copied; the build is invoked explicitly below.
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source code and build
COPY . .
RUN npm run build

# ---- Stage 2: Runtime ----
FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime

# Set working directory
WORKDIR /app

# Install production dependencies only (--ignore-scripts: no devDeps here,
# so the `prepare` build script cannot run)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built output from the builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S tarot -u 1001

# Change ownership of the app directory
RUN chown -R tarot:nodejs /app
USER tarot

# Expose port 3000
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Default command - HTTP server (serves Streamable HTTP at /mcp and legacy SSE at /sse)
CMD ["node", "dist/index.js", "--transport", "http", "--port", "3000"]
