# AgentCRM.dev — OpenClaw Distribution Strategy

## Overview

AgentCRM is an MCP server that gives AI agents CRUD access to CRM data (people, organizations, opportunities). This document outlines the strategy for distributing it via OpenClaw and other agent directories.

## Free Tier

| Resource | Free Limit | Pro Limit |
|----------|-----------|-----------|
| People | 100 records | Unlimited |
| Organizations | 50 records | Unlimited |
| Opportunities | 25 records | Unlimited |
| API calls/day | 100 | 10,000 |
| Projects | 1 | Unlimited |

Free tier is generous enough for solo founders, small teams, and evaluation — the goal is frictionless adoption.

## API Key Architecture

### Key Format
```
agentcrm_live_sk_<random32chars>
agentcrm_test_sk_<random32chars>
```

### Key Provisioning Flow
1. User signs up at AgentCRM.dev (or UpSight)
2. Dashboard generates API key scoped to their account + project
3. Key is stored hashed in `api_keys` table
4. User adds key to their MCP config as `AGENTCRM_API_KEY`

### Key Resolution (Server-Side)
```
AGENTCRM_API_KEY → lookup in api_keys table → resolve (account_id, project_id, tier, rate_limits)
```

This replaces the raw `SUPABASE_SERVICE_ROLE_KEY` — users never see our Supabase credentials.

### Implementation
- New `api_keys` table: `id, key_hash, account_id, project_id, tier, daily_limit, created_at, last_used_at, revoked_at`
- Middleware in MCP server: validate key, resolve context, enforce rate limits
- Usage tracking: increment counter per key per day in `api_key_usage` table

## OpenClaw Listing

### Listing Metadata
```yaml
name: AgentCRM
tagline: "Give your AI agents a CRM"
category: Productivity / CRM
transport: stdio
tools: 16
entities: People, Organizations, Opportunities
free_tier: true
```

### Listing Description

> **AgentCRM** turns any AI agent into a CRM operator. Create contacts, track deals, manage organizations — all through natural language via MCP.
>
> **16 tools** cover the full CRUD lifecycle:
> - **People**: Create, search, update, delete contacts with auto-org linking
> - **Organizations**: Manage companies with industry, size, and contact tracking
> - **Opportunities**: Track your pipeline from Discovery to Closed Won
>
> **Agent-friendly by design**: Rich tool descriptions, safety guards (name confirmation for deletes, dry-run mode), timing metrics, and pagination.
>
> **Free tier**: 100 people, 50 orgs, 25 opportunities. No credit card.

### Tags
`crm`, `sales`, `contacts`, `pipeline`, `mcp`, `supabase`, `agent-tools`

## Promotion Strategy

### Phase 1: Launch (Week 1-2)
1. **OpenClaw listing** — submit with README, tool docs, and demo video
2. **Anthropic MCP directory** — if they have a submission process
3. **GitHub** — public repo with good README, tagged release `v0.1.0`
4. **Twitter/X thread** — demo GIF showing Claude Code managing CRM data
5. **r/ClaudeAI + r/LocalLLaMA** — "I built a CRM that any AI agent can use"

### Phase 2: Community (Week 3-4)
1. **Blog post**: "Why your AI agent needs a CRM" — positioning piece
2. **YouTube demo**: 5-min walkthrough showing real use cases
3. **Discord**: Post in MCP/Claude/AI agent communities
4. **Integration examples**: Show with Claude Code, Cursor, Windsurf configs

### Phase 3: Ecosystem (Month 2+)
1. **Agent directory listings**: Register tools in emerging agent directories
2. **Partner integrations**: Approach other MCP server authors for cross-referencing
3. **Template library**: Pre-built CRM workflows (lead qualification, pipeline review)
4. **SSE transport**: HTTP endpoint for web-based agent systems

## Agent Personalities as CRM Entities

### Concept

Expose UpSight's specialized agents as **discoverable personalities** within the CRM. When an external agent connects via MCP, they can:

1. **Discover available specialists**: "Who can help me analyze customer feedback?"
2. **Route queries**: "Ask the research agent about competitor positioning"
3. **Get recommendations**: "Based on this pipeline, which agent should I consult?"

### Implementation: `list_agents` Tool

```typescript
{
  name: "list_agents",
  description: "Discover available specialist agents and their capabilities",
  inputSchema: {
    type: "object",
    properties: {
      capability: {
        type: "string",
        description: "Filter by capability (e.g. 'research', 'insights', 'feedback')"
      }
    }
  }
}
```

Returns:
```json
{
  "agents": [
    {
      "id": "insights-agent",
      "name": "Insights Analyst",
      "capabilities": ["evidence analysis", "theme extraction", "pattern recognition"],
      "description": "Surfaces insights from customer conversations",
      "available": true
    },
    {
      "id": "research-agent",
      "name": "Research Assistant",
      "capabilities": ["web research", "competitor analysis", "market sizing"],
      "description": "Conducts research and validates hypotheses",
      "available": true
    }
  ]
}
```

### Advantages vs Agent Directories

| Factor | Agent Personality (in CRM) | External Directory |
|--------|---------------------------|-------------------|
| **Context** | Agent already has your CRM data | Must share context externally |
| **Trust** | Same security boundary | Cross-trust-boundary |
| **Latency** | Local tool call | Network hop + auth |
| **Discovery** | Automatic with CRM connection | Separate lookup |
| **Integration** | Works today via MCP | Requires directory API |

### Recommendation

**Do both.** Expose agent personalities via a `list_agents` tool for CRM-connected users, AND list AgentCRM in external directories for discoverability. The CRM becomes the "team Slack" for agents — a place where specialists can be found and consulted, with full customer context already loaded.

External directories (like OpenClaw) handle **discovery** ("find an agent that can manage CRM data"), while agent personalities handle **collaboration** ("within my CRM, who can help me analyze this deal?").

## Competitive Landscape

### Existing Agent Directories
- **OpenClaw** — MCP server discovery
- **Glama.ai** — AI tool marketplace
- **Composio** — Agent tool integrations
- **AgentOps** — Agent monitoring (not a directory)

### CRM-Adjacent MCP Servers
- Most existing MCP servers focus on dev tools (GitHub, databases, file systems)
- CRM is an **underserved category** in the MCP ecosystem
- First-mover advantage is significant

## Success Metrics

| Metric | Month 1 Target | Month 3 Target |
|--------|----------------|----------------|
| API keys created | 50 | 500 |
| Daily active keys | 10 | 100 |
| OpenClaw page views | 1,000 | 5,000 |
| GitHub stars | 25 | 200 |
| Paid conversions | 2 | 20 |
