import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"

const EXA_API_URL = "https://api.exa.ai"

interface ExaSearchResult {
	title: string
	url: string
	publishedDate?: string
	author?: string
	score: number
	text?: string
	highlights?: string[]
}

interface ExaSearchResponse {
	results: ExaSearchResult[]
	autopromptString?: string
}

/**
 * Web research tool using Exa.ai semantic search API.
 * Use this when users ask for web research, market research, competitor analysis,
 * or any external information gathering.
 */
export const webResearchTool = createTool({
	id: "web-research",
	description:
		"Search the web using Exa.ai semantic search. Use for market research, competitor analysis, industry trends, company information, or any external research needs. Returns relevant web pages with summaries.",
	inputSchema: z.object({
		query: z.string().describe("Natural language search query - be specific and descriptive"),
		numResults: z.number().min(1).max(10).default(5).describe("Number of results to return (1-10)"),
		type: z
			.enum(["neural", "keyword", "auto"])
			.default("auto")
			.describe("Search type: neural (semantic), keyword (traditional), or auto"),
		useAutoprompt: z
			.boolean()
			.default(true)
			.describe("Let Exa optimize the query for better results"),
		includeText: z
			.boolean()
			.default(true)
			.describe("Include text snippets from pages"),
		category: z
			.enum(["company", "research paper", "news", "pdf", "github", "tweet", "personal site", "linkedin profile"])
			.optional()
			.describe("Filter to specific content category"),
	}),
	outputSchema: z.object({
		results: z.array(
			z.object({
				title: z.string(),
				url: z.string(),
				publishedDate: z.string().optional(),
				author: z.string().optional(),
				summary: z.string(),
				relevanceScore: z.number(),
			})
		),
		optimizedQuery: z.string().optional(),
		error: z.string().optional(),
	}),
	execute: async ({ context }) => {
		const apiKey = process.env.EXA_API_KEY
		if (!apiKey) {
			return {
				results: [],
				error: "EXA_API_KEY not configured",
			}
		}

		try {
			const { query, numResults, type, useAutoprompt, includeText, category } = context

			const requestBody: Record<string, unknown> = {
				query,
				numResults,
				type,
				useAutoprompt,
				contents: includeText
					? {
							text: { maxCharacters: 1000 },
							highlights: { numSentences: 3 },
						}
					: undefined,
			}

			if (category) {
				requestBody.category = category
			}

			consola.info("[web-research] Searching Exa:", { query, numResults, type })

			const response = await fetch(`${EXA_API_URL}/search`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
				},
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				const errorText = await response.text()
				consola.error("[web-research] Exa API error:", response.status, errorText)
				return {
					results: [],
					error: `Exa API error: ${response.status} - ${errorText}`,
				}
			}

			const data = (await response.json()) as ExaSearchResponse

			consola.info("[web-research] Found results:", data.results?.length || 0)

			const results = (data.results || []).map((result) => ({
				title: result.title || "Untitled",
				url: result.url,
				publishedDate: result.publishedDate,
				author: result.author,
				summary:
					result.highlights?.join(" ") ||
					result.text?.slice(0, 500) ||
					"No summary available",
				relevanceScore: result.score,
			}))

			return {
				results,
				optimizedQuery: data.autopromptString,
			}
		} catch (error) {
			consola.error("[web-research] Error:", error)
			return {
				results: [],
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})

/**
 * Find similar pages to a given URL using Exa.ai
 */
export const findSimilarPagesTool = createTool({
	id: "find-similar-pages",
	description:
		"Find web pages similar to a given URL. Useful for competitive analysis, finding related companies, or discovering similar content.",
	inputSchema: z.object({
		url: z.string().url().describe("URL to find similar pages for"),
		numResults: z.number().min(1).max(10).default(5).describe("Number of results (1-10)"),
		includeText: z.boolean().default(true).describe("Include text snippets"),
	}),
	outputSchema: z.object({
		results: z.array(
			z.object({
				title: z.string(),
				url: z.string(),
				publishedDate: z.string().optional(),
				summary: z.string(),
				relevanceScore: z.number(),
			})
		),
		error: z.string().optional(),
	}),
	execute: async ({ context }) => {
		const apiKey = process.env.EXA_API_KEY
		if (!apiKey) {
			return { results: [], error: "EXA_API_KEY not configured" }
		}

		try {
			const { url, numResults, includeText } = context

			consola.info("[find-similar] Finding pages similar to:", url)

			const response = await fetch(`${EXA_API_URL}/findSimilar`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
				},
				body: JSON.stringify({
					url,
					numResults,
					contents: includeText
						? {
								text: { maxCharacters: 1000 },
								highlights: { numSentences: 3 },
							}
						: undefined,
				}),
			})

			if (!response.ok) {
				const errorText = await response.text()
				return { results: [], error: `Exa API error: ${response.status}` }
			}

			const data = (await response.json()) as ExaSearchResponse

			const results = (data.results || []).map((result) => ({
				title: result.title || "Untitled",
				url: result.url,
				publishedDate: result.publishedDate,
				summary:
					result.highlights?.join(" ") ||
					result.text?.slice(0, 500) ||
					"No summary available",
				relevanceScore: result.score,
			}))

			return { results }
		} catch (error) {
			consola.error("[find-similar] Error:", error)
			return {
				results: [],
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
