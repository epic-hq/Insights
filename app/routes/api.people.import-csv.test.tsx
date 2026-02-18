import type { ActionFunctionArgs } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";
import { resolveAccountIdFromProject } from "~/mastra/tools/context-utils";
import { importPeopleFromTableTool } from "~/mastra/tools/import-people-from-table";
import { parseSpreadsheetTool } from "~/mastra/tools/parse-spreadsheet";
import { userContext } from "~/server/user-context";
import { action } from "./api.people.import-csv";

vi.mock("~/mastra/tools/parse-spreadsheet", () => ({
	parseSpreadsheetTool: { execute: vi.fn() },
}));

vi.mock("~/mastra/tools/import-people-from-table", () => ({
	importPeopleFromTableTool: { execute: vi.fn() },
}));

vi.mock("~/mastra/tools/context-utils", () => ({
	resolveAccountIdFromProject: vi.fn(),
}));

vi.mock("~/lib/supabase/client.server", () => ({
	createSupabaseAdminClient: vi.fn(),
}));

function buildMockAdminClient() {
	return {
		from: vi.fn((table: string) => {
			if (["people", "organizations", "person_facet"].includes(table)) {
				return {
					select: vi.fn((_columns?: string, options?: { count?: string; head?: boolean }) => {
						if (options?.count === "exact" && options.head === true) {
							return {
								eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
							};
						}
						return Promise.resolve({ data: [], error: null });
					}),
				};
			}

			if (table === "facet_kind_global") {
				return {
					select: vi.fn().mockResolvedValue({
						data: [{ slug: "custom" }, { slug: "tool" }],
						error: null,
					}),
				};
			}

			return {
				select: vi.fn().mockResolvedValue({ data: [], error: null }),
			};
		}),
	};
}

describe("api.people.import-csv", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(resolveAccountIdFromProject).mockResolvedValue("account-actual");
		vi.mocked(createSupabaseAdminClient).mockReturnValue(
			buildMockAdminClient() as unknown as ReturnType<typeof createSupabaseAdminClient>
		);
	});

	it("returns 401 when user context is missing", async () => {
		const request = new Request("http://localhost/test", {
			method: "POST",
			body: JSON.stringify({ csvContent: "full_name,email\\nTest User,test@example.com" }),
			headers: { "Content-Type": "application/json" },
		});

		const args = {
			request,
			context: {
				get: vi.fn(() => ({ supabase: null, claims: null, account_id: "" })),
			},
			params: { projectId: "project-1", accountId: "account-1" },
		} as unknown as ActionFunctionArgs;
		const response = await action(args);

		expect(response.status).toBe(401);
	});

	it("returns 400 for invalid payload", async () => {
		const request = new Request("http://localhost/test", {
			method: "POST",
			body: JSON.stringify({}),
			headers: { "Content-Type": "application/json" },
		});

		const args = {
			request,
			context: {
				get: vi.fn((key) =>
					key === userContext
						? {
								supabase: {},
								claims: { sub: "user-1" },
								account_id: "account-ctx",
							}
						: null
				),
			},
			params: { projectId: "project-1", accountId: "account-1" },
		} as unknown as ActionFunctionArgs;
		const response = await action(args);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.success).toBe(false);
	});

	it("accepts projectId from JSON body when route has no project param", async () => {
		vi.mocked(parseSpreadsheetTool.execute).mockResolvedValue({
			success: true,
			message: "Parsed",
			assetId: "11111111-1111-4111-8111-111111111111",
			headers: ["full_name", "email"],
			rowCount: 1,
			columnCount: 2,
		});

		vi.mocked(importPeopleFromTableTool.execute).mockResolvedValue({
			success: true,
			message: "Imported",
			imported: {
				people: 1,
				updated: 0,
				organizations: 0,
				facets: 0,
				skipped: 0,
			},
		});

		const request = new Request("http://localhost/api/people/import-csv", {
			method: "POST",
			body: JSON.stringify({
				projectId: "project-1",
				csvContent: "full_name,email\\nTest User,test@example.com",
				verify: false,
			}),
			headers: { "Content-Type": "application/json" },
		});

		const args = {
			request,
			context: {
				get: vi.fn((key) =>
					key === userContext
						? {
								supabase: {},
								claims: { sub: "user-1" },
								account_id: "account-ctx",
							}
						: null
				),
			},
			params: {},
		} as unknown as ActionFunctionArgs;

		const response = await action(args);
		expect(response.status).toBe(200);
	});

	it("imports CSV via parse+import tools and returns summary", async () => {
		vi.mocked(parseSpreadsheetTool.execute).mockResolvedValue({
			success: true,
			message: "Parsed",
			assetId: "11111111-1111-4111-8111-111111111111",
			headers: ["full_name", "email", "tools_used"],
			rowCount: 2,
			columnCount: 3,
			columnMapping: {
				name: "full_name",
				email: "email",
			},
			suggestedFacets: [
				{ column: "tools_used", facetKind: "tool", reason: "security stack", sampleValues: ["Splunk"] },
			],
		});

		vi.mocked(importPeopleFromTableTool.execute).mockResolvedValue({
			success: true,
			message: "Imported",
			imported: {
				people: 2,
				updated: 0,
				organizations: 1,
				facets: 3,
				skipped: 0,
			},
			details: [
				{
					personId: "person-1",
					name: "Test User",
					organizationId: "org-1",
					organizationName: "Acme",
					rowIndex: 0,
				},
			],
			detectedMapping: { name: "full_name", email: "email" },
			skipReasons: [],
		});

		const request = new Request("http://localhost/test", {
			method: "POST",
			body: JSON.stringify({
				csvContent: "full_name,email,tools_used\\nTest User,test@example.com,Splunk",
				verify: false,
				mode: "create",
				facetColumns: [{ column: "tools_used", facetKind: "tool" }],
			}),
			headers: { "Content-Type": "application/json" },
		});

		const args = {
			request,
			context: {
				get: vi.fn((key) =>
					key === userContext
						? {
								supabase: {},
								claims: { sub: "user-1" },
								account_id: "account-ctx",
							}
						: null
				),
			},
			params: { projectId: "project-1", accountId: "account-1" },
		} as unknown as ActionFunctionArgs;
		const response = await action(args);

		expect(response.status).toBe(200);

		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.parse.assetId).toBe("11111111-1111-4111-8111-111111111111");
		expect(body.import.imported.people).toBe(2);
		expect(body.verification).toBeNull();

		expect(parseSpreadsheetTool.execute).toHaveBeenCalledTimes(1);
		expect(importPeopleFromTableTool.execute).toHaveBeenCalledTimes(1);
	});
});
