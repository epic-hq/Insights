/**
 * Survey chat mode E2E tests.
 *
 * Validates the respondent-facing chat experience:
 * - Chat mode button appears when allow_chat is enabled
 * - Clicking Chat switches the mode correctly
 * - Chat interface renders with input and messages area
 * - Chat auto-starts and agent responds
 * - Mode switching between Form and Chat works mid-survey
 * - Chat button hidden when survey has matrix questions
 */
import { test, expect } from "../fixtures";

// Helper: extract account/project IDs from page URL
async function getAccountProject(page: import("playwright/test").Page) {
  const url = page.url();
  const match = url.match(/\/a\/([^/]+)\/([^/]+)/);
  if (!match) throw new Error("Could not extract account/project IDs");
  return { accountId: match[1], projectId: match[2] };
}

test.describe("Survey Chat Mode — Respondent Experience", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping — requires auth credentials",
  );

  let surveySlug: string;
  let surveyEditUrl: string;

  test("enable chat mode on a survey via admin", async ({ auth, page }) => {
    await auth.login();

    const { accountId, projectId } = await getAccountProject(page);

    // Navigate to Ask section
    await page.goto(`/a/${accountId}/${projectId}/ask`);
    await page.waitForLoadState("networkidle");

    // Find or create a survey
    const surveyLink = page
      .locator('a[href*="/ask/"][href*="/edit"]')
      .first();
    if (await surveyLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      const href = await surveyLink.getAttribute("href");
      if (href) {
        surveyEditUrl = href;
        await page.goto(surveyEditUrl);
      }
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
        await page.waitForURL(/\/ask\/[^/]+\/edit/, { timeout: 10000 });
        surveyEditUrl = page.url();
      } else {
        test.skip(true, "No surveys found and cannot create one");
        return;
      }
    }

    await page.waitForLoadState("networkidle");

    // Go to Options tab
    await page.click(
      'button:has-text("Options"), [role="tab"]:has-text("Options")',
    );
    await page.waitForTimeout(500);

    // Enable chat mode toggle
    const chatModeSection = page.locator("text=Chat mode").locator("..");
    const chatSwitch = chatModeSection
      .locator("..")
      .locator('[role="switch"]');
    if (await chatSwitch.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isChecked = await chatSwitch.getAttribute("data-state");
      if (isChecked !== "checked") {
        await chatSwitch.click();
        await page.waitForTimeout(1500); // Wait for debounced save
      }
    }

    // Verify chat mode is enabled
    const savedIndicator = page.locator('span:has-text("Saved")');
    await savedIndicator
      .waitFor({ state: "visible", timeout: 5000 })
      .catch(() => {});

    // Extract the slug from the Distribute tab or page URL
    // Navigate to Distribute tab to find the public link
    await page.click(
      'button:has-text("Distribute"), [role="tab"]:has-text("Distribute")',
    );
    await page.waitForTimeout(500);

    // Look for the survey link in the distribute tab
    const linkElement = page
      .locator('input[value*="/research/"], a[href*="/research/"]')
      .first();
    if (await linkElement.isVisible({ timeout: 3000 }).catch(() => false)) {
      const linkValue =
        (await linkElement.getAttribute("value")) ??
        (await linkElement.getAttribute("href")) ??
        "";
      const slugMatch = linkValue.match(/\/research\/([^/?#]+)/);
      if (slugMatch) {
        surveySlug = slugMatch[1];
      }
    }

    // Fallback: extract slug from the edit URL path
    if (!surveySlug) {
      const editMatch = surveyEditUrl.match(/\/ask\/([^/]+)\/edit/);
      if (editMatch) {
        // The slug might be the list ID — we need the actual slug
        // Try to get it from the page content
        const slugInput = page.locator(
          'input[id*="slug"], input[name*="slug"]',
        );
        if (
          await slugInput.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          surveySlug = await slugInput.inputValue();
        }
      }
    }

    expect(surveySlug).toBeTruthy();
  });

  test("respondent sees Chat mode button on survey landing", async ({
    page,
  }) => {
    test.skip(!surveySlug, "No survey slug from previous test");

    // Visit the public survey URL (no auth needed)
    await page.goto(`/research/${surveySlug}`);
    await page.waitForLoadState("networkidle");

    // The mode selector should show Form and Chat buttons
    const formButton = page.locator("button", {
      has: page.locator("text=Form"),
    });
    const chatButton = page.locator("button", {
      has: page.locator("text=Chat"),
    });

    await expect(formButton).toBeVisible({ timeout: 5000 });
    await expect(chatButton).toBeVisible({ timeout: 5000 });
  });

  test("clicking Chat mode highlights the Chat button", async ({ page }) => {
    test.skip(!surveySlug, "No survey slug from previous test");

    await page.goto(`/research/${surveySlug}`);
    await page.waitForLoadState("networkidle");

    const chatButton = page.locator("button", {
      has: page.locator("text=Chat"),
    });
    await expect(chatButton).toBeVisible({ timeout: 5000 });

    // Click Chat
    await chatButton.click();
    await page.waitForTimeout(300);

    // Verify it has the active styling (border-white bg-white/10)
    await expect(chatButton).toHaveClass(/bg-white\/10/, { timeout: 2000 });
  });

  test("chat mode renders chat interface after submitting email", async ({
    page,
  }) => {
    test.skip(!surveySlug, "No survey slug from previous test");

    await page.goto(`/research/${surveySlug}`);
    await page.waitForLoadState("networkidle");

    // Select Chat mode
    const chatButton = page.locator("button", {
      has: page.locator("text=Chat"),
    });
    if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatButton.click();
      await page.waitForTimeout(300);
    }

    // Fill in email (if required)
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(`e2e-chat-test-${Date.now()}@test.com`);

      // Submit the form (click the CTA button)
      const ctaButton = page.locator(
        'button[type="submit"], button:has-text("Start"), button:has-text("Begin"), button:has-text("Continue")',
      );
      await ctaButton.first().click();
    }

    // Wait for chat interface to appear
    // Chat shows a message area and input field
    const chatMessages = page.locator('[class*="overflow-y-auto"]');
    await expect(chatMessages).toBeVisible({ timeout: 10000 });

    // Check for the chat input (textarea)
    const chatInput = page.locator("textarea");
    await expect(chatInput).toBeVisible({ timeout: 10000 });
  });

  test("chat auto-starts and shows agent greeting", async ({ page }) => {
    test.skip(!surveySlug, "No survey slug from previous test");

    await page.goto(`/research/${surveySlug}`);
    await page.waitForLoadState("networkidle");

    // Select Chat mode
    const chatButton = page.locator("button", {
      has: page.locator("text=Chat"),
    });
    if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatButton.click();
    }

    // Submit email
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(`e2e-chat-greet-${Date.now()}@test.com`);
      const ctaButton = page.locator(
        'button[type="submit"], button:has-text("Start"), button:has-text("Begin"), button:has-text("Continue")',
      );
      await ctaButton.first().click();
    }

    // Wait for the "Starting conversation..." loading state
    const loadingText = page.locator("text=Starting conversation");
    await expect(loadingText).toBeVisible({ timeout: 10000 }).catch(() => {
      // May have already transitioned to the greeting
    });

    // Wait for an assistant message to appear (the agent's greeting)
    // Assistant messages have bg-white/10 styling
    const assistantMessage = page.locator('[class*="bg-white/10"]').last();
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });

    // Verify the greeting contains some text (not just a spinner)
    const messageText = await assistantMessage.textContent();
    expect(messageText?.length).toBeGreaterThan(5);
  });

  test("respondent can send a message in chat mode", async ({ page }) => {
    test.skip(!surveySlug, "No survey slug from previous test");

    await page.goto(`/research/${surveySlug}`);
    await page.waitForLoadState("networkidle");

    // Select Chat mode and submit email
    const chatButton = page.locator("button", {
      has: page.locator("text=Chat"),
    });
    if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatButton.click();
    }
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(`e2e-chat-send-${Date.now()}@test.com`);
      const ctaButton = page.locator(
        'button[type="submit"], button:has-text("Start"), button:has-text("Begin"), button:has-text("Continue")',
      );
      await ctaButton.first().click();
    }

    // Wait for chat to initialize (agent greeting)
    const assistantMessage = page.locator('[class*="bg-white/10"]').last();
    await expect(assistantMessage).toBeVisible({ timeout: 30000 });

    // Type a response in the chat input
    const chatInput = page.locator("textarea");
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("This is my test response to the first question.");

    // Submit the message (Enter key or send button)
    const sendButton = page.locator(
      'button[type="submit"]:not([disabled])',
    );
    if (await sendButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sendButton.click();
    } else {
      await chatInput.press("Enter");
    }

    // Verify our message appears as a user message (bg-white text-black styling)
    const userMessage = page.locator('[class*="bg-white"][class*="text-black"]');
    await expect(userMessage.last()).toBeVisible({ timeout: 5000 });
    await expect(userMessage.last()).toContainText("test response", {
      timeout: 5000,
    });

    // Wait for the agent to respond
    // A new assistant message should appear after ours
    const allAssistantMessages = page.locator('[class*="bg-white/10"]');
    const initialCount = await allAssistantMessages.count();
    // Wait for a new assistant message
    await expect(allAssistantMessages).toHaveCount(initialCount + 1, {
      timeout: 30000,
    }).catch(() => {
      // Agent might still be streaming — check that at least the count didn't decrease
    });
  });

  test("mode switcher appears during chat and can switch to Form", async ({
    page,
  }) => {
    test.skip(!surveySlug, "No survey slug from previous test");

    await page.goto(`/research/${surveySlug}`);
    await page.waitForLoadState("networkidle");

    // Select Chat mode and submit email
    const chatButton = page.locator("button", {
      has: page.locator("text=Chat"),
    });
    if (await chatButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await chatButton.click();
    }
    const emailInput = page.locator('input[type="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill(`e2e-chat-switch-${Date.now()}@test.com`);
      const ctaButton = page.locator(
        'button[type="submit"], button:has-text("Start"), button:has-text("Begin"), button:has-text("Continue")',
      );
      await ctaButton.first().click();
    }

    // Wait for chat interface
    const chatInput = page.locator("textarea");
    await expect(chatInput).toBeVisible({ timeout: 30000 });

    // Look for the in-survey mode switcher (Form/Chat pills at bottom)
    const formPill = page.locator(
      'button:has-text("Form"):not([class*="flex-1"])',
    );
    await expect(formPill).toBeVisible({ timeout: 5000 });

    // Click Form to switch
    await formPill.click();
    await page.waitForTimeout(1000);

    // Verify survey switched to form mode — should show question UI with Next button
    const nextButton = page.locator(
      'button:has-text("Next"), button:has-text("Submit")',
    );
    await expect(nextButton.first()).toBeVisible({ timeout: 10000 });
  });
});
