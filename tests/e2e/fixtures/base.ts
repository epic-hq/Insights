/**
 * Base test fixtures for E2E tests.
 *
 * Extends Playwright's base test with custom fixtures for:
 * - PostHog event tracking validation
 * - Authenticated user sessions
 * - Common page objects
 */
import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  test as base,
  type ConsoleMessage,
  type Page,
  type Request,
} from "playwright/test";

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

function formatLogLine(message: string) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] ${message}\n`;
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

/** Extended test with PostHog tracking + artifact capture */
export const test = base.extend<{ posthog: PostHogFixture }>({
  context: async ({ browser }, use, testInfo) => {
    const projectUse = testInfo.project.use as Record<string, unknown>;
    const {
      baseURL: _baseURL,
      trace: _trace,
      screenshot: _screenshot,
      video: _video,
      launchOptions: _launchOptions,
      ...contextOptions
    } = projectUse;

    const context = await browser.newContext({
      ...(contextOptions as Parameters<typeof browser.newContext>[0]),
      recordHar: {
        path: testInfo.outputPath("network.har"),
        mode: "minimal",
      },
    });

    await use(context);
    await context.close();
  },
  page: async ({ context }, use, testInfo) => {
    const page = await context.newPage();
    const logPath = testInfo.outputPath("console.log");
    const logStream = createWriteStream(logPath, { flags: "a" });

    logStream.write(
      formatLogLine(
        `Test started: ${testInfo.titlePath.join(" > ")} (${testInfo.project.name})`,
      ),
    );

    const onConsole = (msg: ConsoleMessage) => {
      const location = msg.location();
      const locationText = location.url
        ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
        : "unknown";
      logStream.write(
        formatLogLine(
          `[console.${msg.type()}] ${msg.text()} (${locationText})`,
        ),
      );
    };

    const onPageError = (error: Error) => {
      logStream.write(
        formatLogLine(`[pageerror] ${error.stack ?? error.message}`),
      );
    };

    const onRequestFailed = (request: Request) => {
      const failure = request.failure();
      logStream.write(
        formatLogLine(
          `[requestfailed] ${request.method()} ${request.url()} ${failure?.errorText ?? ""}`,
        ),
      );
    };

    page.on("console", onConsole);
    page.on("pageerror", onPageError);
    page.on("requestfailed", onRequestFailed);

    try {
      await use(page);
    } finally {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      logStream.write(formatLogLine("Test finished."));
      logStream.end();
    }
  },
  posthog: async ({ page }, use) => {
    const fixture = await setupPostHogCapture(page);
    await use(fixture);
  },
});

test.afterEach(async ({}, testInfo) => {
  const bugId = process.env.BUG_ID;
  if (!bugId) return;

  const failed = testInfo.status !== testInfo.expectedStatus;
  if (!failed) return;

  const testSlug = sanitizeFileName(
    `${testInfo.project.name}-${testInfo.titlePath.join(" ")}`,
  );
  const bundleDir = path.join(
    process.cwd(),
    "artifacts",
    `bug-${bugId}`,
    testSlug,
  );

  await fs.mkdir(bundleDir, { recursive: true });
  await fs.cp(testInfo.outputDir, bundleDir, { recursive: true });

  const repro = [
    `# Bug Bundle ${bugId}`,
    "",
    `- Test: ${testInfo.titlePath.join(" > ")}`,
    `- Project: ${testInfo.project.name}`,
    `- Status: ${testInfo.status}`,
    `- Expected: ${testInfo.expectedStatus}`,
    `- Output Dir: ${testInfo.outputDir}`,
    `- Timestamp: ${new Date().toISOString()}`,
  ].join("\n");

  await fs.writeFile(path.join(bundleDir, "repro.md"), repro, "utf8");
});

export { expect } from "playwright/test";
