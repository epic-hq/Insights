import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { parseIdFromParams } from "./utils";

// Valid v4 UUIDs for testing (Zod v4 requires RFC 4122 compliant UUIDs)
const validAccountUuid = "d7b69d5e-a952-41a6-931f-e2fed1d82e85";
const validProjectUuid = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

// Correct Mock Supabase client
const mockSupabaseClient = {
	from: vi.fn().mockReturnThis(),
	select: vi.fn().mockReturnThis(),
	eq: vi.fn().mockReturnThis(),
	single: vi.fn().mockResolvedValue({ data: { id: validAccountUuid }, error: null }),
};

describe("parseIdFromParams", () => {
	it("should return account data for a valid UUID", async () => {
		const result = await parseIdFromParams({
			idOrSlug: validAccountUuid,
			supabase: mockSupabaseClient as unknown as SupabaseClient,
			type: "account",
		});
		expect(result.data).not.toBeNull();
		expect(result.error).toBeNull();
	});

	it("should return project data for a valid UUID", async () => {
		const result = await parseIdFromParams({
			idOrSlug: validProjectUuid,
			supabase: mockSupabaseClient as unknown as SupabaseClient,
			type: "project",
		});
		expect(result.data).not.toBeNull();
		expect(result.error).toBeNull();
	});

	it("should return an error for an invalid UUID", async () => {
		const mockErrorClient = {
			from: vi.fn().mockReturnThis(),
			select: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValueOnce({ data: null, error: "Error" }),
		};
		const result = await parseIdFromParams({
			idOrSlug: "invalid-uuid",
			supabase: mockErrorClient as unknown as SupabaseClient,
			type: "account",
		});
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});

	it("should return error for a non-UUID slug (slugs not supported)", async () => {
		const result = await parseIdFromParams({
			idOrSlug: "valid-slug",
			supabase: mockSupabaseClient as unknown as SupabaseClient,
			type: "account",
			userId: "user-id",
		});
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});

	it("should return error for a non-UUID project slug (slugs not supported)", async () => {
		const result = await parseIdFromParams({
			idOrSlug: "valid-slug",
			supabase: mockSupabaseClient as unknown as SupabaseClient,
			type: "project",
			accountId: "account-id",
		});
		expect(result.data).toBeNull();
		expect(result.error).not.toBeNull();
	});
});
