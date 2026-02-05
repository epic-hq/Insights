/**
 * Billing smoke tests.
 * Validates billing portal endpoint redirects without server errors.
 */
import { test, expect } from "../fixtures";

test.describe("Billing Smoke", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping - requires auth credentials",
  );

  test.beforeEach(async ({ auth }) => {
    await auth.login();
  });

  test("billing portal redirects", async ({ page }) => {
    const response = await page.request.get("/api/billing/portal", {
      maxRedirects: 0,
    });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);

    const location = response.headers()["location"] || "";
    expect(location).toMatch(
      /(polar\.sh\/portal|\/a\/[^/]+\/billing|\/home\?error=owner_required)/,
    );
  });
});
