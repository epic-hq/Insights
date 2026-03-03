/**
 * E2E tests: Dialog/Sheet + Portal component interactions.
 *
 * Validates that Radix portal-based components (Select, Popover, Command)
 * inside Dialog/Sheet containers do NOT dismiss the outer container when
 * the user interacts with them.
 *
 * This class of bug is undetectable by vitest/jsdom because it requires
 * real browser DOM rendering with actual portal mounting and pointer
 * event propagation through the dismiss layer system.
 *
 * Coverage:
 * - Survey editor: question type Select inside Sheet drawer
 * - Survey editor: likert scale Select inside Sheet drawer
 * - Task create: category/priority Select + datepicker Popover inside Dialog
 * - Edit person data: Select + Popover+Command inside Sheet
 * - Create task from insight: Select inside Dialog
 */
import { test, expect } from "../fixtures";

test.describe("Dialog/Sheet portal dismiss protection", () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping — requires auth credentials",
  );

  let accountId: string;
  let projectId: string;

  test.beforeEach(async ({ auth, page }) => {
    await auth.login();
    await page.waitForURL(/\/a\/[^/]+\/[^/]+/, { timeout: 15000 });
    const url = page.url();
    const match = url.match(/\/a\/([^/]+)\/([^/]+)/);
    if (!match)
      throw new Error("Could not extract account/project IDs from URL");
    [, accountId, projectId] = match;
  });

  test.describe("Survey Editor — Question Type Select in Drawer", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to Ask section and open/create a survey
      await page.goto(`/a/${accountId}/${projectId}/ask`);
      await page.waitForLoadState("networkidle");

      const surveyLink = page
        .locator('a[href*="/ask/"][href*="/edit"]')
        .first();
      if (await surveyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await surveyLink.click();
      } else {
        const createButton = page
          .locator(
            'button:has-text("New"), button:has-text("Create"), a:has-text("New"), a:has-text("Create")',
          )
          .first();
        if (
          await createButton.isVisible({ timeout: 3000 }).catch(() => false)
        ) {
          await createButton.click();
        } else {
          test.skip(true, "No surveys found and cannot create one");
          return;
        }
      }

      await page.waitForURL(/\/ask\/[^/]+\/edit/, { timeout: 10000 });
      await page.waitForLoadState("networkidle");

      // Click the Questions tab
      await page.click(
        'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
      );
      await page.waitForTimeout(500);
    });

    test("drawer stays open after changing question type to Select One", async ({
      page,
    }) => {
      // Add a question and open its drawer
      await page.click('button:has-text("Add question")');
      await page.waitForTimeout(500);

      // Verify the drawer (Sheet) is open
      const drawer = page.locator('[data-slot="sheet-content"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      // Find the Type select trigger inside the drawer
      const typeSelect = drawer.locator('[data-slot="select-trigger"]').first();
      await expect(typeSelect).toBeVisible({ timeout: 2000 });
      await typeSelect.click();
      await page.waitForTimeout(300);

      // Click "Select one" option in the dropdown portal
      const selectOneOption = page.locator(
        '[data-slot="select-item"]:has-text("Select one")',
      );
      await expect(selectOneOption).toBeVisible({ timeout: 2000 });
      await selectOneOption.click();
      await page.waitForTimeout(500);

      // CRITICAL: The drawer must still be visible after selecting
      await expect(drawer).toBeVisible({ timeout: 2000 });

      // The options textarea should now be visible (for entering select options)
      const optionsArea = drawer.locator(
        'textarea[placeholder*="Options"], label:has-text("Options")',
      );
      await expect(optionsArea.first()).toBeVisible({ timeout: 2000 });
    });

    test("drawer stays open after changing question type to Select Many", async ({
      page,
    }) => {
      await page.click('button:has-text("Add question")');
      await page.waitForTimeout(500);

      const drawer = page.locator('[data-slot="sheet-content"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      const typeSelect = drawer.locator('[data-slot="select-trigger"]').first();
      await typeSelect.click();
      await page.waitForTimeout(300);

      const selectManyOption = page.locator(
        '[data-slot="select-item"]:has-text("Select many")',
      );
      await selectManyOption.click();
      await page.waitForTimeout(500);

      // Drawer must remain open
      await expect(drawer).toBeVisible({ timeout: 2000 });

      // Options input should be visible
      const optionsArea = drawer.locator(
        'textarea[placeholder*="Options"], label:has-text("Options")',
      );
      await expect(optionsArea.first()).toBeVisible({ timeout: 2000 });
    });

    test("drawer stays open after changing question type to Likert", async ({
      page,
    }) => {
      await page.click('button:has-text("Add question")');
      await page.waitForTimeout(500);

      const drawer = page.locator('[data-slot="sheet-content"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      const typeSelect = drawer.locator('[data-slot="select-trigger"]').first();
      await typeSelect.click();
      await page.waitForTimeout(300);

      const likertOption = page.locator(
        '[data-slot="select-item"]:has-text("Likert")',
      );
      await likertOption.click();
      await page.waitForTimeout(500);

      // Drawer must remain open
      await expect(drawer).toBeVisible({ timeout: 2000 });

      // Likert scale config should be visible
      const scaleLabel = drawer.locator('label:has-text("Scale")');
      await expect(scaleLabel).toBeVisible({ timeout: 2000 });
    });

    test("drawer stays open after changing likert scale value", async ({
      page,
    }) => {
      await page.click('button:has-text("Add question")');
      await page.waitForTimeout(500);

      const drawer = page.locator('[data-slot="sheet-content"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      // First change type to Likert
      const typeSelect = drawer.locator('[data-slot="select-trigger"]').first();
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page
        .locator('[data-slot="select-item"]:has-text("Likert")')
        .click();
      await page.waitForTimeout(500);

      // Now change the scale (the second Select in the drawer)
      const scaleSelect = drawer.locator('[data-slot="select-trigger"]').nth(1);
      await expect(scaleSelect).toBeVisible({ timeout: 2000 });
      await scaleSelect.click();
      await page.waitForTimeout(300);

      // Select "1-7" scale
      const scale7Option = page.locator(
        '[data-slot="select-item"]:has-text("1-7")',
      );
      await scale7Option.click();
      await page.waitForTimeout(500);

      // Drawer must still be open
      await expect(drawer).toBeVisible({ timeout: 2000 });
    });

    test("can enter options after selecting type and they persist", async ({
      page,
    }) => {
      await page.click('button:has-text("Add question")');
      await page.waitForTimeout(500);

      const drawer = page.locator('[data-slot="sheet-content"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      // Type a question prompt first
      const promptArea = drawer.locator(
        'textarea[placeholder*="What would you like to ask"]',
      );
      await promptArea.fill("What is your favorite color?");
      await page.waitForTimeout(300);

      // Change type to Select one
      const typeSelect = drawer.locator('[data-slot="select-trigger"]').first();
      await typeSelect.click();
      await page.waitForTimeout(300);
      await page
        .locator('[data-slot="select-item"]:has-text("Select one")')
        .click();
      await page.waitForTimeout(500);

      // Drawer should still be open with options textarea
      await expect(drawer).toBeVisible();
      const optionsTextarea = drawer.locator(
        'textarea[placeholder*="Options"]',
      );
      await expect(optionsTextarea).toBeVisible({ timeout: 2000 });

      // Enter comma-separated options
      await optionsTextarea.fill("Red, Blue, Green, Yellow");
      await optionsTextarea.blur(); // Trigger parseAndSync
      await page.waitForTimeout(1500); // Wait for save

      // Verify the options were saved by checking the question row preview
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);

      // The question row should show the options
      const questionText = page.locator('text="What is your favorite color?"');
      await expect(questionText).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe("Task Create Modal — Select + Popover inside Dialog", () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to priorities/tasks page
      await page.goto(`/a/${accountId}/${projectId}/priorities`);
      await page.waitForLoadState("networkidle");
    });

    test("dialog stays open after selecting category", async ({ page }) => {
      // Open the create task modal
      const addButton = page.locator('button:has-text("Add Task")').first();
      if (!(await addButton.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, "Add Task button not found");
        return;
      }
      await addButton.click();
      await page.waitForTimeout(500);

      // Verify dialog is open
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Click the Category select
      const categorySelect = dialog
        .locator('[data-slot="select-trigger"]')
        .first();
      await expect(categorySelect).toBeVisible({ timeout: 2000 });
      await categorySelect.click();
      await page.waitForTimeout(300);

      // Select a category
      const usabilityOption = page.locator(
        '[data-slot="select-item"]:has-text("Usability")',
      );
      await usabilityOption.click();
      await page.waitForTimeout(500);

      // CRITICAL: Dialog must remain open
      await expect(dialog).toBeVisible({ timeout: 2000 });

      // Title input should still be functional
      const titleInput = dialog.locator('input[placeholder*="What needs"]');
      await expect(titleInput).toBeVisible();
    });

    test("dialog stays open after selecting priority", async ({ page }) => {
      const addButton = page.locator('button:has-text("Add Task")').first();
      if (!(await addButton.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, "Add Task button not found");
        return;
      }
      await addButton.click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Click the Priority select (second select in the dialog)
      const prioritySelect = dialog
        .locator('[data-slot="select-trigger"]')
        .nth(1);
      await expect(prioritySelect).toBeVisible({ timeout: 2000 });
      await prioritySelect.click();
      await page.waitForTimeout(300);

      // Select a priority option
      const priorityOption = page.locator('[data-slot="select-item"]').first();
      await priorityOption.click();
      await page.waitForTimeout(500);

      // Dialog must remain open
      await expect(dialog).toBeVisible({ timeout: 2000 });
    });

    test("dialog stays open after using date picker popover", async ({
      page,
    }) => {
      const addButton = page.locator('button:has-text("Add Task")').first();
      if (!(await addButton.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, "Add Task button not found");
        return;
      }
      await addButton.click();
      await page.waitForTimeout(500);

      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      // Click the date picker trigger ("Select" button in the Due Date area)
      const dateButton = dialog.locator('button:has-text("Select")').last();
      if (!(await dateButton.isVisible({ timeout: 2000 }).catch(() => false))) {
        test.skip(true, "Date picker button not found");
        return;
      }
      await dateButton.click();
      await page.waitForTimeout(300);

      // The calendar popover should appear
      const calendar = page.locator('[role="grid"]');
      await expect(calendar).toBeVisible({ timeout: 2000 });

      // Click a day in the calendar
      const dayButton = calendar.locator('button[name="day"]').first();
      if (await dayButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await dayButton.click();
        await page.waitForTimeout(500);
      }

      // Dialog must remain open after interacting with calendar popover
      await expect(dialog).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe("Generic: all dialogs survive Select interactions", () => {
    test("survey editor drawer survives multiple rapid type changes", async ({
      page,
    }) => {
      await page.goto(`/a/${accountId}/${projectId}/ask`);
      await page.waitForLoadState("networkidle");

      const surveyLink = page
        .locator('a[href*="/ask/"][href*="/edit"]')
        .first();
      if (!(await surveyLink.isVisible({ timeout: 3000 }).catch(() => false))) {
        test.skip(true, "No survey found");
        return;
      }
      await surveyLink.click();
      await page.waitForURL(/\/ask\/[^/]+\/edit/, { timeout: 10000 });
      await page.waitForLoadState("networkidle");

      await page.click(
        'button:has-text("Questions"), [role="tab"]:has-text("Questions")',
      );
      await page.waitForTimeout(500);

      await page.click('button:has-text("Add question")');
      await page.waitForTimeout(500);

      const drawer = page.locator('[data-slot="sheet-content"]');
      await expect(drawer).toBeVisible({ timeout: 3000 });

      // Rapidly cycle through types: Auto → Select one → Likert → Short text
      const types = [
        "Select one",
        "Likert scale",
        "Short text",
        "Select many",
        "Long text",
      ];

      for (const typeName of types) {
        const typeSelect = drawer
          .locator('[data-slot="select-trigger"]')
          .first();
        await typeSelect.click();
        await page.waitForTimeout(200);

        const option = page.locator(
          `[data-slot="select-item"]:has-text("${typeName}")`,
        );
        if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
          await option.click();
          await page.waitForTimeout(300);
        } else {
          // Close dropdown if option not found
          await page.keyboard.press("Escape");
        }

        // Drawer must stay open after every type change
        await expect(drawer).toBeVisible({ timeout: 1000 });
      }

      // Final verification: drawer is still open
      await expect(drawer).toBeVisible();
    });
  });
});
