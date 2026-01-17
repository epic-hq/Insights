/**
 * Organization Research Tool
 *
 * Researches a company using Exa's company search mode and:
 * 1. Updates the organization record with extracted data (size, industry, etc.)
 * 2. Creates an annotation linked to the organization with research findings
 * 3. Creates evidence records for semantic search
 */
import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import {
  generateEmbeddingWithBilling,
  systemBillingContext,
} from "~/lib/billing";
import { supabaseAdmin } from "~/lib/supabase/client.server";

const EXA_API_URL = "https://api.exa.ai";

interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  author?: string;
  score: number;
  text?: string;
  highlights?: string[];
}

interface ExaSearchResponse {
  results: ExaSearchResult[];
  autopromptString?: string;
}

// Standard company size ranges
const SIZE_RANGES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10000+",
] as const;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract structured company data from research text using pattern matching
 */
function extractCompanyData(text: string): {
  size_range: string | null;
  industry: string | null;
  headquarters_location: string | null;
  employee_count: number | null;
  founded_year: number | null;
  description: string | null;
} {
  const result = {
    size_range: null as string | null,
    industry: null as string | null,
    headquarters_location: null as string | null,
    employee_count: null as number | null,
    founded_year: null as number | null,
    description: null as string | null,
  };

  const lowerText = text.toLowerCase();

  // Extract employee count and map to size range
  const employeePatterns = [
    /(\d{1,3}(?:,\d{3})*)\s*(?:\+\s*)?employees?/i,
    /(?:team of|staff of|workforce of)\s*(\d{1,3}(?:,\d{3})*)/i,
    /(\d{1,3}(?:,\d{3})*)\s*(?:\+\s*)?(?:team members|people|workers)/i,
  ];

  for (const pattern of employeePatterns) {
    const match = text.match(pattern);
    if (match) {
      const count = Number.parseInt(match[1].replace(/,/g, ""), 10);
      result.employee_count = count;
      // Map to size range
      if (count <= 10) result.size_range = "1-10";
      else if (count <= 50) result.size_range = "11-50";
      else if (count <= 200) result.size_range = "51-200";
      else if (count <= 500) result.size_range = "201-500";
      else if (count <= 1000) result.size_range = "501-1000";
      else if (count <= 5000) result.size_range = "1001-5000";
      else if (count <= 10000) result.size_range = "5001-10000";
      else result.size_range = "10000+";
      break;
    }
  }

  // Extract industry
  const industryPatterns = [
    /(?:industry|sector|vertical):\s*([^.\n,]+)/i,
    /(?:operates in|works in|specializes in)\s+(?:the\s+)?([^.\n,]+?)\s+(?:industry|sector|space|market)/i,
    /(?:is a|is an)\s+([^.\n,]+?)\s+(?:company|firm|business|startup)/i,
  ];

  for (const pattern of industryPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.industry = match[1].trim();
      break;
    }
  }

  // Common industry keywords
  const industryKeywords: Record<string, string> = {
    saas: "SaaS / Software",
    software: "Software",
    fintech: "Fintech",
    healthcare: "Healthcare",
    healthtech: "Healthcare Technology",
    edtech: "Education Technology",
    ecommerce: "E-commerce",
    "e-commerce": "E-commerce",
    retail: "Retail",
    manufacturing: "Manufacturing",
    logistics: "Logistics",
    "real estate": "Real Estate",
    proptech: "Real Estate Technology",
    insurtech: "Insurance Technology",
    cybersecurity: "Cybersecurity",
    "artificial intelligence": "AI / Machine Learning",
    "machine learning": "AI / Machine Learning",
    biotech: "Biotechnology",
    cleantech: "Clean Technology",
    agtech: "Agriculture Technology",
    martech: "Marketing Technology",
    hrtech: "HR Technology",
    legaltech: "Legal Technology",
  };

  if (!result.industry) {
    for (const [keyword, industry] of Object.entries(industryKeywords)) {
      if (lowerText.includes(keyword)) {
        result.industry = industry;
        break;
      }
    }
  }

  // Extract headquarters location
  const hqPatterns = [
    /(?:headquarters?|hq|based)\s+(?:in|at)\s+([^.\n,]+(?:,\s*[A-Z]{2})?)/i,
    /(?:located|headquartered)\s+in\s+([^.\n,]+(?:,\s*[A-Z]{2})?)/i,
  ];

  for (const pattern of hqPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.headquarters_location = match[1].trim();
      break;
    }
  }

  // Extract founded year
  const foundedPatterns = [
    /(?:founded|established|started)\s+(?:in\s+)?(\d{4})/i,
    /since\s+(\d{4})/i,
  ];

  for (const pattern of foundedPatterns) {
    const match = text.match(pattern);
    if (match) {
      const year = Number.parseInt(match[1], 10);
      if (year >= 1900 && year <= new Date().getFullYear()) {
        result.founded_year = year;
        break;
      }
    }
  }

  // Extract first sentence as potential description
  const firstSentenceMatch = text.match(/^([^.!?]+[.!?])/);
  if (
    firstSentenceMatch &&
    firstSentenceMatch[1].length > 20 &&
    firstSentenceMatch[1].length < 300
  ) {
    result.description = firstSentenceMatch[1].trim();
  }

  return result;
}

export const researchOrganizationTool = createTool({
  id: "research-organization",
  description: `Research a company/organization using Exa's company search. This tool:
1. Searches for company information (overview, size, industry, leadership, news)
2. Updates the organization record with extracted data (size_range, industry, headquarters)
3. Creates an annotation linked to the organization with full research findings
4. Creates evidence records for semantic search

Use this when:
- User asks to "research [company name]"
- User wants to enrich organization data
- User asks "what do we know about [company]" and internal search has no results`,
  inputSchema: z.object({
    organizationId: z
      .string()
      .optional()
      .describe(
        "Organization ID to update. If not provided, will search by name.",
      ),
    organizationName: z
      .string()
      .describe("Name of the organization to research"),
    additionalQueries: z
      .array(z.string())
      .optional()
      .describe(
        "Additional search queries (e.g., 'recent funding', 'leadership changes')",
      ),
    createIfNotFound: z
      .boolean()
      .optional()
      .default(true)
      .describe("Create the organization if it doesn't exist (default: true)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    organizationId: z.string().optional(),
    wasCreated: z.boolean().optional(),
    extractedData: z
      .object({
        size_range: z.string().nullable(),
        industry: z.string().nullable(),
        headquarters_location: z.string().nullable(),
        employee_count: z.number().nullable(),
      })
      .optional(),
    annotationId: z.string().optional(),
    evidenceCount: z.number().optional(),
    sources: z
      .array(z.object({ title: z.string(), url: z.string() }))
      .optional(),
  }),
  execute: async (input, context?) => {
    const apiKey = process.env.EXA_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        message:
          "Organization research is not configured (EXA_API_KEY missing).",
      };
    }

    const projectId = context?.requestContext?.get?.("project_id");
    const accountId = context?.requestContext?.get?.("account_id");

    if (!projectId || !accountId) {
      return {
        success: false,
        message: "Missing project context. Cannot save research results.",
      };
    }

    const {
      organizationId,
      organizationName,
      additionalQueries,
      createIfNotFound = true,
    } = input;

    try {
      // Find or verify the organization
      let orgId = organizationId;
      let orgRecord: { id: string; name: string } | null = null;

      if (orgId) {
        const { data } = await supabaseAdmin
          .from("organizations")
          .select("id, name")
          .eq("id", orgId)
          .eq("project_id", projectId)
          .single();
        orgRecord = data;
      } else {
        // Search by name
        const { data } = await supabaseAdmin
          .from("organizations")
          .select("id, name")
          .eq("project_id", projectId)
          .ilike("name", `%${organizationName}%`)
          .limit(1)
          .single();
        orgRecord = data;
        orgId = data?.id;
      }

      consola.info("[research-organization] Starting research", {
        organizationName,
        organizationId: orgId,
        found: !!orgRecord,
      });

      // Build search query - use Exa's company category
      const mainQuery = `${organizationName} company overview, leadership, product, market, recent news, funding, website, LinkedIn`;

      // Retry logic for rate limits
      let response: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await delay(1000 * (attempt + 1));
        }

        response = await fetch(`${EXA_API_URL}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({
            query: mainQuery,
            numResults: 5,
            type: "auto",
            useAutoprompt: true,
            category: "company", // Use Exa's company category for better results
            contents: {
              text: { maxCharacters: 2000 },
              highlights: { numSentences: 5 },
            },
          }),
        });

        if (response.ok) break;
        if (response.status !== 429) break;
      }

      if (!response || !response.ok) {
        return {
          success: false,
          message:
            "Failed to search for company information (API error or rate limit).",
        };
      }

      const data = (await response.json()) as ExaSearchResponse;
      const resultCount = data.results?.length || 0;

      if (resultCount === 0) {
        return {
          success: false,
          message: `No information found for "${organizationName}". Try a different name or spelling.`,
        };
      }

      consola.info("[research-organization] Found results", {
        count: resultCount,
      });

      // Combine all text for extraction
      const allText = data.results
        .map(
          (r) =>
            `${r.title}\n${r.text || ""}\n${r.highlights?.join(" ") || ""}`,
        )
        .join("\n\n");

      // Extract structured data
      const extracted = extractCompanyData(allText);

      // Format results for annotation
      const sources = data.results.map((r) => ({
        title: r.title || "Untitled",
        url: r.url,
      }));

      const markdownContent = formatResearchAsAnnotation(
        organizationName,
        data.results,
        extracted,
      );

      // Create organization if not found and createIfNotFound is true
      let wasCreated = false;
      if (!orgId && createIfNotFound) {
        const insertData: Record<string, string | null> = {
          account_id: accountId,
          project_id: projectId,
          name: organizationName,
        };
        if (extracted.size_range) insertData.size_range = extracted.size_range;
        if (extracted.industry) insertData.industry = extracted.industry;
        if (extracted.headquarters_location)
          insertData.headquarters_location = extracted.headquarters_location;
        if (extracted.description)
          insertData.description = extracted.description;

        const { data: newOrg, error: insertError } = await supabaseAdmin
          .from("organizations")
          .insert(insertData)
          .select("id")
          .single();

        if (insertError) {
          consola.error(
            "[research-organization] Failed to create org:",
            insertError,
          );
        } else if (newOrg) {
          orgId = newOrg.id;
          wasCreated = true;
          consola.info("[research-organization] Created organization:", {
            id: orgId,
            name: organizationName,
          });
        }
      }

      // Update organization if it exists and wasn't just created
      if (orgId && !wasCreated) {
        const updateData: Record<string, string | null> = {};
        if (extracted.size_range) updateData.size_range = extracted.size_range;
        if (extracted.industry) updateData.industry = extracted.industry;
        if (extracted.headquarters_location)
          updateData.headquarters_location = extracted.headquarters_location;
        if (extracted.description)
          updateData.description = extracted.description;

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabaseAdmin
            .from("organizations")
            .update(updateData)
            .eq("id", orgId)
            .eq("project_id", projectId);

          if (updateError) {
            consola.error(
              "[research-organization] Failed to update org:",
              updateError,
            );
          } else {
            consola.info(
              "[research-organization] Updated organization:",
              updateData,
            );
          }
        }
      }

      // Create annotation linked to organization
      let annotationId: string | undefined;

      if (orgId) {
        const { data: annotation, error: annotationError } = await supabaseAdmin
          .from("annotations")
          .insert({
            account_id: accountId,
            project_id: projectId,
            entity_type: "organization",
            entity_id: orgId,
            annotation_type: "note",
            content: markdownContent,
            content_jsonb: {
              research_type: "company_profile",
              extracted_data: extracted,
              sources: sources,
              search_date: new Date().toISOString(),
            },
            metadata: {
              source: "exa_research",
              query: mainQuery,
            },
            created_by_ai: true,
            status: "active",
          })
          .select("id")
          .single();

        if (annotationError) {
          consola.error(
            "[research-organization] Failed to create annotation:",
            annotationError,
          );
        } else {
          annotationId = annotation?.id;
          consola.info(
            "[research-organization] Created annotation:",
            annotationId,
          );
        }
      }

      // Create evidence records for semantic search
      let evidenceCount = 0;
      const billingCtx = systemBillingContext(
        accountId,
        "embedding_generation",
        projectId,
      );

      for (const result of data.results) {
        try {
          const textToEmbed = `${result.title}: ${result.highlights?.join(" ") || result.text?.slice(0, 500) || ""}`;
          const embedding = await generateEmbeddingWithBilling(
            billingCtx,
            textToEmbed,
            {
              idempotencyKey: `org-research:${orgId || organizationName}:${result.url}`,
              resourceType: "evidence",
            },
          );

          const { error: evidenceError } = await supabaseAdmin
            .from("evidence")
            .insert({
              account_id: accountId,
              project_id: projectId,
              verbatim:
                result.highlights?.join(" ") ||
                result.text?.slice(0, 500) ||
                result.title,
              gist: `${organizationName}: ${result.title}`,
              citation: result.url,
              method: "market_report",
              source_type: "secondary",
              modality: "qual",
              confidence: "medium",
              context_summary: `Company research for ${organizationName}`,
              ...(embedding && {
                embedding: embedding,
                embedding_model: "text-embedding-3-small",
                embedding_generated_at: new Date().toISOString(),
              }),
            });

          if (!evidenceError) evidenceCount++;
        } catch (err) {
          consola.error(
            "[research-organization] Error creating evidence:",
            err,
          );
        }
      }

      consola.success("[research-organization] Complete", {
        organizationId: orgId,
        wasCreated,
        annotationId,
        evidenceCount,
        extracted,
      });

      const fieldCount = Object.keys(extracted).filter(
        (k) => extracted[k as keyof typeof extracted],
      ).length;

      let message: string;
      if (wasCreated) {
        message = `Created organization "${organizationName}" with ${fieldCount} extracted fields (${extracted.industry || "unknown industry"}, ${extracted.size_range || "unknown size"}).`;
      } else if (orgId) {
        message = `Updated organization "${organizationName}" with ${fieldCount} fields.`;
      } else {
        message = `Researched "${organizationName}" but could not create organization. Created ${evidenceCount} evidence records.`;
      }

      return {
        success: true,
        message,
        organizationId: orgId,
        wasCreated,
        extractedData: {
          size_range: extracted.size_range,
          industry: extracted.industry,
          headquarters_location: extracted.headquarters_location,
          employee_count: extracted.employee_count,
        },
        annotationId,
        evidenceCount,
        sources,
      };
    } catch (error) {
      consola.error("[research-organization] Error:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to research organization.",
      };
    }
  },
});

function formatResearchAsAnnotation(
  companyName: string,
  results: ExaSearchResult[],
  extracted: ReturnType<typeof extractCompanyData>,
): string {
  const lines: string[] = [
    `# Company Research: ${companyName}`,
    "",
    `**Researched:** ${new Date().toLocaleDateString()}`,
    "",
  ];

  // Add extracted data summary
  const extractedFields: string[] = [];
  if (extracted.industry)
    extractedFields.push(`**Industry:** ${extracted.industry}`);
  if (extracted.size_range)
    extractedFields.push(`**Company Size:** ${extracted.size_range}`);
  if (extracted.employee_count)
    extractedFields.push(
      `**Employees:** ~${extracted.employee_count.toLocaleString()}`,
    );
  if (extracted.headquarters_location)
    extractedFields.push(
      `**Headquarters:** ${extracted.headquarters_location}`,
    );
  if (extracted.founded_year)
    extractedFields.push(`**Founded:** ${extracted.founded_year}`);

  if (extractedFields.length > 0) {
    lines.push("## Key Facts", "", ...extractedFields, "");
  }

  if (extracted.description) {
    lines.push("## Overview", "", extracted.description, "");
  }

  lines.push("## Sources", "");

  for (const result of results) {
    lines.push(`### [${result.title}](${result.url})`);
    if (result.highlights && result.highlights.length > 0) {
      lines.push("", result.highlights.join(" "), "");
    } else if (result.text) {
      lines.push("", result.text.slice(0, 500) + "...", "");
    }
    lines.push("");
  }

  return lines.join("\n");
}
