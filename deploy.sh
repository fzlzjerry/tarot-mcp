#!/bin/bash

# Run from the repository root. Compose reads the operator's local .env.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Install Docker first." >&2
    exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 or newer is required." >&2
    exit 1
fi
if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required for the local health probe." >&2
    exit 1
fi

compose=(docker compose -f docker-compose.yml -f docker-compose.tunnel.yml)
# Validate required variables without logging the resolved configuration/secrets.
"${compose[@]}" config --quiet

echo "Building and starting the private tarot service and official tunnel..."
if ! "${compose[@]}" up -d --build; then
    echo "Container startup failed. Recent service logs:" >&2
    "${compose[@]}" logs --no-color --tail 60 tarot-mcp tunnel-client
    exit 1
fi

echo "Waiting for tarot health..."
deadline=$((SECONDS + 60))
until curl -fsS --max-time 2 http://127.0.0.1:3000/health >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
        echo "Tarot /health did not become ready within 60 seconds." >&2
        "${compose[@]}" logs --no-color --tail 60 tarot-mcp
        exit 1
    fi
    sleep 2
done

echo "Tarot is healthy. Waiting for tunnel readiness..."
deadline=$((SECONDS + 120))
until "${compose[@]}" exec -T tarot-mcp node -e "fetch('http://tunnel-client:8080/readyz', {signal: AbortSignal.timeout(1500)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
    if (( SECONDS >= deadline )); then
        echo "Tarot is healthy, but tunnel /readyz did not become ready within 120 seconds." >&2
        "${compose[@]}" logs --no-color --tail 60 tunnel-client
        exit 1
    fi
    sleep 2
done

echo "Tarot and the private tunnel are ready. ChatGPT discovery still needs verification."
echo "Local Web: http://127.0.0.1:3000/draw/ (or your own SSH local forwarding)."
echo "Create or refresh your private Tunnel connection in https://chatgpt.com/plugins, then open a new conversation."
