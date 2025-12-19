/**
 * Title Generator Utility
 *
 * Generates concise 2-5 word titles from content using BAML.
 * Used for auto-titling interviews and voice memos.
 */

import consola from "consola";
import { b } from "~/../baml_client";

const TIMESTAMP_TITLE_PATTERN = /^[A-Z][a-z]{2}-\d{1,2} \d{1,2}:\d{2}/;

export interface GenerateTitleOptions {
  maxLength?: number;
  fallback?: string;
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
  const { maxLength = 100, fallback = null } = options;

  if (!content || content.trim().length < 50) {
    consola.debug("[generateTitle] Content too short for title generation");
    return fallback;
  }

  try {
    // Truncate content to avoid token limits (keep first ~2000 chars)
    const truncated = content.slice(0, 2000);

    const title = await b.GenerateTitleFromContent(truncated);

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
