/**
 * Feature Gate - Usage Limit Checks
 *
 * Server-side checks for metered usage limits.
 * Queries current usage from database and compares against plan limits.
 */

import { PLAN_IDS, PLANS, type PlanId } from "~/config/plans"
import { createSupabaseAdminClient } from "~/lib/supabase/client.server"
import { FeatureGateError } from "./errors"
import type { FeatureGateContext, LimitCheckResult, LimitKey } from "./types"

/**
 * Check if account is within usage limits.
 * Queries current usage from database.
 *
 * @example
 * const result = await checkLimitAccess(ctx, "projects")
 * if (!result.allowed) {
 *   return json({ error: "upgrade_required", ...result }, { status: 403 })
 * }
 * if (result.reason === "limit_approaching") {
 *   // Show warning banner
 * }
 */
export async function checkLimitAccess(ctx: FeatureGateContext, limit: LimitKey): Promise<LimitCheckResult> {
	const plan = PLANS[ctx.planId]
	const maxLimit = plan.limits[limit]

	// Unlimited = always allowed
	if (maxLimit === Number.POSITIVE_INFINITY) {
		return { allowed: true }
	}

	// Get current usage from database
	const currentUsage = await getCurrentUsage(ctx.accountId, limit)
	const remaining = Math.max(0, maxLimit - currentUsage)
	const percentUsed = maxLimit > 0 ? (currentUsage / maxLimit) * 100 : 0

	// Check if at or over limit
	if (currentUsage >= maxLimit) {
		return {
			allowed: false,
			reason: "limit_exceeded",
			currentUsage,
			limit: maxLimit,
			remaining: 0,
			percentUsed: 100,
			upgradeUrl: `/pricing?reason=${String(limit)}_limit`,
			requiredPlan: findNextPlanWithHigherLimit(ctx.planId, limit),
		}
	}

	// Warn if approaching limit (80%+)
	if (percentUsed >= 80) {
		return {
			allowed: true,
			reason: "limit_approaching",
			currentUsage,
			limit: maxLimit,
			remaining,
			percentUsed,
		}
	}

	return {
		allowed: true,
		currentUsage,
		limit: maxLimit,
		remaining,
		percentUsed,
	}
}

/**
 * Require usage limit - throws FeatureGateError if exceeded.
 * Use for cleaner control flow in API routes.
 *
 * @example
 * try {
 *   await requireLimitAccess(ctx, "projects")
 *   // ... create project logic
 * } catch (error) {
 *   if (error instanceof FeatureGateError) {
 *     return json(error.toJSON(), { status: 403 })
 *   }
 *   throw error
 * }
 */
export async function requireLimitAccess(ctx: FeatureGateContext, limit: LimitKey): Promise<LimitCheckResult> {
	const result = await checkLimitAccess(ctx, limit)
	if (!result.allowed) {
		throw new FeatureGateError(limit, result)
	}
	return result
}

/**
 * Get current usage count for a specific limit.
 */
async function getCurrentUsage(accountId: string, limit: LimitKey): Promise<number> {
	switch (limit) {
		case "ai_analyses":
			return getMonthlyAiAnalysisCount(accountId)
		case "voice_minutes":
			return getMonthlyVoiceMinutes(accountId)
		case "survey_responses":
			return getMonthlySurveyResponses(accountId)
		case "projects":
			return getActiveProjectCount(accountId)
		default:
			return 0
	}
}

/**
 * Find the next plan tier that has a higher limit for the given metric.
 */
function findNextPlanWithHigherLimit(currentPlanId: PlanId, limit: LimitKey): PlanId {
	const currentLimit = PLANS[currentPlanId].limits[limit]

	for (const planId of PLAN_IDS) {
		const planLimit = PLANS[planId].limits[limit]
		if (planLimit > currentLimit) {
			return planId
		}
	}

	return "team" // Default to highest tier
}

// -----------------------------------------------------------------------------
// Usage Query Implementations
// -----------------------------------------------------------------------------

/**
 * Get count of AI analyses in the current billing month.
 */
async function getMonthlyAiAnalysisCount(accountId: string): Promise<number> {
	const supabase = createSupabaseAdminClient()
	const startOfMonth = getStartOfMonth()

	const { count, error } = await supabase
		.from("interviews")
		.select("*", { count: "exact", head: true })
		.eq("account_id", accountId)
		.gte("created_at", startOfMonth.toISOString())
		.not("status", "eq", "pending")

	if (error) {
		console.error("[checkLimit] Failed to get AI analysis count:", error)
		return 0
	}

	return count ?? 0
}

/**
 * Get total voice chat minutes used in the current billing month.
 * Voice minutes are tracked in billing.usage_events with feature_source = 'voice_chat'.
 * We estimate minutes from output_tokens (which stores duration in seconds).
 */
async function getMonthlyVoiceMinutes(accountId: string): Promise<number> {
	const supabase = createSupabaseAdminClient()
	const startOfMonth = getStartOfMonth()

	// Query voice_chat usage events from billing schema
	// Duration is stored in output_tokens field (in seconds)
	const { data, error } = await supabase
		.schema("billing")
		.from("usage_events")
		.select("output_tokens")
		.eq("account_id", accountId)
		.eq("feature_source", "voice_chat")
		.gte("created_at", startOfMonth.toISOString())

	if (error) {
		console.error("[checkLimit] Failed to get voice minutes:", error)
		return 0
	}

	// Sum all durations and convert to minutes
	const totalSeconds = ((data as { output_tokens: number }[] | null) ?? []).reduce(
		(sum, event) => sum + (event.output_tokens ?? 0),
		0
	)
	return Math.ceil(totalSeconds / 60)
}

/**
 * Get count of survey responses in the current billing month.
 */
async function getMonthlySurveyResponses(accountId: string): Promise<number> {
	const supabase = createSupabaseAdminClient()
	const startOfMonth = getStartOfMonth()

	const { count, error } = await supabase
		.from("survey_responses")
		.select("*", { count: "exact", head: true })
		.eq("account_id", accountId)
		.gte("created_at", startOfMonth.toISOString())

	if (error) {
		console.error("[checkLimit] Failed to get survey response count:", error)
		return 0
	}

	return count ?? 0
}

/**
 * Get count of active (non-archived) projects.
 */
async function getActiveProjectCount(accountId: string): Promise<number> {
	const supabase = createSupabaseAdminClient()

	const { count, error } = await supabase
		.from("projects")
		.select("*", { count: "exact", head: true })
		.eq("account_id", accountId)
		.neq("status", "archived")

	if (error) {
		console.error("[checkLimit] Failed to get project count:", error)
		return 0
	}

	return count ?? 0
}

/**
 * Get the start of the current billing month.
 * Assumes billing cycles start on the 1st of each month.
 */
function getStartOfMonth(): Date {
	const now = new Date()
	return new Date(now.getFullYear(), now.getMonth(), 1)
}
