/**
 * Link health checks for visible links in the UI.
 *
 * These tests run in Chromium only because they are intended to be
 * driven by a DevTools-capable browser.
 */
import type { APIRequestContext, Page } from "playwright/test";
import { test, expect } from "../fixtures";

type LinkCandidate = {
  href: string;
  absolute: string;
  text: string;
  ariaLabel: string;
};

type LinkCheckResult = {
  url: string;
  status: number | "error";
  statusText: string;
  finalUrl?: string;
  error?: string;
  method?: "HEAD" | "GET";
};

const DEFAULT_ROUTES = ["/"];
const ROUTES = (process.env.E2E_LINK_CHECK_ROUTES ?? DEFAULT_ROUTES.join(","))
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean);

const CHECK_EXTERNAL = ["1", "true", "yes"].includes(
  (process.env.E2E_LINK_CHECK_EXTERNAL ?? "").toLowerCase(),
);
const parsedTimeout = Number(process.env.E2E_LINK_CHECK_TIMEOUT_MS ?? "15000");
const REQUEST_TIMEOUT_MS = Number.isFinite(parsedTimeout)
  ? parsedTimeout
  : 15000;
const parsedConcurrency = Number(
  process.env.E2E_LINK_CHECK_CONCURRENCY ?? "6",
);
const CONCURRENCY_LIMIT = Number.isFinite(parsedConcurrency)
  ? parsedConcurrency
  : 6;

const SKIP_PROTOCOLS = new Set([
  "mailto:",
  "tel:",
  "sms:",
  "javascript:",
  "data:",
  "blob:",
  "about:",
]);

function describeLink(link: LinkCandidate) {
  const label = link.ariaLabel || link.text;
  if (label) return `${label} (${link.absolute})`;
  return link.absolute;
}

async function collectVisibleLinks(page: Page): Promise<LinkCandidate[]> {
  return page.evaluate(() => {
    const unique = new Set<string>();
    const results: LinkCandidate[] = [];
    const anchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href]"),
    );

    for (const anchor of anchors) {
      const href = anchor.getAttribute("href")?.trim() ?? "";
      if (!href) continue;

      const style = window.getComputedStyle(anchor);
      const rect = anchor.getBoundingClientRect();
      const isVisible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0;

      if (!isVisible) continue;
      if (anchor.hasAttribute("disabled")) continue;
      if (anchor.getAttribute("aria-disabled") === "true") continue;

      let absolute: string;
      try {
        absolute = new URL(href, document.baseURI).toString();
      } catch {
        continue;
      }

      if (unique.has(absolute)) continue;
      unique.add(absolute);

      results.push({
        href,
        absolute,
        text: anchor.textContent?.trim() ?? "",
        ariaLabel: anchor.getAttribute("aria-label") ?? "",
      });
    }

    return results;
  });
}

async function checkUrl(
  request: APIRequestContext,
  url: string,
): Promise<LinkCheckResult> {
  const attempt = async (
    method: "HEAD" | "GET",
  ): Promise<LinkCheckResult> => {
    const response = await request.fetch(url, {
      method,
      timeout: REQUEST_TIMEOUT_MS,
      maxRedirects: 10,
    });

    return {
      url,
      status: response.status(),
      statusText: response.statusText(),
      finalUrl: response.url(),
      method,
    };
  };

  try {
    const head = await attempt("HEAD");
    if (head.status === 405 || head.status === 501) {
      return await attempt("GET");
    }
    return head;
  } catch (error) {
    return {
      url,
      status: "error",
      statusText: "request failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
) {
  const results: R[] = [];
  const queue = items.slice();
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        results.push(await worker(item));
      }
    },
  );
  await Promise.all(workers);
  return results;
}

test.describe("Visible link health", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Uses Chromium-only link checks.",
  );

  for (const route of ROUTES) {
    test(`no broken links on ${route}`, async ({ page, request }) => {
      await page.goto(route);

      const candidates = await collectVisibleLinks(page);
      const pageOrigin = new URL(page.url()).origin;

      const filtered = candidates.filter((candidate) => {
        let parsed: URL;
        try {
          parsed = new URL(candidate.absolute);
        } catch {
          return false;
        }

        if (SKIP_PROTOCOLS.has(parsed.protocol)) return false;
        if (!CHECK_EXTERNAL && parsed.origin !== pageOrigin) return false;

        return true;
      });

      const results = await mapWithConcurrency(
        filtered,
        CONCURRENCY_LIMIT,
        async (candidate) => ({
          candidate,
          result: await checkUrl(request, candidate.absolute),
        }),
      );

      const failures = results.filter(({ result }) => {
        if (result.status === "error") return true;
        return result.status >= 400;
      });

      if (failures.length > 0) {
        const message = failures
          .map(({ candidate, result }) => {
            if (result.status === "error") {
              return `${describeLink(candidate)} -> request error (${result.error ?? "unknown"})`;
            }
            return `${describeLink(candidate)} -> ${result.status} ${result.statusText}${result.method ? ` (${result.method})` : ""}`;
          })
          .join("\n");

        expect.fail(`Broken links detected:\n${message}`);
      }
    });
  }
});
