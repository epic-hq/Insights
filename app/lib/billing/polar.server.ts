/**
 * Polar.sh Billing Integration
 *
 * Handles webhook events from Polar.sh to sync subscriptions,
 * customers, and feature entitlements.
 *
 * @see https://polar.sh/docs/integrate/sdk/adapters/hono
 */

import consola from "consola";
import { PLANS, type PlanId } from "~/config/plans";
import { supabaseAdmin } from "~/lib/supabase/client.server";

/**
 * Map Polar product IDs to internal plan IDs.
 * Includes both production and sandbox product IDs.
 */
export const POLAR_PRODUCT_MAP: Record<string, PlanId> = {
  // ===================
  // PRODUCTION Products
  // ===================
  // Monthly
  "7b908954-435f-4558-a6b1-857aacd0ceaf": "free",
  "43cd1bf3-1b5b-45e9-9c87-fbd21fa82954": "starter",
  "c09e11de-1ab6-4f0f-86ca-799ad512be5b": "pro",
  "f69fb092-eab5-46e0-820a-d15fafef8a1d": "team",
  // Annual
  "e0fc0ce2-c0fd-43c9-bc8b-abb2c1df76ad": "starter",
  "95c62fc0-e26a-4b33-8e5c-fcaf76972a9e": "pro",
  "1e2c65e8-907e-4be3-be4d-8d78613ce66a": "team",

  // ===================
  // SANDBOX Products
  // ===================
  // Monthly
  "58235e6f-ff64-4d85-a295-ac7baac185cf": "free",
  "db5c08d1-a954-4ccd-837e-a35d2e6f4020": "starter",
  "efa737bd-10cc-4bb5-91da-31c48ed9bead": "pro",
  "9da89ec4-2724-41c5-a1e7-547930706a14": "team",
  // Annual
  "23b2e81e-1a3f-48e4-b5e8-025a22cca5f7": "starter",
  "a71ebfb2-3c62-458d-9c40-063597811b04": "pro",
  "79bd4d5c-9838-4464-8ce1-bd56716cdf15": "team",
};

type SubscriptionStatus =
  | "trialing"
  | "active"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "unpaid";

/**
 * Map Polar subscription status to our internal status enum
 */
function mapPolarStatus(polarStatus: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: "active",
    trialing: "trialing",
    canceled: "canceled",
    incomplete: "incomplete",
    incomplete_expired: "incomplete_expired",
    past_due: "past_due",
    unpaid: "unpaid",
  };
  return statusMap[polarStatus] ?? "active";
}

/**
 * Upsert billing customer from Polar webhook
 */
export async function upsertBillingCustomer(params: {
  polarCustomerId: string;
  accountId: string;
  email?: string;
}) {
  const { polarCustomerId, accountId, email } = params;

  consola.info("[polar] Upserting billing customer", {
    polarCustomerId,
    accountId,
  });

  const { error } = await supabaseAdmin
    .schema("accounts")
    .from("billing_customers")
    .upsert(
      {
        id: polarCustomerId,
        account_id: accountId,
        email: email ?? null,
        provider: "polar",
        active: true,
      },
      { onConflict: "id" },
    );

  if (error) {
    consola.error("[polar] Failed to upsert billing customer", error);
    throw error;
  }
}

/**
 * Upsert billing subscription from Polar webhook
 */
export async function upsertBillingSubscription(params: {
  polarSubscriptionId: string;
  polarCustomerId: string;
  accountId: string;
  status: string;
  productId: string;
  quantity?: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: string;
  endedAt?: string;
  trialStart?: string;
  trialEnd?: string;
  metadata?: Record<string, unknown>;
}) {
  const {
    polarSubscriptionId,
    polarCustomerId,
    accountId,
    status,
    productId,
    quantity,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    canceledAt,
    endedAt,
    trialStart,
    trialEnd,
    metadata,
  } = params;

  // Resolve plan name from product ID
  const planId = POLAR_PRODUCT_MAP[productId] ?? "starter";
  const planName = PLANS[planId]?.name ?? "Unknown";

  consola.info("[polar] Upserting billing subscription", {
    polarSubscriptionId,
    accountId,
    status,
    planId,
    planName,
  });

  const { error } = await supabaseAdmin
    .schema("accounts")
    .from("billing_subscriptions")
    .upsert(
      {
        id: polarSubscriptionId,
        account_id: accountId,
        billing_customer_id: polarCustomerId,
        status: mapPolarStatus(status),
        price_id: productId,
        plan_name: planName,
        quantity: quantity ?? 1,
        cancel_at_period_end: cancelAtPeriodEnd ?? false,
        current_period_start: currentPeriodStart
          ? new Date(currentPeriodStart).toISOString()
          : new Date().toISOString(),
        current_period_end: currentPeriodEnd
          ? new Date(currentPeriodEnd).toISOString()
          : new Date().toISOString(),
        canceled_at: canceledAt ? new Date(canceledAt).toISOString() : null,
        ended_at: endedAt ? new Date(endedAt).toISOString() : null,
        trial_start: trialStart ? new Date(trialStart).toISOString() : null,
        trial_end: trialEnd ? new Date(trialEnd).toISOString() : null,
        metadata: (metadata ?? {}) as unknown as Record<
          string,
          string | number | boolean | null
        >,
        provider: "polar",
      },
      { onConflict: "id" },
    );

  if (error) {
    consola.error("[polar] Failed to upsert billing subscription", error);
    throw error;
  }

  // Note: billing_subscriptions.plan_name is the single source of truth for plan
  // No need to sync to accounts.plan_id

  return { planId };
}

/**
 * Provision feature entitlements for a plan
 * Called when a subscription becomes active
 */
export async function provisionPlanEntitlements(params: {
  accountId: string;
  planId: PlanId;
  validFrom?: Date;
  validUntil?: Date;
}) {
  const { accountId, planId, validFrom, validUntil } = params;
  const plan = PLANS[planId];

  if (!plan) {
    consola.warn("[polar] Unknown plan ID, skipping entitlements", { planId });
    return;
  }

  consola.info("[polar] Provisioning entitlements for plan", {
    accountId,
    planId,
  });

  // Delete any existing plan-based entitlements to avoid duplicate key conflicts
  // (unique constraint on account_id, feature_key, valid_from)
  const { error: deleteError, count: deleteCount } = await supabaseAdmin
    .schema("billing")
    .from("feature_entitlements")
    .delete({ count: "exact" })
    .eq("account_id", accountId)
    .eq("source", "plan");

  if (deleteError) {
    consola.error(
      "[polar] Failed to delete existing entitlements",
      deleteError,
    );
    throw deleteError;
  }

  consola.info("[polar] Deleted existing entitlements", {
    accountId,
    count: deleteCount,
  });

  // Build entitlements from plan features
  const entitlements: Array<{
    account_id: string;
    feature_key: string;
    enabled: boolean;
    source: "plan";
    valid_from: string;
    valid_until: string | null;
    quantity_limit: number | null;
    quantity_used: number;
  }> = [];

  const now = (validFrom ?? new Date()).toISOString();
  const until = validUntil?.toISOString() ?? null;

  // Boolean features
  for (const [featureKey, enabled] of Object.entries(plan.features)) {
    entitlements.push({
      account_id: accountId,
      feature_key: featureKey,
      enabled,
      source: "plan",
      valid_from: now,
      valid_until: until,
      quantity_limit: null,
      quantity_used: 0,
    });
  }

  // Metered features with quantity limits
  if (plan.limits.voice_minutes > 0) {
    entitlements.push({
      account_id: accountId,
      feature_key: "voice_chat",
      enabled: true,
      source: "plan",
      valid_from: now,
      valid_until: until,
      quantity_limit:
        plan.limits.voice_minutes === Number.POSITIVE_INFINITY
          ? null
          : plan.limits.voice_minutes,
      quantity_used: 0,
    });
  }

  if (plan.limits.survey_responses > 0) {
    entitlements.push({
      account_id: accountId,
      feature_key: "survey_responses",
      enabled: true,
      source: "plan",
      valid_from: now,
      valid_until: until,
      quantity_limit:
        plan.limits.survey_responses === Number.POSITIVE_INFINITY
          ? null
          : plan.limits.survey_responses,
      quantity_used: 0,
    });
  }

  // AI analysis - use credits system, not entitlement quantity
  entitlements.push({
    account_id: accountId,
    feature_key: "ai_analysis",
    enabled: true,
    source: "plan",
    valid_from: now,
    valid_until: until,
    quantity_limit:
      plan.limits.ai_analyses === Number.POSITIVE_INFINITY
        ? null
        : plan.limits.ai_analyses,
    quantity_used: 0,
  });

  // Insert all entitlements using upsert to handle any remaining conflicts
  // The unique constraint is on (account_id, feature_key, valid_from)
  const { error } = await supabaseAdmin
    .schema("billing")
    .from("feature_entitlements")
    .upsert(entitlements, {
      onConflict: "account_id,feature_key,valid_from",
      ignoreDuplicates: false,
    });

  if (error) {
    consola.error("[polar] Failed to provision entitlements", error);
    throw error;
  }

  consola.info("[polar] Provisioned entitlements", {
    accountId,
    planId,
    count: entitlements.length,
  });
}

/**
 * Grant monthly credits for a plan
 * Called when a subscription becomes active or renews
 */
export async function grantPlanCredits(params: {
  accountId: string;
  planId: PlanId;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  seatCount?: number;
}) {
  const { accountId, planId, billingPeriodStart, billingPeriodEnd, seatCount } =
    params;
  const plan = PLANS[planId];

  if (!plan) {
    consola.warn("[polar] Unknown plan ID, skipping credits", { planId });
    return;
  }

  // Calculate credits (for team plan, multiply by seats)
  const credits = plan.perUser
    ? plan.credits.monthly * (seatCount ?? 1)
    : plan.credits.monthly;

  // Idempotency key based on account + billing period
  const idempotencyKey = `plan-grant:${accountId}:${billingPeriodStart.toISOString()}`;

  consola.info("[polar] Granting plan credits", {
    accountId,
    planId,
    credits,
    idempotencyKey,
  });

  const { data, error } = await supabaseAdmin
    .schema("billing")
    .rpc("grant_credits", {
      p_account_id: accountId,
      p_amount: credits,
      p_source: "plan",
      p_idempotency_key: idempotencyKey,
      p_expires_at: billingPeriodEnd.toISOString(),
      p_billing_period_start: billingPeriodStart.toISOString(),
      p_billing_period_end: billingPeriodEnd.toISOString(),
      p_metadata: { plan_id: planId, seat_count: seatCount ?? 1 },
    });

  if (error) {
    consola.error("[polar] Failed to grant credits", error);
    throw error;
  }

  if (data?.[0]?.is_duplicate) {
    consola.info("[polar] Credit grant was duplicate, skipping", {
      idempotencyKey,
    });
  } else {
    consola.info("[polar] Credits granted successfully", {
      accountId,
      credits,
      idempotencyKey,
    });
  }
}

/**
 * Revoke entitlements when subscription is canceled/revoked
 */
export async function revokeEntitlements(params: { accountId: string }) {
  const { accountId } = params;

  consola.info("[polar] Revoking entitlements", { accountId });

  // Disable all plan-based entitlements
  const { error } = await supabaseAdmin
    .schema("billing")
    .from("feature_entitlements")
    .update({ enabled: false, valid_until: new Date().toISOString() })
    .eq("account_id", accountId)
    .eq("source", "plan");

  if (error) {
    consola.error("[polar] Failed to revoke entitlements", error);
    throw error;
  }
}

/**
 * Default trial duration in days for legacy users
 */
const LEGACY_TRIAL_DAYS = 14;

/**
 * Provision a legacy trial for existing accounts without billing subscription.
 * Called lazily on login when we detect an account has no subscription.
 *
 * @returns The created subscription info, or null if account already has subscription
 */
export async function provisionLegacyTrial(params: {
  accountId: string;
  email?: string;
  planId?: PlanId;
}): Promise<{
  isOnTrial: boolean;
  planName: string;
  trialEnd: string;
} | null> {
  const { accountId, email, planId = "pro" } = params;
  const plan = PLANS[planId];

  // Check if account already has ANY subscription (don't create duplicate)
  const { data: existingSubscription } = await supabaseAdmin
    .schema("accounts")
    .from("billing_subscriptions")
    .select("id, status")
    .eq("account_id", accountId)
    .limit(1)
    .maybeSingle();

  if (existingSubscription) {
    consola.debug("[legacy-trial] Account already has subscription, skipping", {
      accountId,
      subscriptionId: existingSubscription.id,
    });
    return null;
  }

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + LEGACY_TRIAL_DAYS);

  const customerId = `legacy_trial_${accountId}`;
  const subscriptionId = `legacy_trial_sub_${accountId}`;

  consola.info("[legacy-trial] Provisioning legacy trial", {
    accountId,
    planId,
    trialEnd: trialEnd.toISOString(),
  });

  // Create billing customer
  const { error: customerError } = await supabaseAdmin
    .schema("accounts")
    .from("billing_customers")
    .upsert(
      {
        id: customerId,
        account_id: accountId,
        email: email ?? null,
        provider: "legacy",
        active: true,
      },
      { onConflict: "id" },
    );

  if (customerError) {
    consola.error(
      "[legacy-trial] Failed to create billing customer",
      customerError,
    );
    throw customerError;
  }

  // Create trialing subscription
  const { error: subscriptionError } = await supabaseAdmin
    .schema("accounts")
    .from("billing_subscriptions")
    .upsert(
      {
        id: subscriptionId,
        account_id: accountId,
        billing_customer_id: customerId,
        status: "trialing",
        plan_name: plan.name,
        price_id: null,
        quantity: 1,
        cancel_at_period_end: false,
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
        trial_start: now.toISOString(),
        trial_end: trialEnd.toISOString(),
        provider: "legacy",
        metadata: { legacy_trial: true, plan_id: planId },
      },
      { onConflict: "id" },
    );

  if (subscriptionError) {
    consola.error(
      "[legacy-trial] Failed to create subscription",
      subscriptionError,
    );
    throw subscriptionError;
  }

  // Provision entitlements for the trial plan
  await provisionPlanEntitlements({
    accountId,
    planId,
    validFrom: now,
    validUntil: trialEnd,
  });

  // Grant credits for trial period
  await grantPlanCredits({
    accountId,
    planId,
    billingPeriodStart: now,
    billingPeriodEnd: trialEnd,
  });

  consola.info("[legacy-trial] Legacy trial provisioned successfully", {
    accountId,
    planId,
    trialEnd: trialEnd.toISOString(),
  });

  return {
    isOnTrial: true,
    planName: plan.name,
    trialEnd: trialEnd.toISOString(),
  };
}
