/**
 * API route to save user onboarding data
 *
 * Stores job function, use case, company size in user_settings.
 * Also updates the account's size_category for CRM alignment.
 * This data is used to personalize AI recommendations.
 */

import consola from "consola";
import type { ActionFunctionArgs } from "react-router";
import { userContext } from "~/server/user-context";
import type { Database } from "~/types";

export interface OnboardingData {
  jobFunction: string;
  primaryUseCase: string;
  companySize: string;
  completed: boolean;
}

export async function action({ context, request }: ActionFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;
  const userId = ctx.claims?.sub;
  const accountId = ctx.account_id;

  if (!supabase || !userId) {
    consola.error(
      "[onboarding] Unauthorized — supabase:",
      !!supabase,
      "userId:",
      userId,
    );
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const onboardingDataStr = formData.get("onboardingData") as string;

  if (!onboardingDataStr) {
    return Response.json({ error: "onboardingData required" }, { status: 400 });
  }

  let onboardingData: OnboardingData;
  try {
    onboardingData = JSON.parse(onboardingDataStr) as OnboardingData;
  } catch {
    return Response.json(
      { error: "Invalid onboardingData JSON" },
      { status: 400 },
    );
  }

  // Get current settings
  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_steps, role, metadata")
    .eq("user_id", userId)
    .single();

  const steps = (settings?.onboarding_steps as Record<string, unknown>) || {};
  const metadata = (settings?.metadata as Record<string, unknown>) || {};

  // Update onboarding steps with the new data
  const nextSteps = {
    ...steps,
    walkthrough: {
      completed: onboardingData.completed,
      completed_at: new Date().toISOString(),
      job_function: onboardingData.jobFunction,
      primary_use_case: onboardingData.primaryUseCase,
      company_size: onboardingData.companySize,
    },
  };

  // Also store in metadata for easy AI context access
  const nextMetadata = {
    ...metadata,
    onboarding: {
      job_function: onboardingData.jobFunction,
      primary_use_case: onboardingData.primaryUseCase,
      company_size: onboardingData.companySize,
    },
  };

  // Upsert user_settings — ensures onboarding_completed is set even if row didn't exist yet
  const { error: updateError } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      role: onboardingData.jobFunction || settings?.role || null,
      onboarding_completed: onboardingData.completed,
      onboarding_steps:
        nextSteps as Database["public"]["Tables"]["user_settings"]["Update"]["onboarding_steps"],
      metadata:
        nextMetadata as Database["public"]["Tables"]["user_settings"]["Update"]["metadata"],
    },
    { onConflict: "user_id" },
  );

  if (updateError) {
    consola.error("[onboarding] Upsert failed:", updateError.message);
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  consola.info(
    "[onboarding] Saved onboarding data for user:",
    userId,
    "completed:",
    onboardingData.completed,
  );

  // Also update account's target company size if we have an account
  if (accountId && onboardingData.companySize) {
    // Update the account's public_metadata with company size category
    const { data: account } = await supabase
      .from("accounts")
      .select("public_metadata")
      .eq("id", accountId)
      .single();

    const publicMetadata =
      (account?.public_metadata as Record<string, unknown>) || {};

    await supabase
      .from("accounts")
      .update({
        public_metadata: {
          ...publicMetadata,
          company_size_category: onboardingData.companySize,
        },
      })
      .eq("id", accountId);
  }

  return Response.json({ success: true });
}

/**
 * Loader to get current onboarding data
 */
export async function loader({ context }: { context: Map<symbol, unknown> }) {
  const ctx = context.get(userContext) as {
    supabase: ReturnType<
      typeof import("~/lib/supabase/client.server").createSupabaseServerClient
    >;
    claims?: { sub?: string };
  };
  const supabase = ctx.supabase;
  const userId = ctx.claims?.sub;

  if (!supabase || !userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("onboarding_steps, metadata")
    .eq("user_id", userId)
    .single();

  interface WalkthroughData {
    completed?: boolean;
    job_function?: string;
    primary_use_case?: string;
    company_size?: string;
  }

  const steps =
    (settings?.onboarding_steps as { walkthrough?: WalkthroughData }) || {};
  const walkthrough = steps.walkthrough;

  if (!walkthrough) {
    return Response.json({ completed: false });
  }

  return Response.json({
    completed: walkthrough.completed || false,
    jobFunction: walkthrough.job_function || "",
    primaryUseCase: walkthrough.primary_use_case || "",
    companySize: walkthrough.company_size || "",
  });
}
