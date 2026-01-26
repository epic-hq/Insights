/**
 * Sync PostHog Cohorts to Brevo Lists
 *
 * Scheduled task that syncs user cohorts from PostHog to Brevo contact lists
 * for automated email campaigns.
 */

import { schedules } from "@trigger.dev/sdk/v3";
import consola from "consola";
import wretch from "wretch";

const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY!;
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID!;

// PostHog Cohort ID → Brevo List ID mapping
// Get cohort IDs from PostHog dashboard URLs (e.g., /cohorts/abc123)
// Get list IDs from Brevo dashboard URLs (e.g., /contacts/lists/2)
const COHORT_MAPPINGS: Record<string, number> = {
  // Update these after creating cohorts in PostHog and lists in Brevo
  // Example:
  // "abc123": 2,  // activation-eligible → List ID 2
  // "def456": 3,  // trial-active → List ID 3
  // "ghi789": 4,  // trial-expiring → List ID 4
};

interface PostHogPerson {
  id: string;
  properties: {
    email: string;
    [key: string]: any;
  };
}

interface BrevoContact {
  email: string;
  attributes: Record<string, any>;
  listIds?: number[];
  updateEnabled?: boolean;
}

/**
 * Fetch members of a PostHog cohort
 */
async function getPostHogCohortMembers(
  cohortId: string,
): Promise<PostHogPerson[]> {
  const url = `https://app.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/cohorts/${cohortId}/persons`;

  consola.info(`Fetching cohort members from PostHog: ${cohortId}`);

  const response = await wretch(url)
    .auth(`Bearer ${POSTHOG_API_KEY}`)
    .get()
    .json<{ results: PostHogPerson[] }>();

  const membersWithEmail = response.results.filter(
    (person) => person.properties.email,
  );

  consola.info(
    `Found ${membersWithEmail.length} members with email in cohort ${cohortId}`,
  );

  return membersWithEmail;
}

/**
 * Add or update contact in Brevo
 */
async function syncContactToBrevo(
  contact: BrevoContact,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Try to create contact
    await wretch("https://api.brevo.com/v3/contacts")
      .headers({ "api-key": BREVO_API_KEY })
      .post({
        email: contact.email,
        attributes: contact.attributes,
        listIds: contact.listIds || [],
        updateEnabled: true, // Update if exists
      })
      .res();

    return { success: true };
  } catch (error: any) {
    // Handle duplicate contact error (contact already exists)
    if (error?.json?.code === "duplicate_parameter" || error?.status === 400) {
      // Contact exists, try update instead
      try {
        await wretch(`https://api.brevo.com/v3/contacts/${contact.email}`)
          .headers({ "api-key": BREVO_API_KEY })
          .put({
            attributes: contact.attributes,
            listIds: contact.listIds || [],
          })
          .res();

        return { success: true };
      } catch (updateError: any) {
        return {
          success: false,
          error: updateError?.message || "Update failed",
        };
      }
    }

    return { success: false, error: error?.message || "Unknown error" };
  }
}

/**
 * Sync a single cohort to Brevo list
 */
async function syncCohortToList(
  cohortId: string,
  listId: number,
): Promise<{ synced: number; failed: number }> {
  consola.info(`Syncing cohort ${cohortId} to Brevo list ${listId}...`);

  const members = await getPostHogCohortMembers(cohortId);

  let synced = 0;
  let failed = 0;

  for (const person of members) {
    const contact: BrevoContact = {
      email: person.properties.email,
      attributes: {
        USER_ID: person.id,
        ACCOUNT_ID: person.properties.account_id || "",
        PLAN: person.properties.plan || "free",
        TRIAL_END: person.properties.trial_end || null,
        COMPANY_NAME: person.properties.company_name || "",
        LIFECYCLE_STAGE: person.properties.lifecycle_stage || "new",
        INTERVIEW_COUNT: person.properties.interview_count || 0,
        TASK_COMPLETED_COUNT: person.properties.task_completed_count || 0,
        FIRSTNAME: person.properties.first_name || "",
        LASTNAME: person.properties.last_name || "",
      },
      listIds: [listId],
    };

    const result = await syncContactToBrevo(contact);

    if (result.success) {
      synced++;
    } else {
      failed++;
      consola.warn(`Failed to sync ${contact.email}: ${result.error}`);
    }

    // Rate limit: Brevo free tier allows 300 emails/day
    // Be conservative with API calls - wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  consola.success(`Cohort sync complete: ${synced} synced, ${failed} failed`);

  return { synced, failed };
}

/**
 * Main sync task - runs every 6 hours
 */
export const syncPostHogBrevoTask = schedules.task({
  id: "analytics.sync-posthog-brevo",
  cron: "0 */6 * * *", // Every 6 hours at :00
  run: async () => {
    consola.info("[sync-posthog-brevo] Starting cohort sync to Brevo");

    if (Object.keys(COHORT_MAPPINGS).length === 0) {
      consola.warn(
        "[sync-posthog-brevo] No cohort mappings configured. Update COHORT_MAPPINGS in syncPostHogBrevo.ts",
      );
      return {
        success: false,
        error: "No cohort mappings configured",
      };
    }

    const results: Array<{
      cohortId: string;
      listId: number;
      synced: number;
      failed: number;
    }> = [];

    for (const [cohortId, listId] of Object.entries(COHORT_MAPPINGS)) {
      try {
        const result = await syncCohortToList(cohortId, listId);
        results.push({ cohortId, listId, ...result });
      } catch (error) {
        consola.error(
          `[sync-posthog-brevo] Error syncing cohort ${cohortId}:`,
          error,
        );
        results.push({
          cohortId,
          listId,
          synced: 0,
          failed: -1,
        });
      }
    }

    const totalSynced = results.reduce((sum, r) => sum + r.synced, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    consola.success(
      `[sync-posthog-brevo] Sync complete: ${totalSynced} synced, ${totalFailed} failed`,
    );

    return {
      success: true,
      totalSynced,
      totalFailed,
      results,
    };
  },
});
