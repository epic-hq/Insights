/**
 * Survey editor E2E tests.
 *
 * Validates question CRUD operations in the survey editor:
 * - Adding questions persists correctly
 * - Empty-prompt questions don't break saves of other fields
 * - Deleting and reordering questions works
 */
import { test, expect } from "../fixtures";

test.describe("Survey Editor — Questions", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping — requires auth credentials",
  );

  // We need account/project IDs and a survey to edit.
  // Navigate to the Ask section and pick the first survey (or create one).
  let surveyEditUrl: string;

  test.beforeEach(async ({ auth, page }) => {
    await auth.login();

    // Ensure we are on an app route before extracting account/project IDs.
    let url = page.url();
    if (!/\/a\/[^/]+\/[^/]+/.test(url)) {
      await page.goto("/login");
      await page.waitForURL(/\/a\/[^/]+\/[^/]+/, { timeout: 15000 });
      url = page.url();
    }

    const match = url.match(/\/a\/([^/]+)\/([^/]+)/);
    if (!match)
      throw new Error("Could not extract account/project IDs from URL");
    const [, accountId, projectId] = match;

    // Go to the Ask (surveys) section
    await page.goto(`/a/${accountId}/${projectId}/ask`);
    await page.waitForLoadState("networkidle");

    // Try to find an existing survey link to edit
    const surveyLink = page.locator('a[href*="/ask/"][href*="/edit"]').first();
    if (await surveyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await surveyLink.getAttribute("href");
      if (href) {
        surveyEditUrl = href;
        await page.goto(surveyEditUrl);
        return;
      }
    }

    // No existing survey — create one via the UI
    const createButton = page
      .locator(
        'button:has-text("New"), button:has-text("Create"), a:has-text("New"), a:has-text("Create")',
      )
      .first();
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForURL(/\/ask\/[^/]+\/edit/, { timeout: 10000 });
      surveyEditUrl = page.url();
    } else {
      test.skip(true, "No surveys found and cannot create one");
    }
  });

  test("can add a question and it persists", async ({ page }) => {
    // Click the Questions tab
    await page.click(
      'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
    );
    await page.waitForTimeout(500);

    // Count existing questions
    const initialCount = await page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({
        has: page.locator('span.tabular-nums, [class*="tabular-nums"]'),
      })
      .count();

    // Click "Add question"
    await page.click('button:has-text("Add question")');
    await page.waitForTimeout(300);

    // A new question row should appear (and the drawer should open)
    const questionRows = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({
        has: page.locator('span.tabular-nums, [class*="tabular-nums"]'),
      });
    await expect(questionRows).toHaveCount(initialCount + 1, { timeout: 3000 });

    // Type in the question prompt in the drawer
    const promptTextarea = page.locator(
      'textarea[placeholder*="What would you like to ask"]',
    );
    if (await promptTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await promptTextarea.fill("E2E Test Question — does it persist?");
      await page.waitForTimeout(1500); // Wait for debounced save
    }

    // Verify no error status
    const errorIndicator = page.locator('span:has-text("Error")').first();
    await expect(errorIndicator).not.toBeVisible({ timeout: 3000 });
  });

  test("added question persists after page reload", async ({ page }) => {
    // Go to Questions tab
    await page.click(
      'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
    );
    await page.waitForTimeout(500);

    const questionRows = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({
        has: page.locator('span.tabular-nums, [class*="tabular-nums"]'),
      });
    const initialCount = await questionRows.count();

    // Add a question
    await page.click('button:has-text("Add question")');
    await page.waitForTimeout(300);

    const uniqueText = `Persist test ${Date.now()}`;
    const promptTextarea = page.locator(
      'textarea[placeholder*="What would you like to ask"]',
    );
    if (await promptTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await promptTextarea.fill(uniqueText);
      await promptTextarea.blur();
    }

    // Wait for save to complete
    await page.waitForTimeout(2500);
    const savedIndicator = page.locator('span:has-text("Saved")');
    await savedIndicator
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {});

    // Reload
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Go to Questions tab again
    await page.click(
      'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
    );
    await page.waitForTimeout(500);

    // Verify the newly added row persisted.
    await expect(questionRows).toHaveCount(initialCount + 1, { timeout: 5000 });
  });

  test("can add empty question then edit other fields without error", async ({
    page,
  }) => {
    // Go to Questions tab and add an empty question
    await page.click(
      'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
    );
    await page.waitForTimeout(500);
    await page.click('button:has-text("Add question")');
    await page.waitForTimeout(300);

    // Close the drawer by pressing Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // Switch to Landing Page tab
    await page.click(
      'button:has-text("Landing page"), [role="tab"]:has-text("Landing page")',
    );
    await page.waitForTimeout(500);

    // Edit the headline
    const headlineInput = page.locator(
      'input#hero_title, input[id="hero_title"]',
    );
    if (await headlineInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      const currentValue = await headlineInput.inputValue();
      await headlineInput.fill(`${currentValue} (edited)`);
      await page.waitForTimeout(1500); // Wait for debounced save
    }

    // Verify no error status — this is the key assertion.
    // Before the fix, the empty-prompt question would cause validation failure.
    const errorIndicator = page.locator('span:has-text("Error")').first();
    await expect(errorIndicator).not.toBeVisible({ timeout: 3000 });

    // Restore original value
    if (await headlineInput.isVisible().catch(() => false)) {
      const editedValue = await headlineInput.inputValue();
      await headlineInput.fill(editedValue.replace(" (edited)", ""));
      await page.waitForTimeout(1500);
    }
  });

  test("can delete a question", async ({ page }) => {
    // Go to Questions tab
    await page.click(
      'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
    );
    await page.waitForTimeout(500);

    // Ensure there's a question to delete — add one first
    await page.click('button:has-text("Add question")');
    await page.waitForTimeout(300);

    const promptTextarea = page.locator(
      'textarea[placeholder*="What would you like to ask"]',
    );
    if (await promptTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await promptTextarea.fill(`Delete me ${Date.now()}`);
      await page.waitForTimeout(1500);
    }

    // Count questions before delete
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const questionRows = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({
        has: page.locator('span.tabular-nums, [class*="tabular-nums"]'),
      });
    const countBefore = await questionRows.count();

    // Click the last question to open its drawer
    await questionRows.last().click();
    await page.waitForTimeout(300);

    // Click Delete button in the drawer
    const deleteButton = page.locator('[role="dialog"] button:has-text("Delete")').last();
    await expect(deleteButton).toBeVisible({ timeout: 2000 });
    await deleteButton.click({ force: true });
    await page.waitForTimeout(500);

    // Verify the question count decreased
    await expect(questionRows).toHaveCount(countBefore - 1, { timeout: 3000 });
  });

  test("can reorder questions", async ({ page }) => {
    // Go to Questions tab
    await page.click(
      'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
    );
    await page.waitForTimeout(500);

    // Ensure we have at least 2 questions
    const questionRows = page
      .locator('[class*="rounded-lg"][class*="border"]')
      .filter({
        has: page.locator('span.tabular-nums, [class*="tabular-nums"]'),
      });
    const initialCount = await questionRows.count();

    if (initialCount < 2) {
      // Add questions to get to 2
      for (let i = initialCount; i < 2; i++) {
        await page.click('button:has-text("Add question")');
        await page.waitForTimeout(300);
        const promptTextarea = page.locator(
          'textarea[placeholder*="What would you like to ask"]',
        );
        if (
          await promptTextarea.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await promptTextarea.fill(`Reorder test Q${i + 1} ${Date.now()}`);
          await page.waitForTimeout(1500);
        }
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    }

    // Get the text of the second question
    const secondQuestionText = await questionRows
      .nth(1)
      .locator('span.truncate, [class*="truncate"]')
      .first()
      .textContent();

    // Click the second question to open its drawer
    await questionRows.nth(1).click();
    await page.waitForTimeout(300);

    // Click "Move up"
    const moveUpButton = page.locator('button:has-text("Move up")');
    await expect(moveUpButton).toBeVisible({ timeout: 2000 });
    await moveUpButton.click();
    await page.waitForTimeout(500);

    // The text that was second should now be first
    const firstQuestionText = await questionRows
      .nth(0)
      .locator('span.truncate, [class*="truncate"]')
      .first()
      .textContent();
    expect(firstQuestionText).toBe(secondQuestionText);
  });
});
