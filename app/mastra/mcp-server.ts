/**
 * UpSight MCP Server — Customer Intelligence for AI Agents
 *
 * Exposes intelligence read tools (Phase 1) and CRM write tools (Phase 2)
 * via stdio transport.
 * Authenticates via UPSIGHT_API_KEY env var, resolving project/account context
 * from the hashed key at startup.
 *
 * Usage (Claude Desktop / Cursor):
 *   {
 *     "mcpServers": {
 *       "upsight": {
 *         "command": "npx",
 *         "args": ["tsx", "<path>/app/mastra/mcp-server.ts"],
 *         "env": {
 *           "SUPABASE_URL": "...",
 *           "SUPABASE_SERVICE_ROLE_KEY": "...",
 *           "OPENAI_API_KEY": "...",
 *           "UPSIGHT_API_KEY": "upsk_..."
 *         }
 *       }
 *     }
 *   }
 */

import { MCPServer } from "@mastra/mcp";
import consola from "consola";

// Phase 1: Intelligence Read Tools
import { semanticSearchEvidenceTool } from "./tools/semantic-search-evidence";
import { fetchEvidenceTool } from "./tools/fetch-evidence";
import { fetchThemesTool } from "./tools/fetch-themes";
import { fetchPeopleDetailsTool } from "./tools/fetch-people-details";
import { fetchSurveysTool } from "./tools/fetch-surveys";
import { searchSurveyResponsesTool } from "./tools/search-survey-responses";
import { fetchInterviewContextTool } from "./tools/fetch-interview-context";
import { fetchPersonasTool } from "./tools/fetch-personas";
import { fetchSegmentsTool } from "./tools/fetch-segments";
import { semanticSearchPeopleTool } from "./tools/semantic-search-people";
import { fetchProjectStatusContextTool } from "./tools/fetch-project-status-context";

// Phase 2: CRM Write Tools
import { upsertPersonTool } from "./tools/upsert-person";
import { managePeopleTool } from "./tools/manage-people";
import { createTaskTool, updateTaskTool, deleteTaskTool } from "./tools/manage-tasks";
import { markTaskCompleteTool } from "./tools/mark-task-complete";
import { manageAnnotationsTool } from "./tools/manage-annotations";

// Workflows
import { dailyBriefWorkflow } from "./workflows/daily-brief";

// Auth
import { resolveApiKey } from "../lib/api-keys.server";
import { createSupabaseAdminClient } from "../lib/supabase/client.server";

// ---------------------------------------------------------------------------
// Phase 1 tool registry
// ---------------------------------------------------------------------------

const PHASE_1_TOOLS = {
	semantic_search_evidence: semanticSearchEvidenceTool,
	fetch_evidence: fetchEvidenceTool,
	fetch_themes: fetchThemesTool,
	fetch_people_details: fetchPeopleDetailsTool,
	fetch_surveys: fetchSurveysTool,
	search_survey_responses: searchSurveyResponsesTool,
	fetch_interview_context: fetchInterviewContextTool,
	fetch_personas: fetchPersonasTool,
	fetch_segments: fetchSegmentsTool,
	semantic_search_people: semanticSearchPeopleTool,
	fetch_project_status: fetchProjectStatusContextTool,
} as const;

// ---------------------------------------------------------------------------
// Phase 2 tool registry (CRM write operations)
// ---------------------------------------------------------------------------

const PHASE_2_TOOLS = {
	upsert_person: upsertPersonTool,
	manage_people: managePeopleTool,
	create_task: createTaskTool,
	update_task: updateTaskTool,
	delete_task: deleteTaskTool,
	mark_task_complete: markTaskCompleteTool,
	manage_annotations: manageAnnotationsTool,
} as const;

// ---------------------------------------------------------------------------
// API Key resolution (stdio transport)
// ---------------------------------------------------------------------------

interface McpContext {
	accountId: string;
	projectId: string;
	scopes: string[];
}

async function resolveStdioApiKey(): Promise<McpContext | null> {
	const rawKey = process.env.UPSIGHT_API_KEY;
	if (!rawKey) {
		consola.warn("[mcp-server] UPSIGHT_API_KEY not set — tools will require explicit project_id in input");
		return null;
	}

	const supabase = createSupabaseAdminClient();
	const resolved = await resolveApiKey(supabase, rawKey);

	if (!resolved) {
		consola.error("[mcp-server] UPSIGHT_API_KEY is invalid, revoked, or expired");
		process.exit(1);
	}

	consola.info("[mcp-server] API key resolved", {
		projectId: resolved.projectId,
		accountId: resolved.accountId,
		scopes: resolved.scopes,
	});

	return {
		accountId: resolved.accountId,
		projectId: resolved.projectId,
		scopes: resolved.scopes,
	};
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

export async function startMCPServer() {
	// Resolve API key context once at startup (stdio = single session)
	const apiKeyContext = await resolveStdioApiKey();

	const allTools = { ...PHASE_1_TOOLS, ...PHASE_2_TOOLS };

	const server = new MCPServer({
		id: "upsight-intelligence",
		name: "UpSight Intelligence",
		version: "1.1.0",
		tools: allTools,
		workflows: {
			dailyBriefWorkflow,
		},
	});

	// If API key resolved, inject project/account into requestContext
	// so tools can access them via context?.requestContext?.get("project_id")
	if (apiKeyContext) {
		const originalStartStdio = server.startStdio.bind(server);
		// Mastra MCPServer supports context injection via the server instance.
		// For stdio, we set default request context that all tool calls inherit.
		if (typeof (server as any).setDefaultContext === "function") {
			(server as any).setDefaultContext({
				project_id: apiKeyContext.projectId,
				account_id: apiKeyContext.accountId,
			});
		} else {
			// Fallback: set env vars that tools can read as context
			process.env.__MCP_PROJECT_ID = apiKeyContext.projectId;
			process.env.__MCP_ACCOUNT_ID = apiKeyContext.accountId;
			consola.debug("[mcp-server] Set context via env vars (MCPServer.setDefaultContext not available)");
		}
	}

	await server.startStdio();
	consola.info(`[mcp-server] UpSight Intelligence started on stdio (${Object.keys(allTools).length} tools: ${Object.keys(PHASE_1_TOOLS).length} read + ${Object.keys(PHASE_2_TOOLS).length} write)`);
}

// For direct execution
if (require.main === module) {
	startMCPServer().catch((err) => {
		consola.error("[mcp-server] Fatal startup error", err);
		process.exit(1);
	});
}
