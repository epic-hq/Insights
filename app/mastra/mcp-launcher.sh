#!/bin/bash
# MCP Server launcher for Claude Desktop / Cursor
# Ensures correct working directory so tsx resolves tsconfig paths (~/)

DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$DIR"

# Load .env
set -a
source "$DIR/.env" 2>/dev/null
set +a

# Use project-local tsx + node
exec "$DIR/node_modules/.bin/tsx" "$DIR/app/mastra/mcp-server.ts"
