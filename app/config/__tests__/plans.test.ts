/**
 * Tests for plan configuration and helper functions
 *
 * These are pure functions that test the plan definitions and utilities.
 */

import { describe, expect, it } from "vitest"
import {
	PLANS,
	PLAN_IDS,
	getPlan,
	hasFeature,
	getLimitDisplay,
	getMonthlyCredits,
	usesSoftCaps,
	type PlanId,
} from "../plans"

describe("Plans Configuration", () => {
	describe("PLANS", () => {
		it("contains all defined plan IDs", () => {
			for (const planId of PLAN_IDS) {
				expect(PLANS[planId]).toBeDefined()
				expect(PLANS[planId].id).toBe(planId)
			}
		})

		it("free plan has hard limits (no soft cap)", () => {
			expect(PLANS.free.credits.softCapEnabled).toBe(false)
		})

		it("paid plans have soft caps enabled", () => {
			expect(PLANS.starter.credits.softCapEnabled).toBe(true)
			expect(PLANS.pro.credits.softCapEnabled).toBe(true)
			expect(PLANS.team.credits.softCapEnabled).toBe(true)
		})

		it("team plan has per-user pricing", () => {
			expect(PLANS.team.perUser).toBe(true)
			expect(PLANS.free.perUser).toBe(false)
			expect(PLANS.starter.perUser).toBe(false)
			expect(PLANS.pro.perUser).toBe(false)
		})

		it("pro plan has unlimited projects", () => {
			expect(PLANS.pro.limits.projects).toBe(Number.POSITIVE_INFINITY)
		})

		it("free plan has limited projects", () => {
			expect(PLANS.free.limits.projects).toBe(1)
		})
	})

	describe("getPlan", () => {
		it("returns correct plan configuration", () => {
			const freePlan = getPlan("free")
			expect(freePlan.name).toBe("Free")
			expect(freePlan.price.monthly).toBe(0)

			const proPlan = getPlan("pro")
			expect(proPlan.name).toBe("Pro")
			expect(proPlan.price.monthly).toBe(29)
		})
	})

	describe("hasFeature", () => {
		it("returns false for team features on free plan", () => {
			expect(hasFeature("free", "team_workspace")).toBe(false)
			expect(hasFeature("free", "sso")).toBe(false)
		})

		it("returns true for team features on team plan", () => {
			expect(hasFeature("team", "team_workspace")).toBe(true)
			expect(hasFeature("team", "sso")).toBe(true)
		})

		it("returns false for survey AI on free plan", () => {
			expect(hasFeature("free", "survey_ai_analysis")).toBe(false)
		})

		it("returns true for survey AI on paid plans", () => {
			expect(hasFeature("starter", "survey_ai_analysis")).toBe(true)
			expect(hasFeature("pro", "survey_ai_analysis")).toBe(true)
		})
	})

	describe("getLimitDisplay", () => {
		it('returns "Unlimited" for infinite limits', () => {
			expect(getLimitDisplay("pro", "ai_analyses")).toBe("Unlimited")
			expect(getLimitDisplay("pro", "projects")).toBe("Unlimited")
		})

		it("returns numeric string for finite limits", () => {
			expect(getLimitDisplay("free", "ai_analyses")).toBe("5")
			expect(getLimitDisplay("free", "projects")).toBe("1")
		})

		it('returns "—" for zero voice minutes', () => {
			expect(getLimitDisplay("free", "voice_minutes")).toBe("—")
		})

		it("returns formatted number for large limits", () => {
			expect(getLimitDisplay("pro", "survey_responses")).toBe("2,000")
		})
	})

	describe("getMonthlyCredits", () => {
		it("returns base credits for non-per-user plans", () => {
			expect(getMonthlyCredits("free")).toBe(500)
			expect(getMonthlyCredits("starter")).toBe(2000)
			expect(getMonthlyCredits("pro")).toBe(5000)
		})

		it("multiplies by seat count for team plan", () => {
			expect(getMonthlyCredits("team", 1)).toBe(4000)
			expect(getMonthlyCredits("team", 3)).toBe(12000)
			expect(getMonthlyCredits("team", 10)).toBe(40000)
		})

		it("ignores seat count for non-per-user plans", () => {
			expect(getMonthlyCredits("pro", 5)).toBe(5000) // Still just 5000
		})
	})

	describe("usesSoftCaps", () => {
		it("returns false for free plan", () => {
			expect(usesSoftCaps("free")).toBe(false)
		})

		it("returns true for paid plans", () => {
			expect(usesSoftCaps("starter")).toBe(true)
			expect(usesSoftCaps("pro")).toBe(true)
			expect(usesSoftCaps("team")).toBe(true)
		})
	})

	describe("plan price consistency", () => {
		it("annual price is less than monthly price for paid plans", () => {
			const paidPlans: PlanId[] = ["starter", "pro", "team"]
			for (const planId of paidPlans) {
				const plan = getPlan(planId)
				expect(plan.price.annual).toBeLessThan(plan.price.monthly)
			}
		})

		it("free plan has zero prices", () => {
			const freePlan = getPlan("free")
			expect(freePlan.price.monthly).toBe(0)
			expect(freePlan.price.annual).toBe(0)
		})
	})

	describe("plan credit hierarchy", () => {
		it("higher tier plans have more credits", () => {
			const credits = {
				free: getMonthlyCredits("free"),
				starter: getMonthlyCredits("starter"),
				pro: getMonthlyCredits("pro"),
				team: getMonthlyCredits("team", 1),
			}

			expect(credits.free).toBeLessThan(credits.starter)
			expect(credits.starter).toBeLessThan(credits.team)
			expect(credits.team).toBeLessThan(credits.pro)
		})
	})
})
