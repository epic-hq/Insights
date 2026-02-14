import { MCPServer } from "@mastra/mcp";
import consola from "consola";
import { dailyBriefWorkflow } from "./workflows/daily-brief";

/**
 * MCP Server that exposes Mastra workflows as tools
 * This allows any MCP-compatible client (including chat interfaces) to call workflows
 */
export async function startMCPServer() {
	const server = new MCPServer({
		id: "insights-mcp-server",
		name: "insights-mcp-server",
		version: "1.0.0",
		tools: {},
		workflows: {
			dailyBriefWorkflow,
		},
	});

	await server.startStdio();
	consola.log("MCP Server started on stdio");
}

// For direct execution
if (require.main === module) {
	startMCPServer().catch(consola.error);
}
