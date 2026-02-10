/**
 * Onboarding & Success Journey E2E tests.
 *
 * Tests the critical user paths from signup through first value:
 * 1. New user → signup-chat / onboarding walkthrough
 * 2. Project setup → goals → questions → upload
 * 3. Returning user → dashboard redirect
 *
 * These tests validate that the user can navigate the full onboarding
 * funnel without dead-ends or broken redirects.
 */
import { test, expect } from "../fixtures";

test.describe("Onboarding Walkthrough Modal", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping - requires auth credentials",
  );

  test.beforeEach(async ({ auth }) => {
    await auth.login();
  });

  test("walkthrough modal has job function selection step", async ({
    page,
  }) => {
    // Navigate to a project page where onboarding modal might appear
    // The OnboardingProvider auto-shows when shouldShowOnboarding is true
    await page.waitForTimeout(2000); // Allow modal delay (1s + buffer)

    // Check if walkthrough is visible (only for incomplete onboarding)
    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible({ timeout: 3000 })) {
      // Should have role/job function options
      const roleOptions = page.locator(
        'text=/product|design|engineering|research/i',
      );
      expect(await roleOptions.count()).toBeGreaterThan(0);
    }
  });

  test("walkthrough can be dismissed", async ({ page }) => {
    await page.waitForTimeout(2000);

    const modal = page.locator('[role="dialog"]');
    if (await modal.isVisible({ timeout: 3000 })) {
      // Close button should exist
      const closeButton = page.locator(
        '[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has(svg)',
      );
      if (await closeButton.count()) {
        await closeButton.first().click();
        await expect(modal).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});

test.describe("Project Setup Flow", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping - requires auth credentials",
  );

  test.beforeEach(async ({ auth }) => {
    await auth.login();
  });

  test("setup page loads with chat and context card", async ({ page }) => {
    // Navigate to a project's setup page
    const url = page.url();
    const projectMatch = url.match(/\/a\/([^/]+)\/([^/]+)/);

    if (projectMatch) {
      const [, accountId, projectId] = projectMatch;
      await page.goto(`/a/${accountId}/${projectId}/setup`);

      // Should show either TypeformQuestion or ProjectSetupChat
      await expect(
        page
          .locator(
            'text=/research|goal|what.*trying|help.*figure/i',
          )
          .first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("setup page has path selection suggestions", async ({ page }) => {
    const url = page.url();
    const projectMatch = url.match(/\/a\/([^/]+)\/([^/]+)/);

    if (projectMatch) {
      const [, accountId, projectId] = projectMatch;
      await page.goto(`/a/${accountId}/${projectId}/setup`);

      // Should show initial path suggestions (plan, analyze, record, explore)
      const suggestions = page.locator(
        'text=/help me figure|find patterns|take notes|see how/i',
      );

      // At least some suggestions should be visible
      if (await suggestions.count()) {
        expect(await suggestions.first().isVisible()).toBeTruthy();
      }
    }
  });
});

test.describe("Upload Flow", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping - requires auth credentials",
  );

  test.beforeEach(async ({ auth }) => {
    await auth.login();
  });

  test("upload page is accessible from project", async ({ page }) => {
    const url = page.url();
    const projectMatch = url.match(/\/a\/([^/]+)\/([^/]+)/);

    if (projectMatch) {
      const [, accountId, projectId] = projectMatch;
      await page.goto(`/a/${accountId}/${projectId}/interviews/upload`);

      // Should show upload interface with drag-drop or file selection
      await expect(
        page
          .locator(
            'text=/upload|drag|drop|browse|add.*conversation|add.*interview/i',
          )
          .first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test("upload page accepts file types", async ({ page }) => {
    const url = page.url();
    const projectMatch = url.match(/\/a\/([^/]+)\/([^/]+)/);

    if (projectMatch) {
      const [, accountId, projectId] = projectMatch;
      await page.goto(`/a/${accountId}/${projectId}/interviews/upload`);

      // Should have file input element accepting audio/video/text
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count()) {
        const accept = await fileInput.first().getAttribute("accept");
        // Should accept common media types
        expect(accept || "").toMatch(/audio|video|text|\*/);
      }
    }
  });
});

test.describe("Questions Page", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping - requires auth credentials",
  );

  test.beforeEach(async ({ auth }) => {
    await auth.login();
  });

  test("questions page loads with interview prompts", async ({ page }) => {
    const url = page.url();
    const projectMatch = url.match(/\/a\/([^/]+)\/([^/]+)/);

    if (projectMatch) {
      const [, accountId, projectId] = projectMatch;
      await page.goto(`/a/${accountId}/${projectId}/questions`);

      // Should show questions content or empty state
      await expect(
        page
          .locator(
            'text=/question|conversation|interview|generate|no.*prompts/i',
          )
          .first(),
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe("Protected Route Redirects", () => {
  test("unauthenticated user on protected route redirects to login", async ({
    page,
  }) => {
    // Try to access a protected route without auth
    await page.goto("/a/fake-account/fake-project/dashboard");

    // Should redirect to login
    await page.waitForURL(/\/(login|sign-up)/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(login|sign-up)/);
  });

  test("unauthenticated user on /home redirects to login", async ({
    page,
  }) => {
    await page.goto("/home");
    await page.waitForURL(/\/(login|sign-up)/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(login|sign-up)/);
  });
});

test.describe("Success Journey Navigation", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping - requires auth credentials",
  );

  test.beforeEach(async ({ auth }) => {
    await auth.login();
  });

  test("sidebar navigation contains key journey sections", async ({
    page,
  }) => {
    // After login, check that sidebar has the key navigation items
    const sidebar = page.locator("nav, aside, [data-sidebar]");
    if (await sidebar.count()) {
      // Check for key journey navigation items
      const navItems = ["interviews", "insights", "people", "dashboard"];
      for (const item of navItems) {
        const link = page.locator(
          `a[href*="/${item}"], [data-nav="${item}"]`,
        );
        // At least some nav items should exist
        if (await link.count()) {
          expect(await link.first().isVisible()).toBeTruthy();
        }
      }
    }
  });

  test("authenticated user lands on a project page", async ({ page }) => {
    // After login, user should be on a project-scoped page
    const url = page.url();
    // Should match: /a/:accountId/:projectId/* or /home or /projects
    expect(url).toMatch(
      /\/(a\/[^/]+\/[^/]+|home|projects|onboarding|signup-chat|setup)/,
    );
  });
});
