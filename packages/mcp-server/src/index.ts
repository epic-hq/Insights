/**
 * @getupsight/mcp-server
 *
 * Thin stdio→HTTP proxy that connects Claude Desktop / Cursor
 * to the hosted UpSight MCP server.
 *
 * All logic runs on getupsight.com — this package just bridges
 * stdio transport to HTTP SSE transport with API key auth.
 *
 * Usage in claude_desktop_config.json:
 * {
 *   "mcpServers": {
 *     "upsight": {
 *       "command": "npx",
 *       "args": ["-y", "@getupsight/mcp-server"],
 *       "env": { "UPSIGHT_API_KEY": "upsk_..." }
 *     }
 *   }
 * }
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const UPSIGHT_BASE_URL = process.env.UPSIGHT_URL ?? "https://getupsight.com";
const API_KEY = process.env.UPSIGHT_API_KEY;

if (!API_KEY) {
  console.error("Error: UPSIGHT_API_KEY environment variable is required.");
  console.error(
    "Generate one at https://getupsight.com → Project Settings → API Keys",
  );
  process.exit(1);
}

async function main() {
  // Connect to the hosted UpSight MCP server over SSE
  const sseUrl = new URL("/mcp", UPSIGHT_BASE_URL);
  const sseTransport = new SSEClientTransport(sseUrl, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
      },
    },
  });

  const remoteClient = new Client({ name: "upsight-proxy", version: "0.1.0" });
  await remoteClient.connect(sseTransport);

  // Create a local stdio server that proxies to the remote
  const localServer = new Server(
    { name: "upsight", version: "0.1.0" },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Proxy tools/list
  localServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return await remoteClient.listTools();
  });

  // Proxy tools/call
  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await remoteClient.callTool({
      name: request.params.name,
      arguments: request.params.arguments,
    });
  });

  // Start local stdio transport
  const stdioTransport = new StdioServerTransport();
  await localServer.connect(stdioTransport);

  // Clean shutdown
  process.on("SIGINT", async () => {
    await localServer.close();
    await remoteClient.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
