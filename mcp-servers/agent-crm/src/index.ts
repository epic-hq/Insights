#!/usr/bin/env node
/**
 * AgentCRM.dev — MCP Server
 *
 * A Model Context Protocol server for managing CRM data (people, organizations,
 * opportunities). Designed for use with Claude, OpenAI, and any MCP-compatible
 * agent system.
 *
 * Environment variables:
 *   SUPABASE_URL              — Supabase project URL (required)
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (required)
 *   AGENTCRM_ACCOUNT_ID      — Default account ID (optional, can pass per-call)
 *   AGENTCRM_PROJECT_ID      — Default project ID (optional, can pass per-call)
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { peopleTools, handlePeopleTool } from "./tools/people.js";
import {
  organizationTools,
  handleOrganizationTool,
} from "./tools/organizations.js";
import {
  opportunityTools,
  handleOpportunityTool,
} from "./tools/opportunities.js";

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  {
    name: "agent-crm",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

const allTools = [...peopleTools, ...organizationTools, ...opportunityTools];

const PEOPLE_TOOLS = new Set(peopleTools.map((t) => t.name));
const ORG_TOOLS = new Set(organizationTools.map((t) => t.name));
const OPP_TOOLS = new Set(opportunityTools.map((t) => t.name));

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: allTools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolArgs = (args || {}) as Record<string, unknown>;

  const startMs = Date.now();

  try {
    let result: unknown;

    if (PEOPLE_TOOLS.has(name)) {
      result = await handlePeopleTool(name, toolArgs);
    } else if (ORG_TOOLS.has(name)) {
      result = await handleOrganizationTool(name, toolArgs);
    } else if (OPP_TOOLS.has(name)) {
      result = await handleOpportunityTool(name, toolArgs);
    } else {
      throw new Error(
        `Unknown tool: ${name}. Available tools: ${allTools.map((t) => t.name).join(", ")}`
      );
    }

    const durationMs = Date.now() - startMs;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { ...((result as Record<string, unknown>) || {}), _duration_ms: durationMs },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const message =
      error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { success: false, error: message, _duration_ms: durationMs },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `AgentCRM MCP server running (${allTools.length} tools available)`
  );
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
