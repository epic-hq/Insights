/**
 * Billing Usage Recording
 *
 * Core module for recording LLM usage and spending credits.
 * All instrumented wrappers call through this module.
 *
 * @see docs/20-features-prds/specs/billing-credits-entitlements.md
 */

import consola from "consola";
import { createClient } from "@supabase/supabase-js";
import type { BillingContext } from "./context";
import { validateBillingContext } from "./context";
import { PLANS, type PlanId } from "~/config/plans";

// Lazy-init service role client for billing operations
let _serviceClient: ReturnType<typeof createClient> | null = null;

function getServiceClient() {
  if (!_serviceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for billing",
      );
    }
    _serviceClient = createClient(url, key);
  }
  return _serviceClient;
}

/**
 * Usage event to record
 */
export interface UsageEvent {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  resourceType?: string;
  resourceId?: string;
}

/**
 * Result of recording usage and spending credits
 */
export interface UsageResult {
  success: boolean;
  usageEventId: string | null;
  creditsCharged: number;
  limitStatus:
    | "ok"
    | "approaching_limit"
    | "soft_cap_warning"
    | "soft_cap_exceeded"
    | "hard_limit_exceeded"
    | "duplicate_ignored";
  newBalance?: number;
}

/**
 * Record usage and spend credits atomically.
 *
 * This is the main entry point for billing instrumentation.
 * It records the usage event and spends credits in one operation.
 */
export async function recordUsageAndSpendCredits(
  ctx: BillingContext,
  usage: UsageEvent,
  idempotencyKey: string,
): Promise<UsageResult> {
  validateBillingContext(ctx);

  const client = getServiceClient();
  const creditsCharged = Math.ceil(usage.estimatedCostUsd * 100); // 1 credit = $0.01

  try {
    // 1. Insert usage event
    const { data: usageEvent, error: usageError } = await client
      .from("usage_events")
      .upsert(
        {
          account_id: ctx.accountId,
          project_id: ctx.projectId || null,
          user_id: ctx.userId,
          provider: usage.provider,
          model: usage.model,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          estimated_cost_usd: usage.estimatedCostUsd,
          credits_charged: creditsCharged,
          feature_source: ctx.featureSource,
          resource_type: usage.resourceType || null,
          resource_id: usage.resourceId || null,
          idempotency_key: idempotencyKey,
        },
        {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        },
      )
      .select("id")
      .single();

    if (usageError) {
      // Check if it's a duplicate (no rows returned on conflict)
      if (usageError.code === "PGRST116") {
        consola.debug(`[billing] Duplicate usage event: ${idempotencyKey}`);
        return {
          success: true,
          usageEventId: null,
          creditsCharged: 0,
          limitStatus: "duplicate_ignored",
        };
      }
      throw usageError;
    }

    // 2. Get account's plan for limit calculation
    const planInfo = await getAccountPlan(ctx.accountId);
    const plan = PLANS[planInfo.planId];

    // 3. Spend credits atomically
    const { data: spendResult, error: spendError } = await client.rpc(
      "spend_credits_atomic",
      {
        p_account_id: ctx.accountId,
        p_amount: creditsCharged,
        p_soft_limit: plan.credits.softCapEnabled ? plan.credits.monthly : 0,
        p_hard_limit: plan.credits.softCapEnabled ? 0 : plan.credits.monthly,
        p_idempotency_key: `spend:${idempotencyKey}`,
        p_usage_event_id: usageEvent?.id || null,
        p_feature_source: ctx.featureSource,
        p_metadata: {
          userId: ctx.userId,
          projectId: ctx.projectId,
        },
      },
    );

    if (spendError) {
      consola.error("[billing] Failed to spend credits:", spendError);
      // Usage was recorded, but credit spend failed - log but don't block
      return {
        success: true,
        usageEventId: usageEvent?.id || null,
        creditsCharged,
        limitStatus: "ok",
      };
    }

    const result = spendResult?.[0] || {
      success: true,
      new_balance: 0,
      limit_status: "ok",
    };

    // Log if approaching limits (for monitoring)
    if (
      result.limit_status !== "ok" &&
      result.limit_status !== "duplicate_ignored"
    ) {
      consola.warn(
        `[billing] Account ${ctx.accountId} limit status: ${result.limit_status}, balance: ${result.new_balance}`,
      );
    }

    return {
      success: result.success,
      usageEventId: usageEvent?.id || null,
      creditsCharged,
      limitStatus: result.limit_status as UsageResult["limitStatus"],
      newBalance: result.new_balance,
    };
  } catch (error) {
    consola.error("[billing] Failed to record usage:", error);
    // Don't block on billing failures - log and continue
    return {
      success: false,
      usageEventId: null,
      creditsCharged: 0,
      limitStatus: "ok",
    };
  }
}

/**
 * Record usage without spending credits.
 * Use for tracking only (e.g., during Phase 1 soft launch).
 */
export async function recordUsageOnly(
  ctx: BillingContext,
  usage: UsageEvent,
  idempotencyKey: string,
): Promise<{ usageEventId: string | null }> {
  validateBillingContext(ctx);

  const client = getServiceClient();
  const creditsCharged = Math.ceil(usage.estimatedCostUsd * 100);

  try {
    const { data, error } = await client
      .from("usage_events")
      .upsert(
        {
          account_id: ctx.accountId,
          project_id: ctx.projectId || null,
          user_id: ctx.userId,
          provider: usage.provider,
          model: usage.model,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          estimated_cost_usd: usage.estimatedCostUsd,
          credits_charged: creditsCharged,
          feature_source: ctx.featureSource,
          resource_type: usage.resourceType || null,
          resource_id: usage.resourceId || null,
          idempotency_key: idempotencyKey,
        },
        {
          onConflict: "idempotency_key",
          ignoreDuplicates: true,
        },
      )
      .select("id")
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    return { usageEventId: data?.id || null };
  } catch (error) {
    consola.error("[billing] Failed to record usage:", error);
    return { usageEventId: null };
  }
}

/**
 * Get account's current plan.
 * TODO: This should query billing_subscriptions when we have real billing.
 */
async function getAccountPlan(
  accountId: string,
): Promise<{ planId: PlanId; seatCount: number }> {
  // For now, everyone is on free tier
  // TODO: Query billing_subscriptions.plan_name and map to PlanId
  return {
    planId: "free",
    seatCount: 1,
  };
}

/**
 * Check if account can perform an action (pre-flight check).
 * Use before expensive operations to fail fast.
 */
export async function checkAccountLimits(accountId: string): Promise<{
  canProceed: boolean;
  limitStatus: UsageResult["limitStatus"];
  balance: number;
  limit: number;
}> {
  const client = getServiceClient();
  const planInfo = await getAccountPlan(accountId);
  const plan = PLANS[planInfo.planId];

  try {
    const { data, error } = await client.rpc("get_credit_balance", {
      p_account_id: accountId,
    });

    if (error) throw error;

    const balance = data?.[0]?.balance || 0;
    const limit = plan.credits.monthly * (planInfo.seatCount || 1);

    let limitStatus: UsageResult["limitStatus"] = "ok";
    let canProceed = true;

    if (plan.credits.softCapEnabled) {
      // Soft cap logic
      if (balance < -limit * 0.2) {
        limitStatus = "soft_cap_exceeded";
        canProceed = true; // Still allow in soft cap
      } else if (balance < 0) {
        limitStatus = "soft_cap_warning";
      } else if (balance < limit * 0.2) {
        limitStatus = "approaching_limit";
      }
    } else {
      // Hard limit (free tier)
      if (balance <= 0) {
        limitStatus = "hard_limit_exceeded";
        canProceed = false;
      }
    }

    return { canProceed, limitStatus, balance, limit };
  } catch (error) {
    consola.error("[billing] Failed to check limits:", error);
    // Don't block on billing check failures
    return { canProceed: true, limitStatus: "ok", balance: 0, limit: 0 };
  }
}
