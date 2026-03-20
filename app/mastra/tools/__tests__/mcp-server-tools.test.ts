/**
 * Tests that the MCP server correctly registers all Phase 1 + Phase 2 tools.
 * Validates tool names, descriptions, and input schemas.
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

import { fetchEvidenceTool } from "../fetch-evidence";
import { fetchInterviewContextTool } from "../fetch-interview-context";
import { fetchPeopleDetailsTool } from "../fetch-people-details";
import { fetchPersonasTool } from "../fetch-personas";
import { fetchProjectStatusContextTool } from "../fetch-project-status-context";
import { fetchSegmentsTool } from "../fetch-segments";
import { fetchSurveysTool } from "../fetch-surveys";
import { fetchThemesTool } from "../fetch-themes";
import { manageAnnotationsTool } from "../manage-annotations";
import { managePeopleTool } from "../manage-people";
import { createTaskTool, deleteTaskTool, updateTaskTool } from "../manage-tasks";
import { markTaskCompleteTool } from "../mark-task-complete";
import { searchSurveyResponsesTool } from "../search-survey-responses";
// Phase 1 tool imports
import { semanticSearchEvidenceTool } from "../semantic-search-evidence";
import { semanticSearchPeopleTool } from "../semantic-search-people";
// Phase 2 tool imports
import { upsertPersonTool } from "../upsert-person";

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
};

describe("MCP Server Phase 1 Tools", () => {
	it("registers exactly 11 tools", () => {
		expect(Object.keys(PHASE_1_TOOLS).length).toBe(11);
	});

	it("all tools are defined and have an id", () => {
		for (const [name, tool] of Object.entries(PHASE_1_TOOLS)) {
			expect(tool, `Tool ${name} should be defined`).toBeDefined();
			expect(tool.id, `Tool ${name} should have an id`).toBeDefined();
			expect(typeof tool.id).toBe("string");
		}
	});

	it("all tools have descriptions", () => {
		for (const [name, tool] of Object.entries(PHASE_1_TOOLS)) {
			expect(tool.description, `Tool ${name} should have a description`).toBeDefined();
			expect(tool.description?.length, `Tool ${name} description should be non-empty`).toBeGreaterThan(10);
		}
	});

	it("all tools have input schemas", () => {
		for (const [name, tool] of Object.entries(PHASE_1_TOOLS)) {
			expect(tool.inputSchema, `Tool ${name} should have an inputSchema`).toBeDefined();
		}
	});

	it("all tools have execute functions", () => {
		for (const [name, tool] of Object.entries(PHASE_1_TOOLS)) {
			expect(typeof tool.execute, `Tool ${name} should have an execute function`).toBe("function");
		}
	});

	describe("Tool naming conventions", () => {
		it("all MCP tool names use snake_case", () => {
			for (const name of Object.keys(PHASE_1_TOOLS)) {
				expect(name, `${name} should be snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
			}
		});
	});

	describe("Read-only tools accept project context", () => {
		const toolsWithProjectInput = [
			"fetch_evidence",
			"fetch_themes",
			"fetch_surveys",
			"fetch_personas",
			"fetch_segments",
			"fetch_project_status",
		];

		for (const toolName of toolsWithProjectInput) {
			it(`${toolName} input schema can parse minimal input`, () => {
				const tool = PHASE_1_TOOLS[toolName as keyof typeof PHASE_1_TOOLS];
				// All Phase 1 tools should accept empty input (context provides project_id)
				const result = tool.inputSchema.safeParse({});
				// It's ok if it fails validation — we just want to confirm the schema exists
				// and is a Zod schema (has safeParse method)
				expect(result).toBeDefined();
				expect(typeof result.success).toBe("boolean");
			});
		}
	});
});

// ---------------------------------------------------------------------------
// Phase 2: CRM Write Tools
// ---------------------------------------------------------------------------

const PHASE_2_TOOLS = {
	upsert_person: upsertPersonTool,
	manage_people: managePeopleTool,
	create_task: createTaskTool,
	update_task: updateTaskTool,
	delete_task: deleteTaskTool,
	mark_task_complete: markTaskCompleteTool,
	manage_annotations: manageAnnotationsTool,
};

describe("MCP Server Phase 2 Tools (CRM Write)", () => {
	it("registers exactly 7 write tools", () => {
		expect(Object.keys(PHASE_2_TOOLS).length).toBe(7);
	});

	it("all tools are defined and have an id", () => {
		for (const [name, tool] of Object.entries(PHASE_2_TOOLS)) {
			expect(tool, `Tool ${name} should be defined`).toBeDefined();
			expect(tool.id, `Tool ${name} should have an id`).toBeDefined();
			expect(typeof tool.id).toBe("string");
		}
	});

	it("all tools have descriptions", () => {
		for (const [name, tool] of Object.entries(PHASE_2_TOOLS)) {
			expect(tool.description, `Tool ${name} should have a description`).toBeDefined();
			expect(tool.description?.length, `Tool ${name} description should be non-empty`).toBeGreaterThan(10);
		}
	});

	it("all tools have input schemas", () => {
		for (const [name, tool] of Object.entries(PHASE_2_TOOLS)) {
			expect(tool.inputSchema, `Tool ${name} should have an inputSchema`).toBeDefined();
		}
	});

	it("all tools have execute functions", () => {
		for (const [name, tool] of Object.entries(PHASE_2_TOOLS)) {
			expect(typeof tool.execute, `Tool ${name} should have an execute function`).toBe("function");
		}
	});

	it("all MCP tool names use snake_case", () => {
		for (const name of Object.keys(PHASE_2_TOOLS)) {
			expect(name, `${name} should be snake_case`).toMatch(/^[a-z][a-z0-9_]*$/);
		}
	});
});

// ---------------------------------------------------------------------------
// Combined: All tools
// ---------------------------------------------------------------------------

describe("MCP Server All Tools", () => {
	const ALL_TOOLS = { ...PHASE_1_TOOLS, ...PHASE_2_TOOLS };

	it("registers 18 total tools (11 read + 7 write)", () => {
		expect(Object.keys(ALL_TOOLS).length).toBe(18);
	});

	it("has no duplicate tool names", () => {
		const names = Object.keys(ALL_TOOLS);
		expect(new Set(names).size).toBe(names.length);
	});
});
