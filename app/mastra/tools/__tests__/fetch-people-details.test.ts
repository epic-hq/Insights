// @vitest-environment node

import { RequestContext } from "@mastra/core/di";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPeopleDetailsTool } from "../fetch-people-details";

const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };

vi.mock("../../../lib/supabase/client.server", () => ({
	supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Minimal person row matching the DB shape
function makePerson(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		id: overrides.id ?? "person-1",
		name: overrides.name ?? "Alice",
		title: overrides.title ?? "PM",
		role: overrides.role ?? null,
		age: null,
		gender: null,
		pronouns: null,
		segment: null,
		income: null,
		location: null,
		timezone: null,
		languages: null,
		education: null,
		lifecycle_stage: null,
		description: null,
		preferences: null,
		image_url: null,
		linkedin_url: null,
		website_url: null,
		contact_info: null,
		primary_email: null,
		primary_phone: null,
		person_type: "external",
		account_id: "acct-1",
		project_id: "proj-1",
		created_at: "2026-01-01T00:00:00Z",
		updated_at: "2026-01-01T00:00:00Z",
		default_organization: overrides.default_organization ?? null,
		...overrides,
	};
}

function buildChain(data: unknown[] | null, error: unknown = null) {
	return {
		select: vi.fn().mockReturnValue({
			eq: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue({ data, error }),
				}),
			}),
			in: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					order: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue({ data: [], error: null }),
					}),
					maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
				}),
			}),
		}),
	};
}

function makeContext(accountId = "acct-1", projectId = "proj-1") {
	const rc = new RequestContext();
	rc.set("account_id", accountId);
	rc.set("project_id", projectId);
	return { requestContext: rc };
}

describe("fetchPeopleDetailsTool", () => {
	beforeEach(() => {
		mockFrom.mockReset();
	});

	it("returns error for missing projectId", async () => {
		const result = await fetchPeopleDetailsTool.execute({ projectId: "" }, makeContext());
		expect(result.success).toBe(false);
		expect(result.message).toContain("Missing");
	});

	it("queries people.project_id directly (not project_people junction)", async () => {
		const alice = makePerson({ id: "p1", name: "Alice" });
		const chain = buildChain([alice]);
		mockFrom.mockReturnValue(chain);

		const result = await fetchPeopleDetailsTool.execute(
			{ projectId: "proj-1", includeEvidence: false, includePersonas: false },
			makeContext()
		);

		expect(result.success).toBe(true);
		expect(result.people.length).toBe(1);
		expect(result.people[0].name).toBe("Alice");

		// Verify we queried from("people") not from("project_people")
		expect(mockFrom).toHaveBeenCalledWith("people");
		// The select should NOT contain project_people!inner
		const selectCall = chain.select.mock.calls[0][0];
		expect(selectCall).not.toContain("project_people");
	});

	it("filters people by name search (case-insensitive)", async () => {
		const alice = makePerson({ id: "p1", name: "Alice Smith" });
		const bob = makePerson({ id: "p2", name: "Bob Jones" });
		mockFrom.mockReturnValue(buildChain([alice, bob]));

		const result = await fetchPeopleDetailsTool.execute(
			{
				projectId: "proj-1",
				peopleSearch: "alice",
				includeEvidence: false,
				includePersonas: false,
			},
			makeContext()
		);

		expect(result.success).toBe(true);
		expect(result.people.length).toBe(1);
		expect(result.people[0].name).toBe("Alice Smith");
		expect(result.searchApplied).toBe("alice");
	});

	it("falls back to account scope when search finds no project matches", async () => {
		// First call (project scope) returns people that don't match "T Dog"
		const projectBob = makePerson({
			id: "p2",
			name: "Bob",
			project_id: "proj-1",
		});
		// Second call (account scope) returns T Dog
		const accountTDog = makePerson({
			id: "p3",
			name: "T Dog",
			project_id: "proj-1",
			account_id: "acct-1",
		});

		// Account fallback uses a simpler chain: .from().select().eq(account_id).limit()
		function buildAccountChain(data: unknown[]) {
			return {
				select: vi.fn().mockReturnValue({
					eq: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue({ data, error: null }),
						eq: vi.fn().mockReturnValue({
							limit: vi.fn().mockResolvedValue({ data, error: null }),
						}),
					}),
					in: vi.fn().mockReturnValue({
						eq: vi.fn().mockReturnValue({
							order: vi.fn().mockReturnValue({
								limit: vi.fn().mockResolvedValue({ data: [], error: null }),
							}),
						}),
					}),
				}),
			};
		}

		let callCount = 0;
		mockFrom.mockImplementation(() => {
			callCount++;
			if (callCount === 1) return buildChain([projectBob]);
			return buildAccountChain([accountTDog]);
		});

		const result = await fetchPeopleDetailsTool.execute(
			{
				projectId: "proj-1",
				peopleSearch: "T Dog",
				includeEvidence: false,
				includePersonas: false,
			},
			makeContext()
		);

		expect(result.success).toBe(true);
		expect(callCount).toBeGreaterThan(1);
		expect(result.people.length).toBe(1);
		expect(result.people[0].name).toBe("T Dog");
		expect(result.message).toContain("account");
	});

	it("matches search on title, company, and role fields", async () => {
		const person = makePerson({
			id: "p1",
			name: "John",
			title: "VP Engineering",
			role: "decision-maker",
			default_organization: { name: "Acme Corp" },
		});
		mockFrom.mockReturnValue(buildChain([person]));

		// Match on title
		const titleResult = await fetchPeopleDetailsTool.execute(
			{
				projectId: "proj-1",
				peopleSearch: "VP Engineering",
				includeEvidence: false,
				includePersonas: false,
			},
			makeContext()
		);
		expect(titleResult.people.length).toBe(1);

		// Match on company
		mockFrom.mockReturnValue(buildChain([person]));
		const companyResult = await fetchPeopleDetailsTool.execute(
			{
				projectId: "proj-1",
				peopleSearch: "Acme",
				includeEvidence: false,
				includePersonas: false,
			},
			makeContext()
		);
		expect(companyResult.people.length).toBe(1);
	});
});
