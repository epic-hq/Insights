/**
 * Title Generator Utility
 *
 * Generates concise 2-5 word titles from content using BAML.
 * Used for auto-titling interviews and voice memos.
 */

import consola from "consola";
import { b } from "~/../baml_client";
import type { BillingContext } from "~/lib/billing/instrumented-baml.server";
import { runBamlWithBilling } from "~/lib/billing/instrumented-baml.server";

const TIMESTAMP_TITLE_PATTERN = /^[A-Z][a-z]{2}-\d{1,2} \d{1,2}:\d{2}/;

export interface GenerateTitleOptions {
  maxLength?: number;
  fallback?: string;
  /** Optional billing context for usage tracking */
  billingCtx?: BillingContext;
  /** Resource ID for billing idempotency (e.g., interview ID) */
  resourceId?: string;
}

/**
 * Check if a title looks like an auto-generated timestamp title
 * e.g. "Dec-17 02:30pm"
 */
export function isTimestampTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  return TIMESTAMP_TITLE_PATTERN.test(title);
}

/**
 * Generate a descriptive title from content text.
 *
 * @param content - The content to generate a title from (transcript, notes, etc.)
 * @param options - Optional configuration
 * @returns The generated title, or null if generation fails
 */
export async function generateTitleFromContent(
  content: string | null | undefined,
  options: GenerateTitleOptions = {},
): Promise<string | null> {
  const { maxLength = 100, fallback = null, billingCtx, resourceId } = options;

  if (!content || content.trim().length < 50) {
    consola.debug("[generateTitle] Content too short for title generation");
    return fallback;
  }

  try {
    // Truncate content to avoid token limits (keep first ~2000 chars)
    const truncated = content.slice(0, 2000);

    let title: string;

    // Use billing-instrumented call if context is provided
    if (billingCtx) {
      const { result } = await runBamlWithBilling(
        billingCtx,
        {
          functionName: "GenerateTitleFromContent",
          traceName: "generate-title",
          input: { contentLength: truncated.length },
          metadata: { resourceId },
          resourceType: "interview",
          resourceId: resourceId || "unknown",
          bamlCall: (client) => client.GenerateTitleFromContent(truncated),
        },
        resourceId ? `title:${resourceId}` : `title:${Date.now()}`,
      );
      title = result;
    } else {
      // Fallback to direct call when no billing context
      title = await b.GenerateTitleFromContent(truncated);
    }

    if (!title || title.toLowerCase() === "untitled") {
      consola.debug("[generateTitle] BAML returned empty/untitled");
      return fallback;
    }

    // Clean up and truncate title
    const cleaned = title
      .replace(/^["']|["']$/g, "") // Remove quotes
      .replace(/[.!?]+$/, "") // Remove trailing punctuation
      .trim();

    if (cleaned.length === 0) {
      return fallback;
    }

    return cleaned.slice(0, maxLength);
  } catch (error) {
    consola.warn("[generateTitle] Title generation failed:", error);
    return fallback;
  }
}
