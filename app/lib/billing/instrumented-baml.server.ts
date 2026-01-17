/**
 * Instrumented BAML Wrapper with Billing
 *
 * Extends the existing runBamlWithTracing to add billing integration.
 * Use this instead of runBamlWithTracing when billing is enabled.
 *
 * @example
 * ```ts
 * import { runBamlWithBilling } from "~/lib/billing/instrumented-baml.server";
 *
 * const { result } = await runBamlWithBilling(
 *   { accountId, userId, featureSource: "interview_analysis" },
 *   {
 *     functionName: "ExtractEvidence",
 *     input: { transcript },
 *     bamlCall: (client) => client.ExtractEvidence(transcript),
 *   },
 *   `task:${taskRunId}:extract-evidence`
 * );
 * ```
 */

import consola from "consola"
import type { BamlUsageSummary } from "~/lib/baml/collector.server"
import { runBamlWithTracing } from "~/lib/baml/runBamlWithTracing.server"
import type { BillingContext } from "./context"
import { recordUsageAndSpendCredits, type UsageResult } from "./usage.server"

// Re-export for convenience
export type { BillingContext } from "./context"
export { systemBillingContext, userBillingContext } from "./context"

/**
 * Options for BAML calls (matches runBamlWithTracing)
 */
interface BamlCallOptions<TResult> {
	functionName: string
	traceName?: string
	input?: Record<string, unknown> | string | null
	metadata?: Record<string, unknown>
	bamlCall: (client: any) => Promise<TResult>
	costEnvPrefix?: string
	logUsageLabel?: string
	model?: string
	/** Resource being processed (for tracking) */
	resourceType?: string
	resourceId?: string
}

/**
 * Result from instrumented BAML call
 */
interface BamlWithBillingResult<TResult> {
	result: TResult
	usage?: BamlUsageSummary | null
	billing: UsageResult
}

/**
 * Run a BAML function with billing integration.
 *
 * This wraps the existing runBamlWithTracing and adds:
 * - Usage recording to billing.usage_events
 * - Credit spending via billing.credit_ledger
 * - Limit checking and status reporting
 *
 * @param ctx - Billing context (accountId, userId, featureSource)
 * @param opts - BAML call options
 * @param idempotencyKey - Unique key to prevent duplicate charges
 * @returns Result with billing status
 */
export async function runBamlWithBilling<TResult>(
	ctx: BillingContext,
	opts: BamlCallOptions<TResult>,
	idempotencyKey: string
): Promise<BamlWithBillingResult<TResult>> {
	// Run the BAML call with existing tracing
	const { result, usage } = await runBamlWithTracing({
		...opts,
		metadata: {
			...opts.metadata,
			accountId: ctx.accountId,
			userId: ctx.userId,
			projectId: ctx.projectId,
			featureSource: ctx.featureSource,
		},
	})

	// Record usage and spend credits
	let billing: UsageResult = {
		success: true,
		usageEventId: null,
		creditsCharged: 0,
		limitStatus: "ok",
	}

	if (usage?.totalCostUsd && usage.totalCostUsd > 0) {
		billing = await recordUsageAndSpendCredits(
			ctx,
			{
				provider: inferProvider(opts.model),
				model: opts.model || process.env.BAML_DEFAULT_MODEL || "unknown",
				inputTokens: usage.inputTokens || 0,
				outputTokens: usage.outputTokens || 0,
				estimatedCostUsd: usage.totalCostUsd,
				resourceType: opts.resourceType,
				resourceId: opts.resourceId,
			},
			idempotencyKey
		)

		// Log billing status for monitoring
		if (billing.limitStatus !== "ok" && billing.limitStatus !== "duplicate_ignored") {
			consola.warn(`[billing:baml] ${opts.functionName} - Account ${ctx.accountId}: ${billing.limitStatus}`)
		}
	}

	return { result, usage, billing }
}

/**
 * Run BAML with billing, throwing on hard limit exceeded.
 * Use for operations that should be blocked when limits are hit.
 */
export async function runBamlWithBillingOrThrow<TResult>(
	ctx: BillingContext,
	opts: BamlCallOptions<TResult>,
	idempotencyKey: string
): Promise<BamlWithBillingResult<TResult>> {
	const result = await runBamlWithBilling(ctx, opts, idempotencyKey)

	if (result.billing.limitStatus === "hard_limit_exceeded") {
		throw new UsageLimitError(
			`Account ${ctx.accountId} has exceeded usage limits for ${ctx.featureSource}`,
			result.billing
		)
	}

	return result
}

/**
 * Error thrown when usage limits are exceeded
 */
export class UsageLimitError extends Error {
	constructor(
		message: string,
		public readonly billing: UsageResult
	) {
		super(message)
		this.name = "UsageLimitError"
	}
}

/**
 * Infer provider from model name
 */
function inferProvider(model?: string): string {
	if (!model) return "unknown"
	const m = model.toLowerCase()
	if (m.includes("gpt") || m.includes("o1") || m.includes("o3")) return "openai"
	if (m.includes("claude") || m.includes("sonnet") || m.includes("opus") || m.includes("haiku")) return "anthropic"
	if (m.includes("gemini")) return "google"
	return "unknown"
}
