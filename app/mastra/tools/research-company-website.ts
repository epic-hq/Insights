/**
 * Company website research tool
 * Researches a company website using Exa.ai and extracts structured data using LLM
 * Shared between API endpoints and Mastra agents
 */
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import { generateObject } from "ai";
import consola from "consola";
import { z } from "zod";

const EXA_API_URL = "https://api.exa.ai";

/**
 * Schema for LLM extraction output
 */
const CompanyExtractionSchema = z.object({
  description: z
    .string()
    .optional()
    .describe("A 1-2 sentence description of what the company does"),
  customer_problem: z
    .string()
    .optional()
    .describe(
      "The main problem or pain point the company solves for customers",
    ),
  offerings: z
    .array(z.string())
    .optional()
    .describe(
      "List of main products or services offered (2-5 items, be specific)",
    ),
  target_customers: z
    .array(z.string())
    .optional()
    .describe(
      "Types of companies or people they serve (e.g., 'Enterprise software companies', 'Healthcare providers')",
    ),
  industry: z
    .string()
    .optional()
    .describe(
      "The industry or sector (e.g., 'Healthcare Technology', 'B2B SaaS', 'Fintech')",
    ),
});

interface ExaSearchResult {
  title: string;
  url: string;
  text?: string;
  highlights?: string[];
}

interface ExaSearchResponse {
  results: ExaSearchResult[];
}

/**
 * Normalizes a URL by adding https:// if no protocol is present
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Extract domain from URL for search queries
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(normalizeUrl(url));
    return parsed.hostname.replace("www.", "");
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0];
  }
}

/**
 * Result shape for company research
 */
export interface CompanyResearchResult {
  success: boolean;
  error?: string;
  data?: {
    customer_problem?: string;
    offerings?: string[];
    competitors?: string[];
    target_orgs?: string[];
    description?: string;
    industry?: string;
  };
}

/**
 * Directly fetch and extract content from a URL
 */
async function fetchWebsiteContent(url: string): Promise<string | null> {
  try {
    consola.info("[research-company-website] Fetching website directly:", url);
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; InsightsBot/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      consola.warn(
        "[research-company-website] Direct fetch failed:",
        response.status,
      );
      return null;
    }

    const html = await response.text();

    // Basic HTML text extraction - strip tags and clean up
    const textContent = html
      // Remove scripts and styles
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Remove HTML tags
      .replace(/<[^>]+>/g, " ")
      // Decode entities
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      // Clean up whitespace
      .replace(/\s+/g, " ")
      .trim();

    return textContent.slice(0, 8000); // Limit content size
  } catch (error) {
    consola.warn("[research-company-website] Direct fetch error:", error);
    return null;
  }
}

/**
 * Check if search results are relevant to the target domain
 */
function resultsMatchDomain(
  results: ExaSearchResult[],
  targetDomain: string,
): boolean {
  if (results.length === 0) return false;

  // Check if at least one result URL contains the target domain
  const targetLower = targetDomain.toLowerCase();
  return results.some((r) => {
    try {
      const resultDomain = new URL(r.url).hostname.toLowerCase();
      return (
        resultDomain.includes(targetLower) ||
        targetLower.includes(resultDomain.replace("www.", ""))
      );
    } catch {
      return r.url.toLowerCase().includes(targetLower);
    }
  });
}

/**
 * Core research function - can be called directly or through the tool
 */
export async function researchCompanyWebsite(
  websiteUrl: string,
): Promise<CompanyResearchResult> {
  if (!websiteUrl?.trim()) {
    return { success: false, error: "Website URL is required" };
  }

  const normalizedUrl = normalizeUrl(websiteUrl);
  const domain = extractDomain(normalizedUrl);

  consola.info("[research-company-website] Researching:", domain);

  const apiKey = process.env.EXA_API_KEY;

  // Try Exa.ai search first if API key is available
  if (apiKey) {
    try {
      // Use more precise search - search for exact URL first
      const response = await fetch(`${EXA_API_URL}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          query: normalizedUrl,
          numResults: 3,
          type: "auto",
          useAutoprompt: false,
          includeDomains: [domain],
          contents: {
            text: { maxCharacters: 3000 },
            highlights: { numSentences: 5 },
          },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as ExaSearchResponse;
        const results = data.results || [];

        // Only use results if they match the target domain
        if (results.length > 0 && resultsMatchDomain(results, domain)) {
          const combinedText = results
            .map(
              (r) => `${r.title}\n${r.highlights?.join(" ") || r.text || ""}`,
            )
            .join("\n\n---\n\n");

          const extractedData = await extractCompanyInfoWithLLM(
            combinedText,
            domain,
          );

          // Check if we got useful data
          const hasUsefulData =
            extractedData.description ||
            extractedData.customer_problem ||
            (extractedData.offerings && extractedData.offerings.length > 0);

          if (hasUsefulData) {
            consola.info(
              "[research-company-website] Exa returned valid data for:",
              domain,
            );
            return {
              success: true,
              data: {
                ...extractedData,
                target_orgs: extractedData.target_customers,
              },
            };
          }
        }

        consola.info(
          "[research-company-website] Exa results not relevant, falling back to direct fetch",
        );
      }
    } catch (error) {
      consola.warn(
        "[research-company-website] Exa search failed, falling back to direct fetch:",
        error,
      );
    }
  }

  // Fallback: directly fetch the user's URL
  const directContent = await fetchWebsiteContent(normalizedUrl);

  if (!directContent || directContent.length < 100) {
    return {
      success: false,
      error:
        "Could not retrieve information from this website. Please check the URL and try again.",
    };
  }

  // Extract structured data from direct fetch content
  const extractedData = await extractCompanyInfoWithLLM(directContent, domain);

  const hasUsefulData =
    extractedData.description ||
    extractedData.customer_problem ||
    (extractedData.offerings && extractedData.offerings.length > 0);

  if (!hasUsefulData) {
    return {
      success: false,
      error:
        "Could not extract useful information from this website. Try entering details manually.",
    };
  }

  consola.info(
    "[research-company-website] Extracted data from direct fetch for:",
    domain,
    {
      hasCustomerProblem: !!extractedData.customer_problem,
      offeringsCount: extractedData.offerings?.length || 0,
      industry: extractedData.industry,
    },
  );

  return {
    success: true,
    data: {
      ...extractedData,
      target_orgs: extractedData.target_customers,
    },
  };
}

/**
 * Extract company information from research text using LLM
 * Returns structured data for project setup fields
 */
async function extractCompanyInfoWithLLM(
  text: string,
  domain: string,
): Promise<z.infer<typeof CompanyExtractionSchema>> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: CompanyExtractionSchema,
      prompt: `You are analyzing web research about a company (${domain}). Extract key business information.

RESEARCH TEXT:
${text.slice(0, 4000)}

INSTRUCTIONS:
- Extract factual information only - don't make things up
- Be specific and concise
- For offerings: list actual products/services, not vague descriptions
- For customer_problem: describe the pain point they solve in one sentence
- For target_customers: list specific customer segments (e.g., "B2B SaaS companies", "Healthcare providers")
- If information isn't clearly available, omit that field
- Keep descriptions to 1-2 sentences max`,
    });

    return object;
  } catch (error) {
    consola.error("[research-company-website] LLM extraction failed:", error);
    // Return empty object on failure
    return {};
  }
}

/**
 * Mastra tool for researching company websites
 * Use this when a user provides a company website URL and you want to
 * auto-fill project setup fields or organization details
 */
export const researchCompanyWebsiteTool = createTool({
  id: "research-company-website",
  description:
    "Research a company website using Exa.ai to extract company information. Use this when users provide a website URL during project setup or when enriching organization data. Returns structured data including offerings, customer problems, target industries, and company description.",
  inputSchema: z.object({
    website_url: z
      .string()
      .describe(
        "The company website URL to research (can be with or without https://)",
      ),
  }),
  execute: async ({ website_url }) => {
    return researchCompanyWebsite(website_url);
  },
});
