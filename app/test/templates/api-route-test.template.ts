/**
 * API Route Test Template
 *
 * Use this template for testing React Router loaders and actions.
 * Copy to app/features/[feature]/api/[action].test.ts
 *
 * Run with: pnpm test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
// import { action, loader } from "./your-route"

// Mock Supabase client
vi.mock("~/lib/supabase/client.server", () => ({
	getServerClient: vi.fn(),
}))

// Mock external services as needed
// vi.mock("~/../baml_client")
// vi.mock("@trigger.dev/sdk")

describe("API Route: /api/your-endpoint", () => {
	// Create mock Supabase client with chainable methods
	const createMockSupabase = () => ({
		from: vi.fn().mockReturnThis(),
		select: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		update: vi.fn().mockReturnThis(),
		delete: vi.fn().mockReturnThis(),
		eq: vi.fn().mockReturnThis(),
		neq: vi.fn().mockReturnThis(),
		in: vi.fn().mockReturnThis(),
		single: vi.fn(),
		maybeSingle: vi.fn(),
	})

	// Create mock context with user session
	const createMockContext = (overrides = {}) => ({
		get: vi.fn().mockReturnValue({
			supabase: createMockSupabase(),
			account_id: "test-account-id",
			user_id: "test-user-id",
			...overrides,
		}),
	})

	// Helper to create test requests
	const createRequest = (
		method: string,
		body?: Record<string, unknown>,
		path = "/api/endpoint",
	) => {
		const options: RequestInit = {
			method,
			headers: { "Content-Type": "application/json" },
		}
		if (body) {
			options.body = JSON.stringify(body)
		}
		return new Request(`http://localhost${path}`, options)
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("loader", () => {
		it("returns data for authenticated user", async () => {
			const mockContext = createMockContext()
			const mockSupabase = mockContext.get().supabase

			// Setup mock response
			mockSupabase.single.mockResolvedValue({
				data: { id: "1", name: "Test" },
				error: null,
			})

			// const result = await loader({
			//   request: createRequest("GET"),
			//   context: mockContext,
			//   params: { id: "1" },
			// })
			//
			// expect(result).toMatchObject({ id: "1", name: "Test" })
			expect(true).toBe(true) // Remove this placeholder
		})

		it("returns 404 for non-existent resource", async () => {
			const mockContext = createMockContext()
			const mockSupabase = mockContext.get().supabase

			mockSupabase.single.mockResolvedValue({
				data: null,
				error: { code: "PGRST116", message: "Not found" },
			})

			// const result = await loader({
			//   request: createRequest("GET"),
			//   context: mockContext,
			//   params: { id: "non-existent" },
			// })
			//
			// expect(result).toMatchObject({ error: expect.any(String) })
			expect(true).toBe(true) // Remove this placeholder
		})
	})

	describe("action", () => {
		describe("POST - create", () => {
			it("creates resource with valid data", async () => {
				const mockContext = createMockContext()
				const mockSupabase = mockContext.get().supabase

				mockSupabase.single.mockResolvedValue({
					data: { id: "new-1", name: "New Resource" },
					error: null,
				})

				// const result = await action({
				//   request: createRequest("POST", { name: "New Resource" }),
				//   context: mockContext,
				//   params: {},
				// })
				//
				// expect(result).toMatchObject({ success: true, id: "new-1" })
				// expect(mockSupabase.insert).toHaveBeenCalledWith(
				//   expect.objectContaining({ name: "New Resource" })
				// )
				expect(true).toBe(true) // Remove this placeholder
			})

			it("validates required fields", async () => {
				const mockContext = createMockContext()

				// const result = await action({
				//   request: createRequest("POST", {}), // Missing required fields
				//   context: mockContext,
				//   params: {},
				// })
				//
				// expect(result).toMatchObject({
				//   error: expect.stringContaining("required"),
				// })
				expect(true).toBe(true) // Remove this placeholder
			})
		})

		describe("PUT - update", () => {
			it("updates existing resource", async () => {
				const mockContext = createMockContext()
				const mockSupabase = mockContext.get().supabase

				mockSupabase.single.mockResolvedValue({
					data: { id: "1", name: "Updated" },
					error: null,
				})

				// const result = await action({
				//   request: createRequest("PUT", { name: "Updated" }),
				//   context: mockContext,
				//   params: { id: "1" },
				// })
				//
				// expect(result).toMatchObject({ success: true })
				expect(true).toBe(true) // Remove this placeholder
			})
		})

		describe("DELETE", () => {
			it("deletes resource", async () => {
				const mockContext = createMockContext()
				const mockSupabase = mockContext.get().supabase

				mockSupabase.single.mockResolvedValue({
					data: { id: "1" },
					error: null,
				})

				// const result = await action({
				//   request: createRequest("DELETE"),
				//   context: mockContext,
				//   params: { id: "1" },
				// })
				//
				// expect(result).toMatchObject({ success: true })
				expect(true).toBe(true) // Remove this placeholder
			})
		})

		describe("error handling", () => {
			it("handles database errors gracefully", async () => {
				const mockContext = createMockContext()
				const mockSupabase = mockContext.get().supabase

				mockSupabase.single.mockResolvedValue({
					data: null,
					error: { code: "23505", message: "Unique constraint violation" },
				})

				// const result = await action({
				//   request: createRequest("POST", { name: "Duplicate" }),
				//   context: mockContext,
				//   params: {},
				// })
				//
				// expect(result).toMatchObject({ error: expect.any(String) })
				expect(true).toBe(true) // Remove this placeholder
			})

			it("handles unauthorized access", async () => {
				// Test with missing or invalid context
				const mockContext = {
					get: vi.fn().mockReturnValue(null),
				}

				// const result = await action({
				//   request: createRequest("POST", { name: "Test" }),
				//   context: mockContext,
				//   params: {},
				// })
				//
				// expect(result.status).toBe(401)
				expect(true).toBe(true) // Remove this placeholder
			})
		})
	})
})
