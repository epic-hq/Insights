# @getupsight/mcp-server

Connect AI agents (Claude Desktop, Cursor, etc.) to your UpSight customer intelligence.

## Setup

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "upsight": {
      "command": "node",
      "args": ["/path/to/Insights/packages/mcp-server/dist/index.js"],
      "env": {
        "UPSIGHT_API_KEY": "upsk_...",
        "UPSIGHT_URL": "http://localhost:4280"
      }
    }
  }
}
```

Once published to npm:

```json
{
  "mcpServers": {
    "upsight": {
      "command": "npx",
      "args": ["-y", "@getupsight/mcp-server"],
      "env": {
        "UPSIGHT_API_KEY": "upsk_..."
      }
    }
  }
}
```

## How it works

This is a thin stdio-to-HTTP proxy. All logic runs on `getupsight.com`. The package:

1. Reads `UPSIGHT_API_KEY` from env
2. Connects to the hosted MCP server over SSE
3. Proxies stdio (from Claude Desktop) to HTTP (to the server)

## Available tools (18)

**Read**: semantic_search_evidence, fetch_evidence, fetch_themes, fetch_people_details, fetch_surveys, search_survey_responses, fetch_interview_context, fetch_personas, fetch_segments, semantic_search_people, fetch_project_status

**Write**: upsert_person, manage_people, create_task, update_task, delete_task, mark_task_complete, manage_annotations

## Development

```bash
npm run build    # Build with tsup
npm run dev      # Watch mode
```
