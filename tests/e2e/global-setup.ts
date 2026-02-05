import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { STORAGE_STATE_PATH } from "./fixtures/storage-state";

export default async function globalSetup() {
  const testEmail = process.env.E2E_TEST_EMAIL;
  const testPassword = process.env.E2E_TEST_PASSWORD;

  if (!testEmail || !testPassword) return;

  try {
    await fs.access(STORAGE_STATE_PATH);
    return;
  } catch {
    // Continue to create storage state via login.
  }

  await fs.mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const baseURL = process.env.E2E_BASE_URL || "http://localhost:4280";
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseURL}/login`);
  await page.fill('input[name="email"]', testEmail);
  await page.fill('input[name="password"]', testPassword);
  await page.click('button[type="submit"]:has-text("Login")');
  await page.waitForURL(/\/(projects|login_success|onboarding|a\/)/, {
    timeout: 15000,
  });

  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
