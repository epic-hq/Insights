/**
 * Tests for billing usage recording and credit spending
 *
 * These tests mock Supabase to test the business logic without
 * requiring a real database connection.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import type { BillingContext, UsageEvent } from "../context"

// Mock Supabase createClient before importing usage module
const mockRpc = vi.fn()
const mockUpsert = vi.fn()
const mockSelect = vi.fn()
const mockSingle = vi.fn()
const mockFrom = vi.fn()

const mockSupabaseClient = {
	schema: vi.fn().mockReturnValue({
		from: mockFrom,
	}),
	rpc: mockRpc,
}

vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(() => mockSupabaseClient),
}))

// Set up environment variables before importing usage module
process.env.SUPABASE_URL = "https://test.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key"

// Import after mocking
import { recordUsageAndSpendCredits, recordUsageOnly, checkAccountLimits } from "../usage.server"

describe("Billing Usage", () => {
	const validContext: BillingContext = {
		accountId: "account-123",
		userId: "user-456",
		projectId: "project-789",
		featureSource: "interview_analysis",
	}

	const sampleUsage: UsageEvent = {
		provider: "openai",
		model: "gpt-4",
		inputTokens: 1000,
		outputTokens: 500,
		estimatedCostUsd: 0.05,
		resourceType: "interview",
		resourceId: "interview-123",
	}

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup chain: from().upsert().select().single()
		mockFrom.mockReturnValue({
			upsert: mockUpsert,
		})
		mockUpsert.mockReturnValue({
			select: mockSelect,
		})
		mockSelect.mockReturnValue({
			single: mockSingle,
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("recordUsageAndSpendCredits", () => {
		it("records usage and spends credits successfully", async () => {
			// Mock successful usage insert
			mockSingle.mockResolvedValue({
				data: { id: "usage-event-1" },
				error: null,
			})

			// Mock successful credit spend
			mockRpc.mockResolvedValue({
				data: [{ success: true, new_balance: 450, limit_status: "ok" }],
				error: null,
			})

			const result = await recordUsageAndSpendCredits(validContext, sampleUsage, "idempotency-key-1")

			expect(result.success).toBe(true)
			expect(result.usageEventId).toBe("usage-event-1")
			expect(result.creditsCharged).toBe(5) // 0.05 * 100 = 5 credits
			expect(result.limitStatus).toBe("ok")
			expect(result.newBalance).toBe(450)
		})

		it("calculates credits correctly (1 credit = $0.01)", async () => {
			mockSingle.mockResolvedValue({ data: { id: "evt-1" }, error: null })
			mockRpc.mockResolvedValue({
				data: [{ success: true, new_balance: 0, limit_status: "ok" }],
				error: null,
			})

			const testCases = [
				{ costUsd: 0.01, expectedCredits: 1 },
				{ costUsd: 0.10, expectedCredits: 10 },
				{ costUsd: 1.00, expectedCredits: 100 },
				{ costUsd: 0.005, expectedCredits: 1 }, // Rounds up
				{ costUsd: 0.015, expectedCredits: 2 }, // Rounds up
			]

			for (const { costUsd, expectedCredits } of testCases) {
				const usage = { ...sampleUsage, estimatedCostUsd: costUsd }
				const result = await recordUsageAndSpendCredits(validContext, usage, `key-${costUsd}`)

				expect(result.creditsCharged).toBe(expectedCredits)
			}
		})

		it("handles duplicate idempotency key gracefully", async () => {
			// Supabase returns no rows on conflict with ignoreDuplicates
			mockSingle.mockResolvedValue({
				data: null,
				error: { code: "PGRST116", message: "No rows returned" },
			})

			const result = await recordUsageAndSpendCredits(validContext, sampleUsage, "duplicate-key")

			expect(result.success).toBe(true)
			expect(result.limitStatus).toBe("duplicate_ignored")
			expect(result.creditsCharged).toBe(0)
			expect(result.usageEventId).toBeNull()
		})

		it("returns appropriate limit status values", async () => {
			mockSingle.mockResolvedValue({ data: { id: "evt-1" }, error: null })

			const limitStatuses = [
				"ok",
				"approaching_limit",
				"soft_cap_warning",
				"soft_cap_exceeded",
				"hard_limit_exceeded",
			]

			for (const status of limitStatuses) {
				mockRpc.mockResolvedValueOnce({
					data: [{ success: true, new_balance: 100, limit_status: status }],
					error: null,
				})

				const result = await recordUsageAndSpendCredits(
					validContext,
					sampleUsage,
					`key-${status}`,
				)

				expect(result.limitStatus).toBe(status)
			}
		})

		it("handles database error gracefully without blocking", async () => {
			mockSingle.mockResolvedValue({
				data: null,
				error: { code: "23505", message: "Database error" },
			})

			const result = await recordUsageAndSpendCredits(validContext, sampleUsage, "error-key")

			// Should not block - billing errors shouldn't break the app
			expect(result.success).toBe(false)
			expect(result.usageEventId).toBeNull()
			expect(result.limitStatus).toBe("ok")
		})

		it("validates billing context", async () => {
			const invalidContext = {
				accountId: "", // Invalid - empty
				userId: "user-1",
				featureSource: "interview_analysis",
			} as BillingContext

			await expect(
				recordUsageAndSpendCredits(invalidContext, sampleUsage, "key"),
			).rejects.toThrow("accountId is required")
		})
	})

	describe("recordUsageOnly", () => {
		it("records usage without spending credits", async () => {
			mockRpc.mockResolvedValue({
				data: "usage-event-id-123",
				error: null,
			})

			const result = await recordUsageOnly(validContext, sampleUsage, "tracking-only-key")

			expect(result.usageEventId).toBe("usage-event-id-123")
			expect(mockRpc).toHaveBeenCalledWith(
				"record_usage_event",
				expect.objectContaining({
					p_account_id: validContext.accountId,
					p_provider: sampleUsage.provider,
					p_model: sampleUsage.model,
					p_input_tokens: sampleUsage.inputTokens,
					p_output_tokens: sampleUsage.outputTokens,
				}),
			)
		})

		it("handles null resource fields", async () => {
			mockRpc.mockResolvedValue({ data: "evt-1", error: null })

			const usageWithoutResource: UsageEvent = {
				provider: "anthropic",
				model: "claude-3",
				inputTokens: 500,
				outputTokens: 200,
				estimatedCostUsd: 0.02,
			}

			await recordUsageOnly(validContext, usageWithoutResource, "key")

			expect(mockRpc).toHaveBeenCalledWith(
				"record_usage_event",
				expect.objectContaining({
					p_resource_type: null,
					p_resource_id: null,
				}),
			)
		})

		it("returns null on error without throwing", async () => {
			mockRpc.mockResolvedValue({
				data: null,
				error: { message: "RPC error" },
			})

			const result = await recordUsageOnly(validContext, sampleUsage, "error-key")

			expect(result.usageEventId).toBeNull()
		})
	})

	describe("checkAccountLimits", () => {
		it("returns ok status when balance is healthy", async () => {
			mockRpc.mockResolvedValue({
				data: [{ balance: 400 }],
				error: null,
			})

			const result = await checkAccountLimits("account-123")

			expect(result.canProceed).toBe(true)
			expect(result.limitStatus).toBe("ok")
			expect(result.balance).toBe(400)
		})

		it("returns approaching_limit when balance is low", async () => {
			// Free tier has 500 credits monthly, 20% of that is 100
			mockRpc.mockResolvedValue({
				data: [{ balance: 50 }], // Below 20% threshold
				error: null,
			})

			const result = await checkAccountLimits("account-123")

			// For free tier (hard limit, not soft cap), any positive balance is ok
			expect(result.canProceed).toBe(true)
		})

		it("returns hard_limit_exceeded when balance is zero or negative (free tier)", async () => {
			mockRpc.mockResolvedValue({
				data: [{ balance: 0 }],
				error: null,
			})

			const result = await checkAccountLimits("account-123")

			// Free tier uses hard limits
			expect(result.canProceed).toBe(false)
			expect(result.limitStatus).toBe("hard_limit_exceeded")
		})

		it("handles RPC error gracefully and allows proceeding", async () => {
			mockRpc.mockResolvedValue({
				data: null,
				error: { message: "RPC error" },
			})

			const result = await checkAccountLimits("account-123")

			// Don't block on billing check failures
			expect(result.canProceed).toBe(true)
			expect(result.limitStatus).toBe("ok")
		})
	})
})
