# AgentCRM.dev — MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that gives AI agents full CRUD access to your CRM data — **people, organizations, and opportunities**.

Works with **Claude Code**, **Claude Desktop**, **OpenAI agents**, **Cursor**, **Windsurf**, and any MCP-compatible system.

## What's Inside

**16 tools** across 3 entities:

| Entity | Tools |
|--------|-------|
| **People** | `list_people`, `get_person`, `create_person`, `update_person`, `delete_person`, `search_people` |
| **Organizations** | `list_organizations`, `get_organization`, `create_organization`, `update_organization`, `delete_organization` |
| **Opportunities** | `list_opportunities`, `get_opportunity`, `create_opportunity`, `update_opportunity`, `delete_opportunity` |

Every tool includes:
- Rich descriptions for agent comprehension
- Safety features: name/title confirmation for deletes, dry-run mode
- Timing data (`_duration_ms`) on every response
- Pagination support (`limit` + `offset`)
- Automatic organization linking (create a person with `company: "Acme"` and it auto-creates/links the org)

## Quick Start

### 1. Prerequisites

- Node.js 18+
- A Supabase project with the UpSight schema
- Service role key (for server-side access)

### 2. Build

```bash
cd mcp-servers/agent-crm
npm install
npm run build
```

### 3. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (NOT the anon key) |
| `AGENTCRM_ACCOUNT_ID` | No | Default account ID (can pass per-call) |
| `AGENTCRM_PROJECT_ID` | No | Default project ID (can pass per-call) |

### 4. Run

```bash
node dist/index.js
```

The server communicates over **stdio** (stdin/stdout), following the MCP standard.

## Integration Guides

### Claude Code

Add to your project's `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "agent-crm": {
      "command": "node",
      "args": ["./mcp-servers/agent-crm/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "AGENTCRM_ACCOUNT_ID": "your-account-uuid",
        "AGENTCRM_PROJECT_ID": "your-project-uuid"
      }
    }
  }
}
```

Then in Claude Code, you can say things like:
- "List all people in the CRM"
- "Create a new organization called Acme Corp in the healthcare industry"
- "Find opportunities in the Proposal stage"
- "Update Jane's title to VP of Engineering"

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "agent-crm": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/agent-crm/dist/index.js"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "AGENTCRM_ACCOUNT_ID": "your-account-uuid",
        "AGENTCRM_PROJECT_ID": "your-project-uuid"
      }
    }
  }
}
```

### Cursor / Windsurf

Add to `.cursor/mcp.json` or `.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "agent-crm": {
      "command": "node",
      "args": ["./mcp-servers/agent-crm/dist/index.js"],
      "env": {
        "SUPABASE_URL": "...",
        "SUPABASE_SERVICE_ROLE_KEY": "...",
        "AGENTCRM_ACCOUNT_ID": "...",
        "AGENTCRM_PROJECT_ID": "..."
      }
    }
  }
}
```

### OpenAI / Other Agent Systems

For systems that support MCP via stdio transport, the pattern is the same — point to the built `dist/index.js` and provide env vars.

For systems that require HTTP/SSE transport, you'll need an MCP-to-HTTP bridge (e.g., `mcp-proxy` or a custom wrapper). SSE transport support is planned for a future release.

## API Key Architecture (Planned)

For production multi-tenant usage, we plan to support API keys that:

1. **Scope access** to a specific `account_id` + `project_id` pair
2. **Rate limit** by tier (free: 100 ops/day, pro: 10,000 ops/day)
3. **Audit log** all operations with the key identity
4. **Free tier**: Up to 100 people, 50 organizations, 25 opportunities

The API key would replace the `SUPABASE_SERVICE_ROLE_KEY` env var, routing through a proxy that enforces limits and scoping.

## Running Integration Tests

Tests run against a live Supabase instance, creating and cleaning up test records:

```bash
# Set env vars first
export SUPABASE_URL="..."
export SUPABASE_SERVICE_ROLE_KEY="..."
export AGENTCRM_ACCOUNT_ID="..."
export AGENTCRM_PROJECT_ID="..."

# Run tests
npx tsx src/test-integration.ts
```

Output includes timing per operation and summary statistics:

```
Results: 18 passed, 0 failed, 18 total
Timing:  1245ms total, 69ms avg per operation

Timing by entity:
  create          312ms total, 104ms avg (3 ops)
  list            189ms total, 63ms avg (3 ops)
  get             156ms total, 52ms avg (3 ops)
  update          201ms total, 67ms avg (3 ops)
  delete          387ms total, 64ms avg (6 ops)
```

## Tool Reference

### People

#### `list_people`
List contacts with optional search and pagination.
- `search` — case-insensitive match on name, title, email
- `limit` — 1-200 (default 50)
- `offset` — pagination offset

#### `get_person`
Get full profile by ID, including linked organization.
- `person_id` — UUID (required)

#### `create_person`
Create a new contact. Auto-links to org if `company` provided.
- `name` — full name (required)
- `title`, `role`, `company`, `primary_email`, `primary_phone`, `linkedin_url`, `website_url`, `location`, `timezone`, `segment`, `industry`, `lifecycle_stage`, `description`

#### `update_person`
Partial update — only provided fields change.
- `person_id` — UUID (required)
- All fields from `create_person` are optional

#### `delete_person`
Delete with safety checks. Requires name confirmation.
- `person_id` — UUID (required)
- `confirm_name` — must match person's name (required)
- `dry_run` — preview without deleting
- `force` — proceed if linked interviews exist

#### `search_people`
Cross-field search on name, title, email, role.
- `query` — search string (required)

### Organizations

#### `list_organizations`
List companies with search and pagination.
- `search` — matches name, industry, domain

#### `get_organization`
Get full details. Optionally include linked contacts.
- `organization_id` — UUID (required)
- `include_contacts` — include linked people (default: false)

#### `create_organization`
Create a company record.
- `name` — org name (required)
- `description`, `website_url`, `domain`, `industry`, `size_range`, `company_type`, `headquarters_location`, `phone`, `email`, `linkedin_url`

#### `update_organization`
Partial update on org fields.
- `organization_id` — UUID (required)

#### `delete_organization`
Delete with name confirmation. Unlinks people and opportunities.
- `organization_id` — UUID (required)
- `confirm_name` — must match (required)
- `dry_run` — preview impacts

### Opportunities

#### `list_opportunities`
List pipeline deals with filtering.
- `search` — matches title, description
- `stage` — filter by sales stage
- `kanban_status` — filter by kanban column

#### `get_opportunity`
Get deal details with resolved org and contact.
- `opportunity_id` — UUID (required)

#### `create_opportunity`
Create a pipeline deal.
- `title` — deal name (required)
- `description`, `kanban_status` (default: "Explore"), `stage`, `status`, `amount`, `currency`, `close_date`, `confidence`, `next_step`, `next_step_due`, `source`, `organization_id`, `primary_contact_id`, `owner_id`, `metadata`

#### `update_opportunity`
Partial update. Metadata is merged (not replaced).
- `opportunity_id` — UUID (required)

#### `delete_opportunity`
Delete with title confirmation.
- `opportunity_id` — UUID (required)
- `confirm_title` — must match (required)
- `dry_run` — preview

## Multi-Project Support

Every tool accepts optional `account_id` and `project_id` parameters. If not provided, they fall back to the `AGENTCRM_ACCOUNT_ID` and `AGENTCRM_PROJECT_ID` env vars. This means:

- **Single project**: Set defaults in env, never think about IDs again
- **Multi-project**: Omit env defaults, pass IDs per tool call

## Architecture

```
MCP Client (Claude, etc.)
    ↕ stdio (JSON-RPC)
AgentCRM MCP Server
    ↕ HTTPS
Supabase (PostgreSQL + RLS)
```

- **Transport**: stdio (stdin/stdout)
- **Protocol**: MCP (Model Context Protocol)
- **Database**: Supabase with Row-Level Security
- **Auth**: Service role key (admin) — all queries filter by account_id + project_id

## License

MIT
