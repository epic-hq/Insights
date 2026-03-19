import { test, expect } from "../fixtures";

function uniqueSurveyTitle() {
  return `E2E Matrix Branching ${Date.now()}`;
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function waitForEditorSave(page: Parameters<typeof test>[0]["page"]) {
  const saved = page.getByText("Saved").first();

  await page.waitForTimeout(1800);
  if (await saved.isVisible().catch(() => false)) {
    return;
  }

  await page.waitForTimeout(2000);
}

async function chooseRadixOption(
  page: Parameters<typeof test>[0]["page"],
  trigger: ReturnType<Parameters<typeof test>[0]["page"]["getByTestId"]>,
  optionLabel: string | RegExp,
) {
  await trigger.click();
  const option =
    typeof optionLabel === "string"
      ? page.getByRole("option", {
          name: new RegExp(escapeRegex(optionLabel), "i"),
        })
      : page.getByRole("option", { name: optionLabel });
  await expect(option.first()).toBeVisible({ timeout: 5000 });
  await option.first().click();
}

async function ensureAuthenticatedApp(page: Parameters<typeof test>[0]["page"], auth: Parameters<typeof test>[0]["auth"]) {
  await auth.login();

  let url = page.url();
  if (!/\/a\/[^/]+\/[^/]+/.test(url)) {
    await page.goto("/home");
    url = page.url();
  }

  let match = url.match(/\/a\/([^/]+)\/([^/]+)/);
  if (!match) {
    const workspaceHref =
      (await page.getByRole("link", { name: "Tasks" }).getAttribute("href")) ||
      (await page.locator('a[href*="/a/"]').first().getAttribute("href"));
    match = workspaceHref?.match(/\/a\/([^/]+)\/([^/]+)/) ?? null;
  }
  if (!match) {
    throw new Error("Could not extract account/project IDs from authenticated URL");
  }

  return {
    accountId: match[1],
    projectId: match[2],
  };
}

async function createDisposableSurvey(
  page: Parameters<typeof test>[0]["page"],
  accountId: string,
  projectId: string,
  title: string,
) {
  await page.goto(`/a/${accountId}/${projectId}/ask/new`);
  const titleInput = page.getByRole("textbox", { name: "Title" });
  await expect(titleInput).toBeVisible({ timeout: 10000 });
  await titleInput.click();
  await titleInput.fill(title);
  await expect(titleInput).toHaveValue(title);

  const nextButton = page.getByRole("button", { name: /Next: Add Questions/i });
  await expect(nextButton).toBeEnabled({ timeout: 10000 });
  await nextButton.click();

  const bulkInput = page.getByPlaceholder("Type questions here, one per line...");
  await bulkInput.fill("Starter question");
  await page.getByRole("button", { name: /Add 1 question/i }).click();
  await page.getByRole("button", { name: /Create Survey/i }).click();

  await page.waitForURL(/\/ask\/[^/]+\/edit/, { timeout: 45000 });
  await expect(page.getByRole("tab", { name: "Questions" })).toBeVisible({ timeout: 10000 });
}

async function openQuestionsTab(page: Parameters<typeof test>[0]["page"]) {
  await page.getByRole("tab", { name: "Questions" }).click();
  await expect(page.getByTestId("question-list-add")).toBeVisible({ timeout: 5000 });
}

async function openQuestionEditor(page: Parameters<typeof test>[0]["page"], index: number) {
  const row = page.getByTestId("question-row").nth(index);
  await expect(row).toBeVisible({ timeout: 5000 });
  await row.click();
  await expect(page.getByTestId("question-editor-drawer")).toBeVisible({ timeout: 5000 });
}

async function closeQuestionEditor(page: Parameters<typeof test>[0]["page"]) {
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("question-editor-drawer")).toBeHidden({ timeout: 5000 });
}

async function addQuestion(page: Parameters<typeof test>[0]["page"]) {
  await page.getByTestId("question-list-add").click();
  await expect(page.getByTestId("question-editor-drawer")).toBeVisible({ timeout: 5000 });
}

async function setQuestionPrompt(page: Parameters<typeof test>[0]["page"], prompt: string) {
  const input = page.getByTestId("question-text-input");
  await input.fill(prompt);
  await input.blur();
}

async function setQuestionType(page: Parameters<typeof test>[0]["page"], typeLabel: string) {
  await chooseRadixOption(page, page.getByTestId("question-type-select"), typeLabel);
}

async function assignQuestionBlock(
  page: Parameters<typeof test>[0]["page"],
  blockTitle: string,
  create = false,
) {
  await page.getByTestId("question-section-select").click();
  if (create) {
    await page.getByRole("option", { name: /Create new block/i }).click();
    const blockInput = page.getByTestId("question-section-create-input");
    await blockInput.fill(blockTitle);
    await page.getByTestId("question-section-create-button").click();
  } else {
    await page.getByRole("option", { name: new RegExp(escapeRegex(blockTitle), "i") }).first().click();
  }
}

async function setOptionsText(page: Parameters<typeof test>[0]["page"], options: string[]) {
  const textarea = page.getByTestId("question-options-editor").locator("textarea");
  await textarea.fill(options.join("\n"));
  await textarea.blur();
}

async function setMatrixRows(page: Parameters<typeof test>[0]["page"], rows: string[]) {
  for (let i = 0; i < rows.length; i++) {
    if (i > 1) {
      await page.getByTestId("question-matrix-add-row").click();
    }
    const rowInput = page.getByTestId(`question-matrix-row-${i}`);
    await rowInput.fill(rows[i]);
    await rowInput.blur();
  }
}

async function setImageOptions(
  page: Parameters<typeof test>[0]["page"],
  options: Array<{ label: string; imageUrl: string }>,
) {
  for (let i = 0; i < options.length; i++) {
    if (i > 0) {
      await page.getByRole("button", { name: /Add image option/i }).click();
    }
    const labels = page.getByPlaceholder("Label");
    const urls = page.getByPlaceholder("Image URL or click thumbnail");
    await labels.nth(i).fill(options[i].label);
    await urls.nth(i).fill(options[i].imageUrl);
    await urls.nth(i).blur();
  }
}

async function setDefaultBranchDestination(
  page: Parameters<typeof test>[0]["page"],
  destination: string,
) {
  await chooseRadixOption(page, page.getByTestId("branch-default-next-select"), destination);
}

async function addManualBranchRule(
  page: Parameters<typeof test>[0]["page"],
  ruleIndex: number,
  sourceQuestionLabel: string,
  operatorLabel: string,
  valueLabel: string,
  targetLabel: string,
) {
  if (ruleIndex > 0) {
    await page.getByTestId("branch-add-manual-rule").click();
  } else if (!(await page.getByTestId(`branch-rule-${ruleIndex}`).isVisible().catch(() => false))) {
    await page.getByTestId("branch-add-manual-rule").click();
  }

  await chooseRadixOption(page, page.getByTestId(`branch-rule-${ruleIndex}-condition-question`), sourceQuestionLabel);
  await chooseRadixOption(page, page.getByTestId(`branch-rule-${ruleIndex}-operator`), operatorLabel);

  const valueSelect = page.getByTestId(`branch-rule-${ruleIndex}-value-select`);
  const valueInput = page.getByTestId(`branch-rule-${ruleIndex}-value-input`);
  if (await valueSelect.isVisible().catch(() => false)) {
    await chooseRadixOption(page, valueSelect, valueLabel);
  } else {
    await valueInput.fill(valueLabel);
    await valueInput.blur();
  }

  await chooseRadixOption(page, page.getByTestId(`branch-rule-${ruleIndex}-target`), targetLabel);
}

async function openAnonymousSurveyFlow(
  browser: Parameters<typeof test>[0]["browser"],
  publicUrl: string,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(publicUrl);
  await expect(page.getByTestId("survey-question")).toBeVisible({ timeout: 10000 });
  return { context, page };
}

async function answerSelect(page: Parameters<typeof test>[0]["page"], value: string) {
  await page
    .getByTestId("survey-select-option")
    .filter({ hasText: new RegExp(escapeRegex(value), "i") })
    .first()
    .click();
}

async function answerShortText(page: Parameters<typeof test>[0]["page"], value: string) {
  await page.getByTestId("survey-text-input").fill(value);
}

async function answerLongText(page: Parameters<typeof test>[0]["page"], value: string) {
  await page.getByTestId("survey-textarea-input").fill(value);
}

async function nextQuestion(page: Parameters<typeof test>[0]["page"]) {
  await page.getByTestId("survey-next-button").click();
}

async function expectSurveyComplete(page: Parameters<typeof test>[0]["page"]) {
  await expect(page.getByTestId("survey-complete")).toBeVisible({ timeout: 45000 });
}

test.describe("Survey Editor — matrix + block branching", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300000);

  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    "Skipping — requires auth credentials",
  );

  test("can author all core question types and execute multi-block branching paths", async ({
    auth,
    browser,
    page,
  }) => {
    const { accountId, projectId } = await ensureAuthenticatedApp(page, auth);
    await createDisposableSurvey(page, accountId, projectId, uniqueSurveyTitle());

    await openQuestionsTab(page);

    // Q1 Shared Intro: single select role screener
    await openQuestionEditor(page, 0);
    await setQuestionPrompt(page, "What best describes your role?");
    await setQuestionType(page, "Select one");
    await setOptionsText(page, ["Founder", "Service provider", "Investor"]);
    await closeQuestionEditor(page);

    // Q2 Shared Intro: short text, branches based on Q1
    await addQuestion(page);
    await setQuestionPrompt(page, "What organization are you representing?");
    await setQuestionType(page, "Short text");
    await closeQuestionEditor(page);

    // Q3 Founders Path: multi select
    await addQuestion(page);
    await setQuestionPrompt(page, "What are your top needs right now?");
    await setQuestionType(page, "Select many");
    await assignQuestionBlock(page, "Founders Path", true);
    await setOptionsText(page, ["Funding", "Hiring", "Customer discovery", "Product help"]);
    await closeQuestionEditor(page);

    // Q4 Founders Path: single select decision point
    await addQuestion(page);
    await setQuestionPrompt(page, "Do you need fundraising help in the next 6 months?");
    await setQuestionType(page, "Select one");
    await assignQuestionBlock(page, "Founders Path");
    await setOptionsText(page, ["Yes", "No"]);
    await closeQuestionEditor(page);

    // Q5 Funding Diagnostic: matrix
    await addQuestion(page);
    await setQuestionPrompt(page, "Rate how well StartupSD supports your fundraising journey.");
    await setQuestionType(page, "Matrix grid");
    await assignQuestionBlock(page, "Funding Diagnostic", true);
    await setMatrixRows(page, [
      "Investor access",
      "Pitch feedback",
      "Fundraising education",
    ]);
    await closeQuestionEditor(page);

    // Q6 Service Provider Path: image select
    await addQuestion(page);
    await setQuestionPrompt(page, "Which format would make StartupSD partnership resources most useful?");
    await setQuestionType(page, "Image select");
    await assignQuestionBlock(page, "Service Provider Path", true);
    await setImageOptions(page, [
      {
        label: "Playbook",
        imageUrl: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=400&q=80",
      },
      {
        label: "Directory",
        imageUrl: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=400&q=80",
      },
      {
        label: "Events",
        imageUrl: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=400&q=80",
      },
    ]);
    await closeQuestionEditor(page);

    // Q7 Investor Path: likert
    await addQuestion(page);
    await setQuestionPrompt(page, "How likely are you to mentor or advise StartupSD founders?");
    await setQuestionType(page, "Likert scale");
    await assignQuestionBlock(page, "Investor Path", true);
    await closeQuestionEditor(page);

    // Q8 Shared Closing: long text
    await addQuestion(page);
    await setQuestionPrompt(page, "What else should StartupSD know?");
    await setQuestionType(page, "Long text");
    await assignQuestionBlock(page, "Shared Closing", true);
    await closeQuestionEditor(page);

    // Q2 branching: route from shared intro into path blocks using Q1 as the source.
    await openQuestionEditor(page, 1);
    await page.getByTestId("question-branching-toggle").click();
    await setDefaultBranchDestination(page, "Founders Path");
    await addManualBranchRule(page, 0, "Q1:", "equals", "Service provider", "Service Provider Path");
    await addManualBranchRule(page, 1, "Q1:", "equals", "Investor", "Investor Path");
    await closeQuestionEditor(page);

    // Q4 branching: founders who need fundraising help go to matrix, otherwise shared closing.
    await openQuestionEditor(page, 3);
    await page.getByTestId("question-branching-toggle").click();
    await setDefaultBranchDestination(page, "Shared Closing");
    await addManualBranchRule(page, 0, "Q4:", "equals", "Yes", "Funding Diagnostic");
    await closeQuestionEditor(page);

    // Rejoin branch exits into shared closing.
    await openQuestionEditor(page, 4);
    await page.getByTestId("question-branching-toggle").click();
    await setDefaultBranchDestination(page, "Shared Closing");
    await closeQuestionEditor(page);

    await openQuestionEditor(page, 5);
    await page.getByTestId("question-branching-toggle").click();
    await setDefaultBranchDestination(page, "Shared Closing");
    await closeQuestionEditor(page);

    await openQuestionEditor(page, 6);
    await page.getByTestId("question-branching-toggle").click();
    await setDefaultBranchDestination(page, "Shared Closing");
    await closeQuestionEditor(page);

    // Public survey should be anonymous to make runtime validation deterministic.
    await page.getByRole("tab", { name: "Options" }).click();
    await page.getByTestId("identity-type-anonymous").click();
    await waitForEditorSave(page);

    // Reload to prove all authored structure persisted.
    await page.reload();
    await openQuestionsTab(page);
    await expect(page.getByTestId("question-row")).toHaveCount(8, { timeout: 10000 });
    await expect(page.getByTestId("question-list-summary")).toContainText("Respondents see 4-6 questions");
    await expect(page.getByTestId("question-list-summary")).toContainText("~");

    // Capture live survey URL.
    await page.getByRole("tab", { name: "Distribute" }).click();
    const publicUrl = (await page.getByTestId("survey-public-link").textContent())?.trim();
    expect(publicUrl).toBeTruthy();

    // Founder yes path -> hits matrix
    {
      const { context, page: surveyPage } = await openAnonymousSurveyFlow(browser, publicUrl!);
      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("What best describes your role");
      await answerSelect(surveyPage, "Founder");
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("What organization are you representing");
      await answerShortText(surveyPage, "Acme Labs");
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("What are your top needs right now");
      await surveyPage.getByText("Funding").click();
      await surveyPage.getByText("Hiring").click();
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("Do you need fundraising help");
      await answerSelect(surveyPage, "Yes");
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("Rate how well StartupSD supports");
      await surveyPage.getByRole("button", { name: /Rate Investor access 4/i }).click();
      await surveyPage.getByRole("button", { name: /Rate Pitch feedback 3/i }).click();
      await surveyPage.getByRole("button", { name: /Rate Fundraising education 5/i }).click();
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("What else should StartupSD know");
      await answerLongText(surveyPage, "Founder feedback about fundraising support.");
      await nextQuestion(surveyPage);
      await expectSurveyComplete(surveyPage);
      await context.close();
    }

    // Service provider path -> hits image select and skips founder/investor branches.
    {
      const { context, page: surveyPage } = await openAnonymousSurveyFlow(browser, publicUrl!);
      await answerSelect(surveyPage, "Service provider");
      await nextQuestion(surveyPage);

      await answerShortText(surveyPage, "Partner Co");
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("Which format would make StartupSD partnership resources most useful");
      await surveyPage.getByTestId("survey-image-option").filter({ hasText: "Directory" }).click();
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("What else should StartupSD know");
      await answerLongText(surveyPage, "Service provider feedback.");
      await nextQuestion(surveyPage);
      await expectSurveyComplete(surveyPage);
      await context.close();
    }

    // Investor path -> hits likert and skips other branch blocks.
    {
      const { context, page: surveyPage } = await openAnonymousSurveyFlow(browser, publicUrl!);
      await answerSelect(surveyPage, "Investor");
      await nextQuestion(surveyPage);

      await answerShortText(surveyPage, "Catalyst Ventures");
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("How likely are you to mentor or advise");
      await surveyPage.getByTestId("survey-likert-4").click();
      await nextQuestion(surveyPage);

      await expect(surveyPage.getByTestId("survey-question-prompt")).toContainText("What else should StartupSD know");
      await answerLongText(surveyPage, "Investor feedback.");
      await nextQuestion(surveyPage);
      await expectSurveyComplete(surveyPage);
      await context.close();
    }
  });
});
