/**
 * Update User Metrics - Scheduled Task
 *
 * Runs daily to calculate and update computed user properties in PostHog:
 * - lifecycle_stage (new, active, dormant, churned)
 * - is_activated (completed activation criteria)
 * - is_power_user (high engagement)
 * - days_since_last_activity
 * - trial/subscription status for PLG cohorts
 * - team_size for expansion campaigns
 *
 * These properties are used by:
 * - PostHog cohort definitions for PLG automation
 * - Brevo contact attributes for email personalization
 *
 * See: docs/60-ops-observability/plg-instrumentation-plan.md
 * See: docs/70-PLG/nurture/email-sequences.md
 */

import { schedules } from "@trigger.dev/sdk/v3";
import consola from "consola";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

interface UserMetrics {
  userId: string;
  email: string;
  accountId: string;
  accountName: string | null;
  interviewCount: number;
  surveyCount: number;
  insightCount: number;
  taskCompletedCount: number;
  opportunityCount: number;
  personCount: number;
  teamSize: number;
  hasViewedAnalysis: boolean;
  hasUsedAgent: boolean;
  daysSinceLastActivity: number;
  signupDate: Date;
  lastActivityDate: Date | null;
  // Billing/subscription
  plan: "free" | "starter" | "pro" | "team";
  hasProTrial: boolean;
  trialEnd: Date | null;
  hasPaidSubscription: boolean;
}

/**
 * Calculate user metrics from database
 */
async function calculateMetrics(userId: string): Promise<UserMetrics | null> {
  const supabase = createSupabaseAdminClient();

  // Get user info
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id, email, account_id, created_at")
    .eq("id", userId)
    .single();

  if (userError || !user) {
    consola.warn(`User not found: ${userId}`);
    return null;
  }

  // Get account info (name for Brevo personalization)
  const { data: account } = await supabase
    .from("accounts")
    .select("name")
    .eq("id", user.account_id)
    .single();

  // Count interviews
  const { count: interviewCount } = await supabase
    .from("interviews")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId);

  // Count surveys (research links)
  const { count: surveyCount } = await supabase
    .from("research_links")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId);

  // Count insights (for lc-stalled-no-insight cohort)
  const { count: insightCount } = await supabase
    .from("insights")
    .select("*", { count: "exact", head: true })
    .eq("account_id", user.account_id);

  // Count completed tasks
  const { count: taskCompletedCount } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId)
    .eq("status", "done");

  // Count opportunities
  const { count: opportunityCount } = await supabase
    .from("opportunities")
    .select("*", { count: "exact", head: true })
    .eq("account_id", user.account_id);

  // Count people/contacts
  const { count: personCount } = await supabase
    .from("people")
    .select("*", { count: "exact", head: true })
    .eq("account_id", user.account_id);

  // Count team members (for team_size and expansion cohort)
  const { count: teamSize } = await supabase
    .from("account_user")
    .select("*", { count: "exact", head: true })
    .eq("account_id", user.account_id);

  // Get subscription/billing info (for trial cohorts)
  const { data: subscription } = await supabase
    .from("billing_subscriptions")
    .select("status, plan_name, trial_start, trial_end")
    .eq("account_id", user.account_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Determine plan and trial status
  let plan: "free" | "starter" | "pro" | "team" = "free";
  let hasProTrial = false;
  let trialEnd: Date | null = null;
  let hasPaidSubscription = false;

  if (subscription) {
    // Check if currently in trial
    if (subscription.status === "trialing" && subscription.trial_end) {
      hasProTrial = true;
      trialEnd = new Date(subscription.trial_end);
    }

    // Check if has active paid subscription
    if (subscription.status === "active") {
      hasPaidSubscription = true;
    }

    // Determine plan from subscription
    const planName = subscription.plan_name?.toLowerCase() ?? "";
    if (planName.includes("team")) {
      plan = "team";
    } else if (planName.includes("pro")) {
      plan = "pro";
    } else if (planName.includes("starter")) {
      plan = "starter";
    }
  }

  // Check if user has viewed analysis (interview detail or survey results)
  // This is a proxy - we'd ideally track this via PostHog events
  const hasViewedAnalysis = (interviewCount ?? 0) > 0 || (surveyCount ?? 0) > 0;

  // Check if user has used agent chat
  // TODO: When agent_message_sent event is implemented, query PostHog for this
  const hasUsedAgent = false;

  // Calculate last activity date from PostHog events would be ideal
  // For now, use last updated interview or task as proxy
  const { data: lastInterview } = await supabase
    .from("interviews")
    .select("updated_at")
    .eq("created_by", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const { data: lastTask } = await supabase
    .from("tasks")
    .select("updated_at")
    .eq("created_by", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const lastActivityDate =
    lastInterview?.updated_at || lastTask?.updated_at
      ? new Date(
          Math.max(
            lastInterview?.updated_at
              ? new Date(lastInterview.updated_at).getTime()
              : 0,
            lastTask?.updated_at ? new Date(lastTask.updated_at).getTime() : 0,
          ),
        )
      : null;

  const daysSinceLastActivity = lastActivityDate
    ? Math.floor(
        (Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24),
      )
    : 999;

  return {
    userId: user.id,
    email: user.email,
    accountId: user.account_id,
    accountName: account?.name ?? null,
    interviewCount: interviewCount ?? 0,
    surveyCount: surveyCount ?? 0,
    insightCount: insightCount ?? 0,
    taskCompletedCount: taskCompletedCount ?? 0,
    opportunityCount: opportunityCount ?? 0,
    personCount: personCount ?? 0,
    teamSize: teamSize ?? 1,
    hasViewedAnalysis,
    hasUsedAgent,
    daysSinceLastActivity,
    signupDate: new Date(user.created_at),
    lastActivityDate,
    plan,
    hasProTrial,
    trialEnd,
    hasPaidSubscription,
  };
}

/**
 * Determine lifecycle stage based on metrics
 */
function determineLifecycleStage(
  metrics: UserMetrics,
  isActivated: boolean,
): "new" | "onboarding" | "activated" | "power_user" | "at_risk" | "churned" {
  const daysSinceSignup = Math.floor(
    (Date.now() - metrics.signupDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Churned: activated but inactive for 90+ days
  if (isActivated && metrics.daysSinceLastActivity >= 90) {
    return "churned";
  }

  // At risk: activated but inactive for 14+ days
  if (isActivated && metrics.daysSinceLastActivity >= 14) {
    return "at_risk";
  }

  // Power user: activated + high engagement
  if (isActivated && metrics.taskCompletedCount >= 5) {
    return "power_user";
  }

  // Activated
  if (isActivated) {
    return "activated";
  }

  // Onboarding: has content but not activated
  if (
    daysSinceSignup <= 14 &&
    (metrics.interviewCount > 0 || metrics.surveyCount > 0)
  ) {
    return "onboarding";
  }

  // New: signed up recently, no content
  if (daysSinceSignup <= 7) {
    return "new";
  }

  // Default to onboarding for older users who haven't activated
  return "onboarding";
}

/**
 * Main scheduled task - runs daily at 2am UTC
 */
export const updateUserMetricsTask = schedules.task({
  id: "analytics.update-user-metrics",
  cron: "0 2 * * *", // Daily at 2am UTC
  run: async () => {
    consola.info(
      "[analytics.update-user-metrics] Starting daily user metrics update",
    );

    const supabase = createSupabaseAdminClient();
    const posthog = getPostHogServerClient();

    if (!posthog) {
      consola.error(
        "[analytics.update-user-metrics] PostHog client not available",
      );
      return {
        success: false,
        error: "PostHog client not initialized",
      };
    }

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id");

    if (usersError || !users) {
      consola.error(
        "[analytics.update-user-metrics] Failed to fetch users:",
        usersError,
      );
      return {
        success: false,
        error: usersError?.message || "Failed to fetch users",
      };
    }

    consola.info(
      `[analytics.update-user-metrics] Processing ${users.length} users`,
    );

    let successCount = 0;
    let errorCount = 0;

    for (const user of users) {
      try {
        const metrics = await calculateMetrics(user.id);

        if (!metrics) {
          errorCount++;
          continue;
        }

        // Determine activation status
        const isActivated =
          (metrics.interviewCount > 0 || metrics.surveyCount > 0) &&
          metrics.hasViewedAnalysis &&
          (metrics.taskCompletedCount > 0 || metrics.opportunityCount > 0);

        // Determine if power user (activated + 3 sessions/week)
        // For now, use task completion as proxy for sessions
        const isPowerUser = isActivated && metrics.taskCompletedCount >= 5;

        // Determine if churn risk
        const isChurnRisk = isActivated && metrics.daysSinceLastActivity >= 14;

        // Calculate lifecycle stage
        const lifecycleStage = determineLifecycleStage(metrics, isActivated);

        // Calculate days since signup for cohort filtering
        const daysSinceSignup = Math.floor(
          (Date.now() - metrics.signupDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Has data ingested (interviews or surveys)
        const dataIngested = metrics.interviewCount + metrics.surveyCount;

        // Update PostHog person properties
        // These properties are used by:
        // - PostHog cohorts for PLG automation
        // - Brevo contact attributes (via native PostHog → Brevo destination)
        posthog.identify({
          distinctId: user.id,
          properties: {
            // Identity & account (for Brevo)
            email: metrics.email,
            account_id: metrics.accountId,
            company_name: metrics.accountName,

            // Content metrics
            interview_count: metrics.interviewCount,
            survey_count: metrics.surveyCount,
            insight_count: metrics.insightCount,
            task_completed_count: metrics.taskCompletedCount,
            opportunity_count: metrics.opportunityCount,
            person_count: metrics.personCount,

            // Team metrics (for expansion cohorts)
            team_size: metrics.teamSize,

            // Billing/subscription (for trial cohorts)
            plan: metrics.plan,
            has_pro_trial: metrics.hasProTrial,
            trial_end: metrics.trialEnd?.toISOString() ?? null,
            has_paid_subscription: metrics.hasPaidSubscription,

            // Activity flags
            has_viewed_analysis: metrics.hasViewedAnalysis,
            has_used_agent: metrics.hasUsedAgent,

            // Computed metrics for cohorts
            data_ingested: dataIngested,
            insight_published: metrics.insightCount > 0,
            is_activated: isActivated,
            is_power_user: isPowerUser,
            is_churn_risk: isChurnRisk,
            days_since_last_activity: metrics.daysSinceLastActivity,
            days_since_signup: daysSinceSignup,
            lifecycle_stage: lifecycleStage,

            // Metadata
            last_metrics_update: new Date().toISOString(),
          },
        });

        successCount++;
      } catch (error) {
        consola.error(
          `[analytics.update-user-metrics] Error processing user ${user.id}:`,
          error,
        );
        errorCount++;
      }
    }

    // Flush PostHog events
    await posthog.shutdown();

    consola.success(
      `[analytics.update-user-metrics] Completed: ${successCount} success, ${errorCount} errors`,
    );

    return {
      success: true,
      totalUsers: users.length,
      successCount,
      errorCount,
    };
  },
});
