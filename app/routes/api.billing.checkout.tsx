/**
 * Polar Checkout Redirect Endpoint
 *
 * Creates a Polar checkout session and redirects the user.
 *
 * Usage:
 * - GET /api/billing/checkout?plan=starter
 * - GET /api/billing/checkout?plan=pro
 * - GET /api/billing/checkout?plan=team
 *
 * Query params:
 * - plan (required): Plan ID to purchase (starter, pro, team)
 * - interval (optional): "month" or "year" (default: month)
 *
 * The account_id is automatically extracted from the authenticated user's session.
 */

import { Polar } from "@polar-sh/sdk";
import consola from "consola";
import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import type { PlanId } from "~/config/plans";
import { PLANS } from "~/config/plans";
import { getServerEnv } from "~/env.server";
import {
  getAuthenticatedUser,
  supabaseAdmin,
} from "~/lib/supabase/client.server";

/**
 * Get Polar product ID for a plan and interval.
 */
function getPolarProductId(
  env: ReturnType<typeof getServerEnv>,
  plan: PlanId,
  interval: string,
): string | undefined {
  const products: Record<PlanId, { monthly?: string; annual?: string }> = {
    free: {},
    starter: {
      monthly: env.POLAR_PRODUCT_STARTER_MONTHLY,
      annual: env.POLAR_PRODUCT_STARTER_ANNUAL,
    },
    pro: {
      monthly: env.POLAR_PRODUCT_PRO_MONTHLY,
      annual: env.POLAR_PRODUCT_PRO_ANNUAL,
    },
    team: {
      monthly: env.POLAR_PRODUCT_TEAM_MONTHLY,
      annual: env.POLAR_PRODUCT_TEAM_ANNUAL,
    },
  };

  const config = products[plan];
  return interval === "year" ? config?.annual : config?.monthly;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const env = getServerEnv();
  const { user } = await getAuthenticatedUser(request);

  // Require authentication - preserve full checkout URL for redirect after login
  if (!user) {
    consola.warn("[checkout] Unauthenticated checkout attempt");
    const returnUrl =
      new URL(request.url).pathname + new URL(request.url).search;
    return redirect(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  }

  // Get account_id from user's membership (use admin client to bypass RLS)
  // Query accounts.account_user table - users have a personal account by default
  const { data: membership, error: membershipError } = await supabaseAdmin
    .schema("accounts")
    .from("account_user")
    .select("account_id")
    .eq("user_id", user.sub)
    .limit(1)
    .single();

  if (membershipError) {
    consola.warn("[checkout] Error fetching account membership", {
      userId: user.sub,
      error: membershipError.message,
    });
  }

  const accountId = membership?.account_id;
  if (!accountId) {
    consola.warn("[checkout] No account_id for user", { userId: user.sub });
    // User may have just signed up - redirect to onboarding first
    return redirect("/home?error=no_account");
  }

  const url = new URL(request.url);
  const plan = url.searchParams.get("plan") as PlanId | null;
  const interval = url.searchParams.get("interval") || "month";

  // Validate plan
  if (!plan || !PLANS[plan]) {
    consola.warn("[checkout] Invalid plan", { plan });
    return redirect("/pricing?error=invalid_plan");
  }

  // Free plan doesn't need checkout
  if (plan === "free") {
    return redirect("/pricing?error=free_plan");
  }

  // Get product ID for this plan
  const productId = getPolarProductId(env, plan, interval);

  if (!productId) {
    consola.error("[checkout] Missing Polar product ID", { plan, interval });
    return redirect("/pricing?error=product_not_configured");
  }

  // Check for access token
  const accessToken = env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    consola.error("[checkout] POLAR_ACCESS_TOKEN not configured");
    return redirect("/pricing?error=billing_not_configured");
  }

  // Build metadata to pass to Polar
  const metadata = {
    account_id: accountId,
    user_id: user.sub,
    plan_id: plan,
  };

  // Determine server environment
  const server =
    env.APP_ENV === "production" ? "production" : ("sandbox" as const);

  // Build success URL
  const origin = url.origin;
  const successUrl = `${origin}/settings/billing?checkout=success&plan=${plan}`;

  consola.info("[checkout] Creating Polar checkout session", {
    plan,
    interval,
    productId,
    accountId,
    server,
  });

  // Initialize Polar SDK with appropriate server
  const polar = new Polar({
    accessToken,
    server: server === "sandbox" ? "sandbox" : "production",
  });

  try {
    // Create checkout session via Polar API
    // Note: SDK uses `products` array, not `productId`
    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl: `${successUrl}&checkout_id={CHECKOUT_ID}`,
      customerEmail: user.email || undefined,
      metadata,
    });

    consola.info("[checkout] Checkout session created", {
      checkoutId: checkout.id,
      url: checkout.url,
    });

    return redirect(checkout.url);
  } catch (error) {
    consola.error("[checkout] Failed to create checkout session", { error });
    return redirect("/pricing?error=checkout_failed");
  }
}
