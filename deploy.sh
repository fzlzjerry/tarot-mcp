#!/bin/bash

# Tarot MCP Server Deployment Script

set -euo pipefail

echo "🔮 Starting Tarot MCP Server deployment..."

# Check prerequisites
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose v2 is not available. Please install/upgrade Docker."
    exit 1
fi

# Rebuild and restart the services (compose builds the image itself)
echo "🐳 Building and starting services..."
docker compose down || true
docker compose up -d --build

# Poll the health endpoint instead of sleeping a fixed time
echo "⏳ Waiting for the server to become healthy..."
deadline=$((SECONDS + 60))
until curl -fsS http://localhost:3000/health > /dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
        echo "❌ Health check failed within 60s. Logs:"
        docker compose logs tarot-mcp
        exit 1
    fi
    sleep 2
done

echo "✅ Tarot MCP Server is running successfully!"
echo "🌐 Server URL: http://localhost:3000"
echo "📊 Health check: http://localhost:3000/health"
echo "📖 API info: http://localhost:3000/api/info"
echo "🎯 MCP endpoint: http://localhost:3000/mcp"
echo "📡 Legacy SSE endpoint: http://localhost:3000/sse"
echo "🎉 Deployment completed successfully!"
