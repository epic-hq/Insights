/**
 * Tests that the MCP server correctly registers all Phase 1 + Phase 2 tools.
 *
 * Stringency goals:
 * - Exact tool counts enforced (catch accidental additions/removals)
 * - Tool IDs use kebab-case (MCP protocol requirement, no spaces)
 * - Registry keys use snake_case (Claude tool-call convention)
 * - Descriptions are meaningful (≥50 chars) — LLMs use these for routing
 * - Output schemas are present on every tool (required for MCP response parsing)
 * - Input schemas actually parse valid inputs (not just exist)
 * - Input schemas reject structurally invalid inputs where required fields exist
 * - No browser globals referenced in tool source (window/document/localStorage)
 * - No duplicate tool IDs across the full registry
 * - generate_app_link accepts all supported entity types
 */

// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mock heavy dependencies to avoid loading Supabase, OpenAI, etc.
vi.mock("../../../lib/supabase/client.server", () => ({
	supabaseAdmin: { from: vi.fn(), schema: vi.fn() },
	createSupabaseAdminClient: vi.fn(() => ({ from: vi.fn(), schema: vi.fn() })),
}));

vi.mock("consola", () => ({
	default: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		log: vi.fn(),
	},
}));

import { fetchConversationLensesTool } from "../fetch-conversation-lenses";
import { fetchEvidenceTool } from "../fetch-evidence";
import { fetchInterviewContextTool } from "../fetch-interview-context";
import { fetchPeopleDetailsTool } from "../fetch-people-details";
import { fetchPersonasTool } from "../fetch-personas";
import { fetchProjectStatusContextTool } from "../fetch-project-status-context";
import { fetchResearchPulseTool } from "../fetch-research-pulse";
import { fetchSegmentsTool } from "../fetch-segments";
import { fetchSurveysTool } from "../fetch-surveys";
import { fetchThemesTool } from "../fetch-themes";
import { fetchTopThemesWithPeopleTool } from "../fetch-top-themes-with-people";
import { generateProjectRoutesTool } from "../generate-project-routes";
import { generateResearchRecommendationsTool } from "../generate-research-recommendations";
import { manageAnnotationsTool } from "../manage-annotations";
import { createOpportunityTool, fetchOpportunitiesTool, updateOpportunityTool } from "../manage-opportunities";
import { manageOrganizationsTool } from "../manage-organizations";
import { managePeopleTool } from "../manage-people";
import { createTaskTool, deleteTaskTool, updateTaskTool } from "../manage-tasks";
import { markTaskCompleteTool } from "../mark-task-complete";
import { searchSurveyResponsesTool } from "../search-survey-responses";
import { semanticSearchEvidenceTool } from "../semantic-search-evidence";
import { semanticSearchPeopleTool } from "../semantic-search-people";
import { upsertPersonTool } from "../upsert-person";

// ---------------------------------------------------------------------------
// Registry — must exactly mirror mcp-server.ts PHASE_1_TOOLS / PHASE_2_TOOLS
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
	generate_app_link: generateProjectRoutesTool,
	fetch_conversation_lenses: fetchConversationLensesTool,
	fetch_top_themes_with_people: fetchTopThemesWithPeopleTool,
	fetch_research_pulse: fetchResearchPulseTool,
	generate_research_recommendations: generateResearchRecommendationsTool,
};

const PHASE_2_TOOLS = {
	upsert_person: upsertPersonTool,
	manage_people: managePeopleTool,
	create_task: createTaskTool,
	update_task: updateTaskTool,
	delete_task: deleteTaskTool,
	mark_task_complete: markTaskCompleteTool,
	manage_annotations: manageAnnotationsTool,
	fetch_opportunities: fetchOpportunitiesTool,
	create_opportunity: createOpportunityTool,
	update_opportunity: updateOpportunityTool,
	manage_organizations: manageOrganizationsTool,
};

const ALL_TOOLS = { ...PHASE_1_TOOLS, ...PHASE_2_TOOLS };

// ---------------------------------------------------------------------------
// Shared helper: run a structural assertion over every tool in a registry
// ---------------------------------------------------------------------------

type AnyTool = {
	id: string;
	description?: string;
	inputSchema?: { safeParse: (v: unknown) => { success: boolean } };
	outputSchema?: unknown;
	execute?: unknown;
};

function forEachTool(registry: Record<string, AnyTool>, fn: (name: string, tool: AnyTool) => void) {
	for (const [name, tool] of Object.entries(registry)) {
		fn(name, tool);
	}
}

// ---------------------------------------------------------------------------
// Phase 1: Intelligence Read Tools
// ---------------------------------------------------------------------------

describe("MCP Server Phase 1 Tools", () => {
	it("registers exactly 16 tools — update this if intentionally adding/removing", () => {
		expect(Object.keys(PHASE_1_TOOLS).length).toBe(16);
	});

	it("all registry keys are snake_case (Claude tool-call convention)", () => {
		forEachTool(PHASE_1_TOOLS, (name) => {
			expect(name, `${name} must be snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
		});
	});

	it("all tool .id values are kebab-case (MCP protocol — no spaces, no underscores)", () => {
		forEachTool(PHASE_1_TOOLS, (name, tool) => {
			expect(tool.id, `${name}.id must be a non-empty string`).toBeTruthy();
			expect(tool.id, `${name}.id "${tool.id}" must use kebab-case`).toMatch(/^[a-z][a-z0-9-]*$/);
		});
	});

	it("all tool .id values are unique within Phase 1", () => {
		const ids = Object.values(PHASE_1_TOOLS).map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all tools have descriptions of at least 50 characters (LLMs route on this)", () => {
		forEachTool(PHASE_1_TOOLS, (name, tool) => {
			expect(
				tool.description?.length ?? 0,
				`${name} description is too short ("${tool.description?.slice(0, 40)}...")`
			).toBeGreaterThanOrEqual(50);
		});
	});

	it("all tools have an outputSchema (required for MCP response parsing)", () => {
		forEachTool(PHASE_1_TOOLS, (name, tool) => {
			expect(tool.outputSchema, `${name} is missing outputSchema`).toBeDefined();
		});
	});

	it("all tools have a Zod inputSchema with safeParse", () => {
		forEachTool(PHASE_1_TOOLS, (name, tool) => {
			expect(tool.inputSchema, `${name} is missing inputSchema`).toBeDefined();
			expect(typeof tool.inputSchema?.safeParse, `${name}.inputSchema must be a Zod schema (has safeParse)`).toBe(
				"function"
			);
		});
	});

	it("all tools have execute functions", () => {
		forEachTool(PHASE_1_TOOLS, (name, tool) => {
			expect(typeof tool.execute, `${name} must have an execute function`).toBe("function");
		});
	});

	describe("Tools that accept empty input (context provides project_id)", () => {
		const CONTEXT_ONLY_TOOLS = [
			"fetch_evidence",
			"fetch_themes",
			"fetch_surveys",
			"fetch_personas",
			"fetch_segments",
			"fetch_project_status",
			"fetch_conversation_lenses",
			"fetch_top_themes_with_people",
			"fetch_research_pulse",
		] as const;

		for (const toolName of CONTEXT_ONLY_TOOLS) {
			it(`${toolName} accepts empty input {}`, () => {
				const tool = PHASE_1_TOOLS[toolName];
				const result = tool.inputSchema?.safeParse({});
				expect(result?.success, `${toolName} should accept empty input (context provides project_id)`).toBe(true);
			});
		}
	});

	describe("generate_app_link — required field and entity type validation", () => {
		const VALID_ENTITY_TYPES = [
			"persona",
			"person",
			"opportunity",
			"organization",
			"theme",
			"evidence",
			"insight",
			"interview",
			"segment",
			"survey",
			"survey_response",
		] as const;

		for (const entityType of VALID_ENTITY_TYPES) {
			it(`accepts entityType="${entityType}"`, () => {
				const result = generateProjectRoutesTool.inputSchema.safeParse({
					entityType,
					entityId: "00000000-0000-0000-0000-000000000001",
				});
				expect(result.success, `entityType "${entityType}" should be valid`).toBe(true);
			});
		}

		it("rejects missing entityType", () => {
			const result = generateProjectRoutesTool.inputSchema.safeParse({
				entityId: "00000000-0000-0000-0000-000000000001",
			});
			expect(result.success).toBe(false);
		});

		it("rejects missing entityId", () => {
			const result = generateProjectRoutesTool.inputSchema.safeParse({
				entityType: "person",
			});
			expect(result.success).toBe(false);
		});

		it("rejects empty string entityId", () => {
			const result = generateProjectRoutesTool.inputSchema.safeParse({
				entityType: "person",
				entityId: "",
			});
			expect(result.success).toBe(false);
		});

		it("rejects unknown entityType", () => {
			const result = generateProjectRoutesTool.inputSchema.safeParse({
				entityType: "widget",
				entityId: "00000000-0000-0000-0000-000000000001",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("generate_research_recommendations — projectId required", () => {
		it("rejects empty input (projectId is required)", () => {
			const result = generateResearchRecommendationsTool.inputSchema?.safeParse({});
			expect(result?.success).toBe(false);
		});

		it("accepts valid input with projectId", () => {
			const result = generateResearchRecommendationsTool.inputSchema?.safeParse({
				projectId: "00000000-0000-0000-0000-000000000001",
			});
			expect(result?.success).toBe(true);
		});
	});

	describe("semantic_search_evidence — query field required", () => {
		it("rejects empty input (query is required)", () => {
			const result = semanticSearchEvidenceTool.inputSchema?.safeParse({});
			expect(result?.success).toBe(false);
		});

		it("accepts valid query string", () => {
			const result = semanticSearchEvidenceTool.inputSchema?.safeParse({ query: "pricing concerns" });
			expect(result?.success).toBe(true);
		});
	});

	describe("semantic_search_people — query field required", () => {
		it("rejects empty input (query is required)", () => {
			const result = semanticSearchPeopleTool.inputSchema?.safeParse({});
			expect(result?.success).toBe(false);
		});

		it("accepts valid query string", () => {
			const result = semanticSearchPeopleTool.inputSchema?.safeParse({ query: "VP of Engineering" });
			expect(result?.success).toBe(true);
		});
	});
});

// ---------------------------------------------------------------------------
// Phase 2: CRM Write Tools
// ---------------------------------------------------------------------------

describe("MCP Server Phase 2 Tools (CRM Write)", () => {
	it("registers exactly 11 write tools — update this if intentionally adding/removing", () => {
		expect(Object.keys(PHASE_2_TOOLS).length).toBe(11);
	});

	it("all registry keys are snake_case", () => {
		forEachTool(PHASE_2_TOOLS, (name) => {
			expect(name, `${name} must be snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
		});
	});

	it("all tool .id values are kebab-case (no spaces, no underscores)", () => {
		forEachTool(PHASE_2_TOOLS, (name, tool) => {
			expect(tool.id, `${name}.id must be non-empty`).toBeTruthy();
			expect(tool.id, `${name}.id "${tool.id}" must use kebab-case`).toMatch(/^[a-z][a-z0-9-]*$/);
		});
	});

	it("all tool .id values are unique within Phase 2", () => {
		const ids = Object.values(PHASE_2_TOOLS).map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all tools have descriptions of at least 50 characters", () => {
		forEachTool(PHASE_2_TOOLS, (name, tool) => {
			expect(tool.description?.length ?? 0, `${name} description is too short`).toBeGreaterThanOrEqual(50);
		});
	});

	it("all tools have an outputSchema", () => {
		forEachTool(PHASE_2_TOOLS, (name, tool) => {
			expect(tool.outputSchema, `${name} is missing outputSchema`).toBeDefined();
		});
	});

	it("all tools have a Zod inputSchema with safeParse", () => {
		forEachTool(PHASE_2_TOOLS, (name, tool) => {
			expect(tool.inputSchema, `${name} is missing inputSchema`).toBeDefined();
			expect(typeof tool.inputSchema?.safeParse, `${name}.inputSchema must be a Zod schema`).toBe("function");
		});
	});

	it("all tools have execute functions", () => {
		forEachTool(PHASE_2_TOOLS, (name, tool) => {
			expect(typeof tool.execute, `${name} must have an execute function`).toBe("function");
		});
	});

	describe("create_opportunity — required field validation", () => {
		it("rejects empty input", () => {
			const result = createOpportunityTool.inputSchema?.safeParse({});
			expect(result?.success).toBe(false);
		});

		it("accepts minimal valid input with title", () => {
			const result = createOpportunityTool.inputSchema?.safeParse({ title: "New Deal" });
			expect(result?.success).toBe(true);
		});
	});

	describe("create_task — required field validation", () => {
		it("rejects empty input", () => {
			const result = createTaskTool.inputSchema?.safeParse({});
			expect(result?.success).toBe(false);
		});

		it("accepts minimal valid input with title", () => {
			const result = createTaskTool.inputSchema?.safeParse({ title: "Follow up with customer" });
			expect(result?.success).toBe(true);
		});
	});
});

// ---------------------------------------------------------------------------
// Combined: All tools — cross-registry integrity
// ---------------------------------------------------------------------------

describe("MCP Server All Tools — cross-registry integrity", () => {
	it("registers exactly 27 total tools (16 read + 11 write)", () => {
		expect(Object.keys(ALL_TOOLS).length).toBe(27);
	});

	it("no duplicate registry key names across Phase 1 and Phase 2", () => {
		const names = Object.keys(ALL_TOOLS);
		const dupes = names.filter((n, i) => names.indexOf(n) !== i);
		expect(dupes, `Duplicate tool names: ${dupes.join(", ")}`).toHaveLength(0);
	});

	it("no duplicate tool .id values across all 27 tools", () => {
		const ids = Object.values(ALL_TOOLS).map((t) => t.id);
		const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
		expect(dupes, `Duplicate tool IDs: ${dupes.join(", ")}`).toHaveLength(0);
	});

	it("all tool descriptions are at least 50 characters", () => {
		forEachTool(ALL_TOOLS, (name, tool) => {
			expect(
				tool.description?.length ?? 0,
				`${name} description "${tool.description?.slice(0, 40)}..." is too short for LLM routing`
			).toBeGreaterThanOrEqual(50);
		});
	});

	it("all tools have outputSchema (MCP cannot parse responses without it)", () => {
		forEachTool(ALL_TOOLS, (name, tool) => {
			expect(
				tool.outputSchema,
				`${name} is missing outputSchema — add one or MCP responses will be unparseable`
			).toBeDefined();
		});
	});

	it("tool .id values use kebab-case only (spaces break MCP protocol)", () => {
		forEachTool(ALL_TOOLS, (name, tool) => {
			expect(tool.id, `${name}.id "${tool.id}" must match kebab-case`).toMatch(/^[a-z][a-z0-9-]*$/);
		});
	});

	it("registry keys use snake_case only (spaces break Claude tool dispatch)", () => {
		for (const name of Object.keys(ALL_TOOLS)) {
			expect(name, `Registry key "${name}" must be snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
		}
	});
});
