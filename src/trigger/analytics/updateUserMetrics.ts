/**
 * Update User Metrics - Scheduled Task
 *
 * Runs daily to calculate and update computed user properties in PostHog:
 * - lifecycle_stage (new, active, dormant, churned)
 * - is_activated (completed activation criteria)
 * - is_power_user (high engagement)
 * - days_since_last_activity
 *
 * See: docs/60-ops-observability/plg-instrumentation-plan.md
 */

import { schedules } from "@trigger.dev/sdk/v3";
import consola from "consola";
import { getPostHogServerClient } from "~/lib/posthog.server";
import { createSupabaseAdminClient } from "~/lib/supabase/client.server";

interface UserMetrics {
  userId: string;
  email: string;
  accountId: string;
  interviewCount: number;
  surveyCount: number;
  taskCompletedCount: number;
  opportunityCount: number;
  personCount: number;
  hasViewedAnalysis: boolean;
  hasUsedAgent: boolean;
  daysSinceLastActivity: number;
  signupDate: Date;
  lastActivityDate: Date | null;
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
    interviewCount: interviewCount ?? 0,
    surveyCount: surveyCount ?? 0,
    taskCompletedCount: taskCompletedCount ?? 0,
    opportunityCount: opportunityCount ?? 0,
    personCount: personCount ?? 0,
    hasViewedAnalysis,
    hasUsedAgent,
    daysSinceLastActivity,
    signupDate: new Date(user.created_at),
    lastActivityDate,
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

        // Update PostHog person properties
        posthog.identify({
          distinctId: user.id,
          properties: {
            email: metrics.email,
            interview_count: metrics.interviewCount,
            survey_count: metrics.surveyCount,
            task_completed_count: metrics.taskCompletedCount,
            opportunity_count: metrics.opportunityCount,
            person_count: metrics.personCount,
            has_viewed_analysis: metrics.hasViewedAnalysis,
            has_used_agent: metrics.hasUsedAgent,
            is_activated: isActivated,
            is_power_user: isPowerUser,
            is_churn_risk: isChurnRisk,
            days_since_last_activity: metrics.daysSinceLastActivity,
            lifecycle_stage: lifecycleStage,
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
