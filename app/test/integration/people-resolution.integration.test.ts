/**
 * Unit tests for unified person resolution module
 * Tests email matching, platform ID matching, name+company fuzzy matching, and idempotency
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "~/../supabase/types";
import { type PersonResolutionInput, resolveOrCreatePerson } from "~/lib/people/resolution.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

type PeopleInsert = Database["public"]["Tables"]["people"]["Insert"];

describe("resolveOrCreatePerson", () => {
	const supabase = createSupabaseAdminClient();
	let testAccountId = "";
	let testProjectId = "";

	beforeAll(async () => {
		const { data: scope, error } = await supabase.from("projects").select("id, account_id").limit(1).single();
		if (error || !scope) {
			throw new Error(`Failed to discover project scope for people-resolution tests: ${error?.message || "none"}`);
		}
		testAccountId = scope.account_id;
		testProjectId = scope.id;
	});

	// Track created people for cleanup
	const createdPeopleIds: string[] = [];

	beforeEach(async () => {
		// Clean slate for each test
		createdPeopleIds.length = 0;
	});

	afterEach(async () => {
		// Cleanup created people
		if (createdPeopleIds.length > 0) {
			await supabase.from("people").delete().in("id", createdPeopleIds);
		}
	});

	function splitName(name: string): { firstname: string | null; lastname: string | null } {
		const parts = name
			.trim()
			.split(" ")
			.map((part) => part.trim())
			.filter(Boolean);
		if (parts.length === 0) return { firstname: null, lastname: null };
		return {
			firstname: parts[0] || null,
			lastname: parts.length > 1 ? parts.slice(1).join(" ") : null,
		};
	}

	async function createPerson(payload: Partial<PeopleInsert>): Promise<{ id: string; name: string | null }> {
		const { name, firstname, lastname, ...rest } = payload;
		const derivedName = splitName(name || "Test Person");
		const { data, error } = await supabase
			.from("people")
			.insert({
				account_id: testAccountId,
				project_id: testProjectId,
				company: payload.company ?? `test-${crypto.randomUUID().slice(0, 8)}`,
				firstname: firstname ?? derivedName.firstname,
				lastname: lastname ?? derivedName.lastname,
				...rest,
			})
			.select("id, name")
			.single();

		if (error) throw error;
		createdPeopleIds.push(data.id);
		return data;
	}

	describe("email matching", () => {
		it("should match existing person by email (highest priority)", async () => {
			const existing = await createPerson({
				name: "John Smith",
				primary_email: "john@example.com",
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "J. Smith", // Different name
				primary_email: "john@example.com",
				source: "desktop_meeting",
			});

			expect(result.person.id).toBe(existing.id);
			expect(result.matchedBy).toBe("email");
			expect(result.person.created).toBe(false);
		});

		it("should match by email case-insensitively", async () => {
			const existing = await createPerson({
				name: "Jane Doe",
				primary_email: "jane@example.com",
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Jane Doe",
				primary_email: "JANE@EXAMPLE.COM", // Different case
				source: "desktop_meeting",
			});

			expect(result.person.id).toBe(existing.id);
			expect(result.matchedBy).toBe("email");
		});

		it("should skip email match if email not provided", async () => {
			await createPerson({
				name: "Test Person",
				primary_email: "test@example.com",
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Test Person",
				// No email provided
				source: "desktop_meeting",
			});

			// Should create new person, not match by email
			expect(result.matchedBy).not.toBe("email");
			createdPeopleIds.push(result.person.id);
		});
	});

	describe("platform ID matching", () => {
		it("should match by platform_user_id for repeat meetings", async () => {
			const existing = await createPerson({
				name: "Jane Doe",
				contact_info: { zoom: { user_id: "zoom-12345" } },
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Jane D", // Abbreviated in second meeting
				platform: "zoom",
				platform_user_id: "zoom-12345",
				source: "desktop_meeting",
			});

			expect(result.person.id).toBe(existing.id);
			expect(result.matchedBy).toBe("platform_id");
		});

		it("should prefer email match over platform ID match", async () => {
			const emailMatch = await createPerson({
				name: "Email Match Person",
				primary_email: "priority@example.com",
			});

			const platformMatch = await createPerson({
				name: "Platform Match Person",
				contact_info: { zoom: { user_id: "zoom-99999" } },
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Test Person",
				primary_email: "priority@example.com", // Should match this
				platform: "zoom",
				platform_user_id: "zoom-99999", // Not this
				source: "desktop_meeting",
			});

			expect(result.person.id).toBe(emailMatch.id);
			expect(result.matchedBy).toBe("email");
		});

		it("should skip platform ID match if not provided", async () => {
			await createPerson({
				name: "Platform Person",
				contact_info: { zoom: { user_id: "zoom-12345" } },
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Platform Person",
				// No platform data
				source: "desktop_meeting",
			});

			expect(result.matchedBy).not.toBe("platform_id");
			createdPeopleIds.push(result.person.id);
		});
	});

	describe("name + company fuzzy matching", () => {
		it("should match by name and company when email and platform unavailable", async () => {
			const existing = await createPerson({
				name: "Alice Johnson",
				company: "Acme Corp",
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Alice Johnson",
				company: "Acme Corp",
				source: "baml_extraction",
			});

			expect(result.person.id).toBe(existing.id);
			expect(result.matchedBy).toBe("name_company");
		});

		it("should match by name with empty company", async () => {
			const existing = await createPerson({
				name: "Bob Smith",
				company: "",
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Bob Smith",
				source: "desktop_meeting",
			});

			expect(result.person.id).toBe(existing.id);
			expect(result.matchedBy).toBe("name_company");
		});

		it("should handle fuzzy name match (case insensitive)", async () => {
			const existing = await createPerson({
				name: "Charlie Brown",
				company: "Test Inc",
			});

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "charlie brown", // lowercase
				company: "Test Inc",
				source: "desktop_meeting",
			});

			expect(result.person.id).toBe(existing.id);
			expect(result.matchedBy).toBe("name_company");
		});
	});

	describe("person creation", () => {
		it("should create new person when no match", async () => {
			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "New Person",
				primary_email: "new@example.com",
				source: "desktop_meeting",
			});

			expect(result.person.id).toBeDefined();
			expect(result.matchedBy).toBe("created");
			expect(result.person.created).toBe(true);

			createdPeopleIds.push(result.person.id);
		});

		it("should create person with full data including platform ID", async () => {
			const uniqueToken = crypto.randomUUID().slice(0, 8);
			const uniqueEmail = `rick-${uniqueToken}@example.com`;
			const uniqueFirstName = `Rick${uniqueToken}`;
			const uniqueLastName = `Moy${uniqueToken}`;
			const uniqueCompany = `Acme ${uniqueToken}`;
			const uniquePlatformUserId = `zoom-${uniqueToken}`;
			const input: PersonResolutionInput = {
				firstname: uniqueFirstName,
				lastname: uniqueLastName,
				primary_email: uniqueEmail,
				company: uniqueCompany,
				title: "CEO",
				role: "interviewer",
				platform: "zoom",
				platform_user_id: uniquePlatformUserId,
				person_type: "internal",
				source: "desktop_meeting",
			};

			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, input);

			expect(result.person.created).toBe(true);
			expect(result.matchedBy).toBe("created");

			// Verify stored data
			const { data: stored } = await supabase.from("people").select("*").eq("id", result.person.id).single();

			expect(stored?.firstname).toBe(uniqueFirstName);
			expect(stored?.lastname).toBe(uniqueLastName);
			expect(stored?.primary_email).toBe(uniqueEmail);
			expect(stored?.title).toBe("CEO");
			expect(stored?.person_type).toBe("internal");
			expect(stored?.contact_info).toEqual({
				zoom: { user_id: uniquePlatformUserId },
			});

			createdPeopleIds.push(result.person.id);
		});

		it("should construct name from firstname and lastname", async () => {
			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				firstname: "John",
				lastname: "Doe",
				source: "desktop_meeting",
			});

			expect(result.person.name).toBe("John Doe");
			createdPeopleIds.push(result.person.id);
		});

		it("should use name field when firstname/lastname not provided", async () => {
			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Single Name Person",
				source: "baml_extraction",
			});

			expect(result.person.name).toBe("Single Name Person");
			createdPeopleIds.push(result.person.id);
		});
	});

	describe("idempotency", () => {
		it("should handle concurrent creation attempts (same person)", async () => {
			const input: PersonResolutionInput = {
				name: "Concurrent Test",
				primary_email: "concurrent@example.com",
				source: "desktop_meeting",
			};

			// Simulate 3 simultaneous requests
			const results = await Promise.allSettled([
				resolveOrCreatePerson(supabase, testAccountId, testProjectId, input),
				resolveOrCreatePerson(supabase, testAccountId, testProjectId, input),
				resolveOrCreatePerson(supabase, testAccountId, testProjectId, input),
			]);

			expect(results.every((r) => r.status === "fulfilled")).toBe(true);

			// All should return SAME person ID
			const ids = results
				.filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
				.map((r) => r.value.person.id);

			expect(new Set(ids).size).toBe(1);
			createdPeopleIds.push(ids[0]);
		});

		it("should handle retry without creating duplicates", async () => {
			const input: PersonResolutionInput = {
				name: "Retry Test",
				primary_email: "retry@example.com",
				source: "desktop_meeting",
			};

			// First call
			const result1 = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, input);
			expect(result1.person.created).toBe(true);
			expect(result1.matchedBy).toBe("created");

			// Second call (retry scenario)
			const result2 = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, input);
			expect(result2.person.id).toBe(result1.person.id);
			expect(result2.person.created).toBe(false);
			expect(result2.matchedBy).toBe("email");

			createdPeopleIds.push(result1.person.id);
		});
	});

	describe("match priority", () => {
		it("should use priority: email > platform_id > name_company > created", async () => {
			// Create person with all identifiers
			const original = await createPerson({
				name: "Priority Test",
				primary_email: "priority@example.com",
				company: "Test Corp",
				contact_info: { zoom: { user_id: "zoom-priority" } },
			});

			// Test 1: Email match (highest)
			const emailResult = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Different Name",
				primary_email: "priority@example.com",
				source: "desktop_meeting",
			});
			expect(emailResult.person.id).toBe(original.id);
			expect(emailResult.matchedBy).toBe("email");

			// Test 2: Platform ID match (no email)
			const platformResult = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Different Name",
				platform: "zoom",
				platform_user_id: "zoom-priority",
				source: "desktop_meeting",
			});
			expect(platformResult.person.id).toBe(original.id);
			expect(platformResult.matchedBy).toBe("platform_id");

			// Test 3: Name+company match (no email or platform)
			const nameResult = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Priority Test",
				company: "Test Corp",
				source: "baml_extraction",
			});
			expect(nameResult.person.id).toBe(original.id);
			expect(nameResult.matchedBy).toBe("name_company");
		});
	});

	describe("edge cases", () => {
		it("should handle missing name gracefully", async () => {
			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				primary_email: "noname@example.com",
				source: "desktop_meeting",
			});

			expect(result.person.created).toBe(true);
			createdPeopleIds.push(result.person.id);
		});

		it("should handle whitespace in names", async () => {
			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				firstname: "  John  ",
				lastname: "  Doe  ",
				source: "desktop_meeting",
			});

			expect(result.person.name).toBe("John Doe");
			createdPeopleIds.push(result.person.id);
		});

		it("should handle null/undefined values", async () => {
			const result = await resolveOrCreatePerson(supabase, testAccountId, testProjectId, {
				name: "Minimal Person",
				primary_email: undefined,
				company: undefined,
				platform: undefined,
				platform_user_id: undefined,
				source: "desktop_meeting",
			});

			expect(result.person.created).toBe(true);
			createdPeopleIds.push(result.person.id);
		});
	});
});
