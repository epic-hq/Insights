import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { parseIdFromParams } from "./utils";

// Correct Mock Supabase client
const mockSupabaseClient = {
	from: vi.fn().mockReturnThis(),
	select: vi.fn().mockReturnThis(),
	eq: vi.fn().mockReturnThis(),
	single: vi.fn().mockResolvedValue({ data: { id: "mock-id" }, error: null }),
};

describe("parseIdFromParams", () => {
	it("should return account data for a valid UUID", async () => {
		const result = await parseIdFromParams({
			idOrSlug: "valid-uuid",
			supabase: mockSupabaseClient as unknown as SupabaseClient,
			type: "account",
		});
		expect(result.data).not.toBeNull();
		expect(result.error).toBeNull();
	});

	it("should return project data for a valid UUID", async () => {
		const result = await parseIdFromParams({
			idOrSlug: "valid-uuid",
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

	it("should return account data for a valid slug", async () => {
		const result = await parseIdFromParams({
			idOrSlug: "valid-slug",
			supabase: mockSupabaseClient as unknown as SupabaseClient,
			type: "account",
			userId: "user-id",
		});
		expect(result.data).not.toBeNull();
		expect(result.error).toBeNull();
	});

	it("should return project data for a valid slug", async () => {
		const result = await parseIdFromParams({
			idOrSlug: "valid-slug",
			supabase: mockSupabaseClient as unknown as SupabaseClient,
			type: "project",
			accountId: "account-id",
		});
		expect(result.data).not.toBeNull();
		expect(result.error).toBeNull();
	});
});
