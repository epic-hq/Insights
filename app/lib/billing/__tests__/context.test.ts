/**
 * Tests for BillingContext validation and factories
 *
 * These are pure functions that don't require database mocking.
 */

import { describe, expect, it } from "vitest"
import {
	validateBillingContext,
	systemBillingContext,
	userBillingContext,
	FEATURE_SOURCES,
	type BillingContext,
} from "../context"

describe("BillingContext", () => {
	describe("validateBillingContext", () => {
		it("passes for valid context with all required fields", () => {
			const ctx: BillingContext = {
				accountId: "account-123",
				userId: "user-456",
				featureSource: "interview_analysis",
			}

			// Should not throw
			expect(() => validateBillingContext(ctx)).not.toThrow()
		})

		it("passes for system context with null userId", () => {
			const ctx: BillingContext = {
				accountId: "account-123",
				userId: null,
				featureSource: "interview_analysis",
			}

			expect(() => validateBillingContext(ctx)).not.toThrow()
		})

		it("throws when accountId is missing", () => {
			const ctx = {
				accountId: "",
				userId: "user-456",
				featureSource: "interview_analysis",
			} as BillingContext

			expect(() => validateBillingContext(ctx)).toThrow("accountId is required")
		})

		it("throws when featureSource is missing", () => {
			const ctx = {
				accountId: "account-123",
				userId: "user-456",
				featureSource: "" as never,
			} as BillingContext

			expect(() => validateBillingContext(ctx)).toThrow("featureSource is required")
		})

		it("accepts all valid feature sources", () => {
			for (const featureSource of FEATURE_SOURCES) {
				const ctx: BillingContext = {
					accountId: "account-123",
					userId: "user-456",
					featureSource,
				}

				expect(() => validateBillingContext(ctx)).not.toThrow()
			}
		})
	})

	describe("systemBillingContext", () => {
		it("creates context with null userId for background tasks", () => {
			const ctx = systemBillingContext("account-123", "interview_analysis")

			expect(ctx).toEqual({
				accountId: "account-123",
				userId: null,
				projectId: undefined,
				featureSource: "interview_analysis",
			})
		})

		it("includes projectId when provided", () => {
			const ctx = systemBillingContext("account-123", "interview_analysis", "project-456")

			expect(ctx.projectId).toBe("project-456")
		})

		it("creates valid context that passes validation", () => {
			const ctx = systemBillingContext("account-123", "lens_application")

			expect(() => validateBillingContext(ctx)).not.toThrow()
		})
	})

	describe("userBillingContext", () => {
		it("creates context with all user fields", () => {
			const ctx = userBillingContext({
				accountId: "account-123",
				userId: "user-456",
				featureSource: "project_status_agent",
				projectId: "project-789",
			})

			expect(ctx).toEqual({
				accountId: "account-123",
				userId: "user-456",
				projectId: "project-789",
				featureSource: "project_status_agent",
			})
		})

		it("creates valid context that passes validation", () => {
			const ctx = userBillingContext({
				accountId: "account-123",
				userId: "user-456",
				featureSource: "semantic_search",
			})

			expect(() => validateBillingContext(ctx)).not.toThrow()
		})

		it("handles missing optional projectId", () => {
			const ctx = userBillingContext({
				accountId: "account-123",
				userId: "user-456",
				featureSource: "voice_chat",
			})

			expect(ctx.projectId).toBeUndefined()
		})
	})

	describe("FEATURE_SOURCES", () => {
		it("contains all expected interview processing sources", () => {
			expect(FEATURE_SOURCES).toContain("interview_analysis")
			expect(FEATURE_SOURCES).toContain("interview_extraction")
			expect(FEATURE_SOURCES).toContain("interview_insights")
			expect(FEATURE_SOURCES).toContain("interview_personas")
			expect(FEATURE_SOURCES).toContain("interview_transcription")
		})

		it("contains all expected lens sources", () => {
			expect(FEATURE_SOURCES).toContain("lens_application")
			expect(FEATURE_SOURCES).toContain("lens_synthesis")
			expect(FEATURE_SOURCES).toContain("lens_qa")
		})

		it("contains all expected agent sources", () => {
			expect(FEATURE_SOURCES).toContain("project_status_agent")
			expect(FEATURE_SOURCES).toContain("project_setup_agent")
			expect(FEATURE_SOURCES).toContain("interview_agent")
			expect(FEATURE_SOURCES).toContain("research_agent")
		})
	})
})
