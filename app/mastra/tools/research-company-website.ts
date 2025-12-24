/**
 * Company website research tool
 * Researches a company website using Exa.ai and extracts structured data using LLM
 * Shared between API endpoints and Mastra agents
 */
import { openai } from "@ai-sdk/openai"
import { createTool } from "@mastra/core/tools"
import { generateObject } from "ai"
import consola from "consola"
import { z } from "zod"

const EXA_API_URL = "https://api.exa.ai"

/**
 * Schema for LLM extraction output
 */
const CompanyExtractionSchema = z.object({
	description: z.string().optional().describe("A 1-2 sentence description of what the company does"),
	customer_problem: z.string().optional().describe("The main problem or pain point the company solves for customers"),
	offerings: z
		.array(z.string())
		.optional()
		.describe("List of main products or services offered (2-5 items, be specific)"),
	target_customers: z
		.array(z.string())
		.optional()
		.describe(
			"Types of companies or people they serve (e.g., 'Enterprise software companies', 'Healthcare providers')"
		),
	industry: z
		.string()
		.optional()
		.describe("The industry or sector (e.g., 'Healthcare Technology', 'B2B SaaS', 'Fintech')"),
})

interface ExaSearchResult {
	title: string
	url: string
	text?: string
	highlights?: string[]
}

interface ExaSearchResponse {
	results: ExaSearchResult[]
}

/**
 * Normalizes a URL by adding https:// if no protocol is present
 */
export function normalizeUrl(input: string): string {
	const trimmed = input.trim()
	if (!trimmed) return ""
	if (/^https?:\/\//i.test(trimmed)) {
		return trimmed
	}
	return `https://${trimmed}`
}

/**
 * Extract domain from URL for search queries
 */
export function extractDomain(url: string): string {
	try {
		const parsed = new URL(normalizeUrl(url))
		return parsed.hostname.replace("www.", "")
	} catch {
		return url.replace(/^(https?:\/\/)?(www\.)?/, "").split("/")[0]
	}
}

/**
 * Result shape for company research
 */
export interface CompanyResearchResult {
	success: boolean
	error?: string
	data?: {
		customer_problem?: string
		offerings?: string[]
		competitors?: string[]
		target_orgs?: string[]
		description?: string
		industry?: string
	}
}

/**
 * Core research function - can be called directly or through the tool
 */
export async function researchCompanyWebsite(websiteUrl: string): Promise<CompanyResearchResult> {
	if (!websiteUrl?.trim()) {
		return { success: false, error: "Website URL is required" }
	}

	const apiKey = process.env.EXA_API_KEY
	if (!apiKey) {
		consola.error("[research-company-website] EXA_API_KEY not configured")
		return { success: false, error: "Web research is not configured" }
	}

	const normalizedUrl = normalizeUrl(websiteUrl)
	const domain = extractDomain(normalizedUrl)

	consola.info("[research-company-website] Researching:", domain)

	try {
		const response = await fetch(`${EXA_API_URL}/search`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": apiKey,
			},
			body: JSON.stringify({
				query: `${domain} company about products services what they do`,
				numResults: 5,
				type: "auto",
				useAutoprompt: true,
				contents: {
					text: { maxCharacters: 2000 },
					highlights: { numSentences: 5 },
				},
				category: "company",
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			consola.error("[research-company-website] Exa API error:", response.status, errorText)
			return {
				success: false,
				error: "Failed to research company. Please try again.",
			}
		}

		const data = (await response.json()) as ExaSearchResponse
		const results = data.results || []

		if (results.length === 0) {
			return {
				success: false,
				error: "No information found for this website. Try a different URL.",
			}
		}

		// Combine text from results
		const combinedText = results
			.map((r) => `${r.title}\n${r.highlights?.join(" ") || r.text || ""}`)
			.join("\n\n---\n\n")

		// Extract structured data using LLM
		const extractedData = await extractCompanyInfoWithLLM(combinedText, domain)

		consola.info("[research-company-website] Extracted data for:", domain, {
			hasCustomerProblem: !!extractedData.customer_problem,
			offeringsCount: extractedData.offerings?.length || 0,
			industry: extractedData.industry,
		})

		return {
			success: true,
			data: {
				...extractedData,
				// Map target_customers to target_orgs for backwards compatibility
				target_orgs: extractedData.target_customers,
			},
		}
	} catch (error) {
		consola.error("[research-company-website] Error:", error)
		return {
			success: false,
			error: "An error occurred during research. Please try again.",
		}
	}
}

/**
 * Extract company information from research text using LLM
 * Returns structured data for project setup fields
 */
async function extractCompanyInfoWithLLM(
	text: string,
	domain: string
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
		})

		return object
	} catch (error) {
		consola.error("[research-company-website] LLM extraction failed:", error)
		// Return empty object on failure
		return {}
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
		website_url: z.string().describe("The company website URL to research (can be with or without https://)"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		error: z.string().optional(),
		data: z
			.object({
				customer_problem: z.string().optional(),
				offerings: z.array(z.string()).optional(),
				competitors: z.array(z.string()).optional(),
				target_orgs: z.array(z.string()).optional(),
				description: z.string().optional(),
				industry: z.string().optional(),
			})
			.optional(),
	}),
	execute: async (input) => {
		return researchCompanyWebsite(input.website_url)
	},
})
