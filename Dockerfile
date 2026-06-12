# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install all dependencies (including devDependencies needed for the build)
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# ---- Stage 2: Runtime ----
FROM node:22-alpine AS runtime

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

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

# Default command - run HTTP server with SSE support
CMD ["node", "dist/index.js", "--transport", "sse", "--port", "3000"]
