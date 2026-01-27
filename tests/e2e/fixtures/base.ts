/**
 * Base test fixtures for E2E tests.
 *
 * Extends Playwright's base test with custom fixtures for:
 * - PostHog event tracking validation
 * - Authenticated user sessions
 * - Common page objects
 */
import { test as base, type Page } from "playwright/test";

/** PostHog event captured during test execution */
export interface CapturedPostHogEvent {
  event: string;
  properties: Record<string, unknown>;
  timestamp: number;
}

/** Fixture for capturing PostHog events */
export interface PostHogFixture {
  events: CapturedPostHogEvent[];
  waitForEvent: (
    eventName: string,
    timeout?: number,
  ) => Promise<CapturedPostHogEvent>;
  getEvents: (eventName?: string) => CapturedPostHogEvent[];
  clearEvents: () => void;
}

/**
 * Creates a PostHog capture fixture for a page.
 * Intercepts PostHog API calls to capture events for validation.
 */
async function setupPostHogCapture(page: Page): Promise<PostHogFixture> {
  const events: CapturedPostHogEvent[] = [];

  // Intercept PostHog batch API calls
  await page.route("**/e/**", async (route, request) => {
    const url = request.url();

    // Handle PostHog batch endpoint
    if (url.includes("/e/") || url.includes("/batch/")) {
      try {
        const postData = request.postData();
        if (postData) {
          const data = JSON.parse(postData);
          const batch = Array.isArray(data) ? data : [data];

          for (const item of batch) {
            if (item.event) {
              events.push({
                event: item.event,
                properties: item.properties || {},
                timestamp: Date.now(),
              });
            }
          }
        }
      } catch {
        // Ignore parse errors for non-JSON payloads
      }
    }

    // Continue with the request
    await route.continue();
  });

  return {
    events,
    async waitForEvent(eventName: string, timeout = 5000) {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const found = events.find((e) => e.event === eventName);
        if (found) return found;
        await page.waitForTimeout(100);
      }
      throw new Error(
        `Timeout waiting for PostHog event: ${eventName}. Captured events: ${events.map((e) => e.event).join(", ")}`,
      );
    },
    getEvents(eventName?: string) {
      if (eventName) {
        return events.filter((e) => e.event === eventName);
      }
      return [...events];
    },
    clearEvents() {
      events.length = 0;
    },
  };
}

/** Extended test with PostHog tracking fixture */
export const test = base.extend<{ posthog: PostHogFixture }>({
  posthog: async ({ page }, use) => {
    const fixture = await setupPostHogCapture(page);
    await use(fixture);
  },
});

export { expect } from "playwright/test";
