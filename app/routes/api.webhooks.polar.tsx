/**
 * Polar.sh Webhook Handler
 *
 * Receives subscription events from Polar.sh and syncs billing state.
 *
 * Webhook events handled:
 * - subscription.created/active/updated: Sync subscription, provision entitlements
 * - subscription.canceled/revoked: Revoke entitlements
 * - customer.created/updated: Sync customer data
 *
 * Setup:
 * 1. Add POLAR_WEBHOOK_SECRET to environment
 * 2. Configure webhook URL in Polar dashboard: https://your-domain.com/api/webhooks/polar
 * 3. Update POLAR_PRODUCT_MAP in ~/lib/billing/polar.server.ts with your product IDs
 *
 * @see https://polar.sh/docs/integrate/sdk/adapters/hono
 */

import { Webhooks } from "@polar-sh/hono";
import type { WebhookCustomerCreatedPayload } from "@polar-sh/sdk/models/components/webhookcustomercreatedpayload";
import type { WebhookCustomerUpdatedPayload } from "@polar-sh/sdk/models/components/webhookcustomerupdatedpayload";
import type { WebhookSubscriptionActivePayload } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload";
import type { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload";
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload";
import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { getServerEnv } from "~/env.server";
import {
  grantPlanCredits,
  provisionPlanEntitlements,
  revokeEntitlements,
  upsertBillingCustomer,
  upsertBillingSubscription,
} from "~/lib/billing/polar.server";

/**
 * Extract account_id from metadata.
 * You must pass account_id when creating checkout sessions.
 */
function extractAccountId(
  metadata?: Record<string, unknown> | null,
): string | undefined {
  if (!metadata) return undefined;
  const accountId = metadata.account_id;
  if (typeof accountId === "string") return accountId;
  return undefined;
}

/**
 * Handle subscription becoming active (new or renewed)
 */
async function handleSubscriptionActive(
  payload: WebhookSubscriptionActivePayload,
) {
  // payload.data IS the Subscription object directly
  const subscription = payload.data;
  const customer = subscription.customer;

  const accountId = extractAccountId(subscription.metadata);
  if (!accountId) {
    consola.error(
      "[polar webhook] Missing account_id in subscription metadata",
      { subscriptionId: subscription.id },
    );
    return;
  }

  consola.info("[polar webhook] Subscription active", {
    subscriptionId: subscription.id,
    accountId,
    productId: subscription.product.id,
  });

  // Upsert customer
  await upsertBillingCustomer({
    polarCustomerId: customer.id,
    accountId,
    email: customer.email,
  });

  // Upsert subscription
  const { planId } = await upsertBillingSubscription({
    polarSubscriptionId: subscription.id,
    polarCustomerId: customer.id,
    accountId,
    status: subscription.status,
    productId: subscription.product.id,
    quantity: subscription.seats ?? 1,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt?.toISOString(),
    endedAt: subscription.endedAt?.toISOString(),
    metadata: subscription.metadata as Record<string, unknown>,
  });

  // Provision entitlements
  await provisionPlanEntitlements({
    accountId,
    planId,
    validFrom: subscription.currentPeriodStart,
    validUntil: subscription.currentPeriodEnd ?? undefined,
  });

  // Grant credits for billing period
  await grantPlanCredits({
    accountId,
    planId,
    billingPeriodStart: subscription.currentPeriodStart,
    billingPeriodEnd:
      subscription.currentPeriodEnd ?? subscription.currentPeriodStart,
  });
}

/**
 * Handle subscription created (may not be active yet)
 */
async function handleSubscriptionCreated(
  payload: WebhookSubscriptionCreatedPayload,
) {
  const subscription = payload.data;
  const customer = subscription.customer;

  const accountId = extractAccountId(subscription.metadata);
  if (!accountId) {
    consola.warn("[polar webhook] Missing account_id in subscription.created", {
      subscriptionId: subscription.id,
    });
    return;
  }

  consola.info("[polar webhook] Subscription created", {
    subscriptionId: subscription.id,
    accountId,
    status: subscription.status,
  });

  // Just upsert customer and subscription records
  // Entitlements will be provisioned on subscription.active
  await upsertBillingCustomer({
    polarCustomerId: customer.id,
    accountId,
    email: customer.email,
  });

  await upsertBillingSubscription({
    polarSubscriptionId: subscription.id,
    polarCustomerId: customer.id,
    accountId,
    status: subscription.status,
    productId: subscription.product.id,
    quantity: subscription.seats ?? 1,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    metadata: subscription.metadata as Record<string, unknown>,
  });
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(
  payload: WebhookSubscriptionUpdatedPayload,
) {
  const subscription = payload.data;
  const customer = subscription.customer;

  const accountId = extractAccountId(subscription.metadata);
  if (!accountId) {
    consola.warn("[polar webhook] Missing account_id in subscription.updated", {
      subscriptionId: subscription.id,
    });
    return;
  }

  consola.info("[polar webhook] Subscription updated", {
    subscriptionId: subscription.id,
    accountId,
    status: subscription.status,
  });

  // Ensure customer exists first
  await upsertBillingCustomer({
    polarCustomerId: customer.id,
    accountId,
    email: customer.email,
  });

  await upsertBillingSubscription({
    polarSubscriptionId: subscription.id,
    polarCustomerId: customer.id,
    accountId,
    status: subscription.status,
    productId: subscription.product.id,
    quantity: subscription.seats ?? 1,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt: subscription.canceledAt?.toISOString(),
    endedAt: subscription.endedAt?.toISOString(),
    metadata: subscription.metadata as Record<string, unknown>,
  });
}

/**
 * Handle subscription canceled (will end at period end)
 */
async function handleSubscriptionCanceled(
  payload: WebhookSubscriptionCanceledPayload,
) {
  const subscription = payload.data;
  const customer = subscription.customer;

  const accountId = extractAccountId(subscription.metadata);
  if (!accountId) {
    consola.warn(
      "[polar webhook] Missing account_id in subscription.canceled",
      { subscriptionId: subscription.id },
    );
    return;
  }

  consola.info("[polar webhook] Subscription canceled", {
    subscriptionId: subscription.id,
    accountId,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
  });

  // Ensure customer exists first (may not if this is first event received)
  await upsertBillingCustomer({
    polarCustomerId: customer.id,
    accountId,
    email: customer.email,
  });

  // Update subscription record - entitlements remain until period end
  await upsertBillingSubscription({
    polarSubscriptionId: subscription.id,
    polarCustomerId: customer.id,
    accountId,
    status: "canceled",
    productId: subscription.product.id,
    quantity: subscription.seats ?? 1,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    canceledAt:
      subscription.canceledAt?.toISOString() ?? new Date().toISOString(),
    metadata: subscription.metadata as Record<string, unknown>,
  });

  // If immediate cancellation (not at period end), revoke entitlements now
  if (!subscription.cancelAtPeriodEnd) {
    await revokeEntitlements({ accountId });
  }
}

/**
 * Handle subscription revoked (immediate termination)
 */
async function handleSubscriptionRevoked(
  payload: WebhookSubscriptionRevokedPayload,
) {
  const subscription = payload.data;
  const customer = subscription.customer;

  const accountId = extractAccountId(subscription.metadata);
  if (!accountId) {
    consola.warn("[polar webhook] Missing account_id in subscription.revoked", {
      subscriptionId: subscription.id,
    });
    return;
  }

  consola.info("[polar webhook] Subscription revoked", {
    subscriptionId: subscription.id,
    accountId,
  });

  // Ensure customer exists first
  await upsertBillingCustomer({
    polarCustomerId: customer.id,
    accountId,
    email: customer.email,
  });

  await upsertBillingSubscription({
    polarSubscriptionId: subscription.id,
    polarCustomerId: customer.id,
    accountId,
    status: "canceled",
    productId: subscription.product.id,
    quantity: subscription.seats ?? 1,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
    cancelAtPeriodEnd: false,
    canceledAt:
      subscription.canceledAt?.toISOString() ?? new Date().toISOString(),
    endedAt: new Date().toISOString(),
    metadata: subscription.metadata as Record<string, unknown>,
  });

  // Immediately revoke entitlements
  await revokeEntitlements({ accountId });
}

/**
 * Handle customer created
 */
async function handleCustomerCreated(payload: WebhookCustomerCreatedPayload) {
  const customer = payload.data;

  const accountId = extractAccountId(customer.metadata);
  if (!accountId) {
    consola.debug("[polar webhook] Customer created without account_id", {
      customerId: customer.id,
    });
    return;
  }

  consola.info("[polar webhook] Customer created", {
    customerId: customer.id,
    accountId,
  });

  await upsertBillingCustomer({
    polarCustomerId: customer.id,
    accountId,
    email: customer.email,
  });
}

/**
 * Handle customer updated
 */
async function handleCustomerUpdated(payload: WebhookCustomerUpdatedPayload) {
  const customer = payload.data;

  const accountId = extractAccountId(customer.metadata);
  if (!accountId) {
    consola.debug("[polar webhook] Customer updated without account_id", {
      customerId: customer.id,
    });
    return;
  }

  consola.info("[polar webhook] Customer updated", {
    customerId: customer.id,
    accountId,
  });

  await upsertBillingCustomer({
    polarCustomerId: customer.id,
    accountId,
    email: customer.email,
  });
}

/**
 * Webhook action handler for React Router
 */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const env = getServerEnv();
  const webhookSecret = env.POLAR_WEBHOOK_SECRET;

  if (!webhookSecret) {
    consola.error("[polar webhook] POLAR_WEBHOOK_SECRET not configured");
    return new Response("Webhook not configured", { status: 500 });
  }

  // Create the Webhooks handler
  const webhooks = Webhooks({
    webhookSecret,
    onSubscriptionCreated: handleSubscriptionCreated,
    onSubscriptionActive: handleSubscriptionActive,
    onSubscriptionUpdated: handleSubscriptionUpdated,
    onSubscriptionCanceled: handleSubscriptionCanceled,
    onSubscriptionRevoked: handleSubscriptionRevoked,
    onCustomerCreated: handleCustomerCreated,
    onCustomerUpdated: handleCustomerUpdated,
    onPayload: async (payload) => {
      // Catch-all for unhandled events
      consola.debug("[polar webhook] Unhandled event", {
        type: payload.type,
      });
    },
  });

  try {
    // The Webhooks helper returns a Hono handler, but we need to adapt it
    // for React Router. We'll manually verify and process the webhook.
    const body = await request.text();
    const webhookId = request.headers.get("webhook-id");
    const webhookTimestamp = request.headers.get("webhook-timestamp");
    const webhookSignature = request.headers.get("webhook-signature");

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      consola.warn("[polar webhook] Missing webhook headers");
      return new Response("Missing webhook headers", { status: 400 });
    }

    // Create a mock Hono context to use with the Webhooks handler
    // This is a workaround since we're using React Router, not Hono directly
    const mockRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body,
    });

    // Call the webhooks handler directly
    // Note: The @polar-sh/hono package expects a Hono context, so we simulate one
    const mockContext = {
      req: {
        raw: mockRequest,
        header: (name: string) => mockRequest.headers.get(name),
        text: async () => body,
        json: async () => JSON.parse(body),
      },
      json: (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      text: (data: string, status = 200) => new Response(data, { status }),
    };

    // Process the webhook using the handler
    const result = await webhooks(mockContext as never);

    if (result instanceof Response) {
      return result;
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    consola.error("[polar webhook] Error processing webhook", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}
