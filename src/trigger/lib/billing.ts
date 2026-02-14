/**
 * Billing utilities for Trigger.dev tasks
 *
 * Provides helpers for recording LLM usage and spending credits in background tasks.
 * All LLM calls in Trigger.dev tasks should use these utilities.
 *
 * @see docs/20-features-prds/features/billing/specs/billing-credits-entitlements.md Section 5.6
 */

import consola from "consola";
import {
  type BillingContext,
  type FeatureSource,
  type UsageEvent,
  type UsageResult,
  recordUsageAndSpendCredits,
  systemBillingContext,
  userBillingContext,
} from "~/lib/billing";
import type { InterviewMetadata } from "../interview/v2/extractEvidenceCore";

/**
 * Create a billing context from task metadata.
 *
 * Uses userBillingContext if userId is available, otherwise systemBillingContext.
 * This ensures proper attribution for both user-triggered and background tasks.
 */
export function createTaskBillingContext(
  metadata: Pick<InterviewMetadata, "accountId" | "userId" | "projectId">,
  featureSource: FeatureSource,
): BillingContext {
  if (metadata.userId) {
    return userBillingContext({
      accountId: metadata.accountId,
      userId: metadata.userId,
      featureSource,
      projectId: metadata.projectId,
    });
  }
  return systemBillingContext(
    metadata.accountId,
    featureSource,
    metadata.projectId,
  );
}

/**
 * Record usage and spend credits for a BAML/LLM call in a Trigger.dev task.
 *
 * This is the main entry point for billing instrumentation in background tasks.
 * Call this AFTER the LLM call completes with the usage summary.
 *
 * @param ctx - Billing context from createTaskBillingContext
 * @param usage - Usage details (provider, model, tokens, cost)
 * @param idempotencyKey - Unique key to prevent duplicate charges (e.g., `task:${runId}:${step}`)
 * @returns Usage result with billing status
 *
 * @example
 * ```ts
 * const billingCtx = createTaskBillingContext(metadata, "interview_extraction");
 *
 * // Make the LLM call
 * const result = await b.ExtractEvidenceFromTranscriptV2(...);
 * const usage = summarizeCollectorUsage(collector);
 *
 * // Record usage and spend credits
 * await recordTaskUsage(
 *   billingCtx,
 *   {
 *     provider: "anthropic",
 *     model: "claude-sonnet",
 *     inputTokens: usage.inputTokens,
 *     outputTokens: usage.outputTokens,
 *     estimatedCostUsd: usage.totalCostUsd,
 *     resourceType: "interview",
 *     resourceId: interviewId,
 *   },
 *   `interview:${interviewId}:extract-evidence`
 * );
 * ```
 */
export async function recordTaskUsage(
  ctx: BillingContext,
  usage: UsageEvent,
  idempotencyKey: string,
): Promise<UsageResult> {
  try {
    const result = await recordUsageAndSpendCredits(ctx, usage, idempotencyKey);

    // Log billing status for monitoring
    if (
      result.limitStatus !== "ok" &&
      result.limitStatus !== "duplicate_ignored"
    ) {
      consola.warn(
        `[billing:task] Account ${ctx.accountId} limit status: ${result.limitStatus}`,
        `Feature: ${ctx.featureSource}, Credits charged: ${result.creditsCharged}`,
      );
    }

    return result;
  } catch (error) {
    // Don't block task execution on billing failures
    consola.error("[billing:task] Failed to record usage:", error);
    return {
      success: false,
      usageEventId: null,
      creditsCharged: 0,
      limitStatus: "ok",
    };
  }
}

/**
 * Infer provider from model name
 */
export function inferProvider(model?: string): string {
  if (!model) return "unknown";
  const m = model.toLowerCase();
  if (m.includes("gpt") || m.includes("o1") || m.includes("o3"))
    return "openai";
  if (
    m.includes("claude") ||
    m.includes("sonnet") ||
    m.includes("opus") ||
    m.includes("haiku")
  )
    return "anthropic";
  if (m.includes("gemini")) return "google";
  return "unknown";
}

// Re-export types and functions for convenience
export type { BillingContext, FeatureSource, UsageEvent, UsageResult };
export { systemBillingContext, userBillingContext };
