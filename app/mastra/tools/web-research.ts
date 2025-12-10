import { createTool } from "@mastra/core/tools"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"

const EXA_API_URL = "https://api.exa.ai"
const OPENAI_API_URL = "https://api.openai.com/v1/embeddings"
const HOST = process.env.HOST || "https://app.upsight.pro"

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
 * Generate OpenAI embedding for a text string
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
	const apiKey = process.env.OPENAI_API_KEY
	if (!apiKey) {
		consola.warn("[web-research] OPENAI_API_KEY not set, skipping embedding")
		return null
	}

	try {
		const response = await fetch(OPENAI_API_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: "text-embedding-3-small",
				input: text.slice(0, 8000), // Limit input length
				dimensions: 1536,
			}),
		})

		if (!response.ok) {
			const error = await response.text()
			consola.error("[web-research] OpenAI embedding error:", error)
			return null
		}

		const data = await response.json()
		return data.data[0].embedding
	} catch (error) {
		consola.error("[web-research] Embedding generation failed:", error)
		return null
	}
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
		tldr: z.string().describe("2-3 key takeaways from the search"),
		noteUrl: z.string().optional().describe("Link to the full research note"),
		noteId: z.string().optional().describe("ID of the created note"),
		resultCount: z.number().describe("Number of results found"),
		evidenceCount: z.number().optional().describe("Number of evidence records created"),
		error: z.string().optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const apiKey = process.env.EXA_API_KEY
		if (!apiKey) {
			return {
				tldr: "Web research is not configured.",
				resultCount: 0,
				error: "EXA_API_KEY not configured",
			}
		}

		// Get project context for saving the note
		const projectId = runtimeContext?.get?.("project_id")
		const accountId = runtimeContext?.get?.("account_id")

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
					tldr: "Search failed due to an API error.",
					resultCount: 0,
					error: `Exa API error: ${response.status} - ${errorText}`,
				}
			}

			const data = (await response.json()) as ExaSearchResponse
			const resultCount = data.results?.length || 0

			consola.info("[web-research] Found results:", resultCount)

			if (resultCount === 0) {
				return {
					tldr: `No results found for "${query}". Try broadening your search or using different keywords.`,
					resultCount: 0,
				}
			}

			// Format results for markdown note
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

			// Generate concise TLDR (2-3 key takeaways)
			const topResults = results.slice(0, 3)
			const takeaways = topResults.map((r, i) => `${i + 1}. ${r.title}`).join("; ")
			const tldr = `${resultCount} sources found. Key: ${takeaways}`

			// Format as markdown for the note
			const markdownContent = formatResearchAsMarkdown(query, results, data.autopromptString)

			// Save as a note if we have project context
			let noteId: string | undefined
			let noteUrl: string | undefined
			let evidenceCount = 0

			if (projectId && accountId) {
				try {
					// Use schema-specific client for public tables
					const { data: note, error: noteError } = await supabaseAdmin
						.schema("public")
						.from("interviews")
						.insert({
							account_id: accountId,
							project_id: projectId,
							title: `Web Research: ${query.slice(0, 50)}${query.length > 50 ? "..." : ""}`,
							observations_and_notes: markdownContent,
							source_type: "note",
							media_type: "web_research",
							status: "ready",
							conversation_analysis: {
								note_type: "web_research",
								query,
								result_count: resultCount,
								search_date: new Date().toISOString(),
							},
						} as any)
						.select("id")
						.single()

					if (noteError) {
						consola.error("[web-research] Failed to save note:", noteError)
					} else if (note) {
						noteId = (note as any).id
						noteUrl = `${HOST}/a/${accountId}/${projectId}/interviews/${noteId}`
						consola.info("[web-research] Saved research note:", noteId)

						// Create evidence records for each search result (for semantic search)
						for (const result of results) {
							try {
								// Generate embedding for the result content
								const textToEmbed = `${result.title}: ${result.summary}`
								const embedding = await generateEmbedding(textToEmbed)

								const evidenceRecord = {
									account_id: accountId,
									project_id: projectId,
									interview_id: noteId, // Link to the research note
									verbatim: result.summary,
									gist: result.title,
									citation: result.url,
									method: "market_report",
									source_type: "secondary",
									modality: "qual",
									confidence: "medium",
									context_summary: `From web research: "${query}"`,
									...(embedding && {
										embedding: embedding,
										embedding_model: "text-embedding-3-small",
										embedding_generated_at: new Date().toISOString(),
									}),
								}

								const { error: evidenceError } = await supabaseAdmin
									.schema("public")
									.from("evidence")
									.insert(evidenceRecord as any)

								if (evidenceError) {
									consola.error("[web-research] Failed to save evidence:", evidenceError)
								} else {
									evidenceCount++
								}
							} catch (evidenceErr) {
								consola.error("[web-research] Error creating evidence:", evidenceErr)
							}
						}

						consola.info(`[web-research] Created ${evidenceCount} evidence records`)

						// Update note with indexing status so NoteCard shows it as indexed
						if (evidenceCount > 0) {
							await supabaseAdmin
								.schema("public")
								.from("interviews")
								.update({
									conversation_analysis: {
										note_type: "web_research",
										query,
										result_count: resultCount,
										search_date: new Date().toISOString(),
										indexed_at: new Date().toISOString(),
										evidence_count: evidenceCount,
									},
								})
								.eq("id", noteId)
						}
					}
				} catch (saveError) {
					consola.error("[web-research] Error saving note:", saveError)
				}
			}

			return {
				tldr,
				noteUrl,
				noteId,
				resultCount,
				evidenceCount,
			}
		} catch (error) {
			consola.error("[web-research] Error:", error)
			return {
				tldr: "An error occurred during the search.",
				resultCount: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})

/**
 * Format research results as a markdown document
 */
function formatResearchAsMarkdown(
	query: string,
	results: Array<{
		title: string
		url: string
		publishedDate?: string
		author?: string
		summary: string
		relevanceScore: number
	}>,
	optimizedQuery?: string
): string {
	const lines: string[] = [
		`# Web Research: ${query}`,
		"",
		`**Search Date:** ${new Date().toLocaleDateString()}`,
		`**Results Found:** ${results.length}`,
	]

	if (optimizedQuery && optimizedQuery !== query) {
		lines.push(`**Optimized Query:** ${optimizedQuery}`)
	}

	lines.push("", "---", "")

	for (const result of results) {
		lines.push(`## [${result.title}](${result.url})`)
		lines.push("")

		const meta: string[] = []
		if (result.author) meta.push(`**Author:** ${result.author}`)
		if (result.publishedDate) {
			const date = new Date(result.publishedDate)
			meta.push(`**Published:** ${date.toLocaleDateString()}`)
		}
		meta.push(`**Relevance:** ${Math.round(result.relevanceScore * 100)}%`)

		if (meta.length > 0) {
			lines.push(meta.join(" | "))
			lines.push("")
		}

		lines.push(result.summary)
		lines.push("")
		lines.push("---")
		lines.push("")
	}

	return lines.join("\n")
}

/**
 * Find similar pages to a given URL using Exa.ai
 * Saves results as a research note and returns a TLDR with link
 */
export const findSimilarPagesTool = createTool({
	id: "find-similar-pages",
	description:
		"Find web pages similar to a given URL. Useful for competitive analysis, finding related companies, or discovering similar content. Saves full results as a note.",
	inputSchema: z.object({
		url: z.string().url().describe("URL to find similar pages for"),
		numResults: z.number().min(1).max(10).default(5).describe("Number of results (1-10)"),
		includeText: z.boolean().default(true).describe("Include text snippets"),
	}),
	outputSchema: z.object({
		tldr: z.string().describe("2-3 key takeaways from similar pages"),
		noteUrl: z.string().optional().describe("Link to the full research note"),
		noteId: z.string().optional().describe("ID of the created note"),
		resultCount: z.number().describe("Number of similar pages found"),
		evidenceCount: z.number().optional().describe("Number of evidence records created"),
		error: z.string().optional(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const apiKey = process.env.EXA_API_KEY
		if (!apiKey) {
			return {
				tldr: "Similar pages search is not configured.",
				resultCount: 0,
				error: "EXA_API_KEY not configured",
			}
		}

		const projectId = runtimeContext?.get?.("project_id")
		const accountId = runtimeContext?.get?.("account_id")

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
				consola.error("[find-similar] Exa API error:", response.status, errorText)
				return {
					tldr: "Search failed due to an API error.",
					resultCount: 0,
					error: `Exa API error: ${response.status}`,
				}
			}

			const data = (await response.json()) as ExaSearchResponse
			const resultCount = data.results?.length || 0

			if (resultCount === 0) {
				return {
					tldr: `No similar pages found for ${url}. The page may be unique or not indexed.`,
					resultCount: 0,
				}
			}

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

			// Generate concise TLDR (2-3 key takeaways)
			const topResults = results.slice(0, 3)
			const takeaways = topResults.map((r, i) => `${i + 1}. ${r.title}`).join("; ")
			const tldr = `${resultCount} similar pages. Key: ${takeaways}`

			// Format as markdown
			const markdownContent = formatSimilarPagesAsMarkdown(url, results)

			// Save as a note
			let noteId: string | undefined
			let noteUrl: string | undefined
			let evidenceCount = 0

			if (projectId && accountId) {
				try {
					const urlDomain = new URL(url).hostname.replace("www.", "")
					// Use schema-specific client for public tables
					const { data: note, error: noteError } = await supabaseAdmin
						.schema("public")
						.from("interviews")
						.insert({
							account_id: accountId,
							project_id: projectId,
							title: `Similar to: ${urlDomain}`,
							observations_and_notes: markdownContent,
							source_type: "note",
							media_type: "competitive_research",
							status: "ready",
							conversation_analysis: {
								note_type: "similar_pages",
								source_url: url,
								result_count: resultCount,
								search_date: new Date().toISOString(),
							},
						} as any)
						.select("id")
						.single()

					if (noteError) {
						consola.error("[find-similar] Failed to save note:", noteError)
					} else if (note) {
						noteId = (note as any).id
						noteUrl = `${HOST}/a/${accountId}/${projectId}/interviews/${noteId}`
						consola.info("[find-similar] Saved research note:", noteId)

						// Create evidence records for each similar page (for semantic search)
						for (const result of results) {
							try {
								// Generate embedding for the result content
								const textToEmbed = `${result.title}: ${result.summary}`
								const embedding = await generateEmbedding(textToEmbed)

								const evidenceRecord = {
									account_id: accountId,
									project_id: projectId,
									interview_id: noteId, // Link to the research note
									verbatim: result.summary,
									gist: result.title,
									citation: result.url,
									method: "market_report",
									source_type: "secondary",
									modality: "qual",
									confidence: "medium",
									context_summary: `Similar to: ${urlDomain}`,
									...(embedding && {
										embedding: embedding,
										embedding_model: "text-embedding-3-small",
										embedding_generated_at: new Date().toISOString(),
									}),
								}

								const { error: evidenceError } = await supabaseAdmin
									.schema("public")
									.from("evidence")
									.insert(evidenceRecord as any)

								if (evidenceError) {
									consola.error("[find-similar] Failed to save evidence:", evidenceError)
								} else {
									evidenceCount++
								}
							} catch (evidenceErr) {
								consola.error("[find-similar] Error creating evidence:", evidenceErr)
							}
						}

						consola.info(`[find-similar] Created ${evidenceCount} evidence records`)

						// Update note with indexing status so NoteCard shows it as indexed
						if (evidenceCount > 0) {
							await supabaseAdmin
								.schema("public")
								.from("interviews")
								.update({
									conversation_analysis: {
										note_type: "similar_pages",
										source_url: url,
										result_count: resultCount,
										search_date: new Date().toISOString(),
										indexed_at: new Date().toISOString(),
										evidence_count: evidenceCount,
									},
								})
								.eq("id", noteId)
						}
					}
				} catch (saveError) {
					consola.error("[find-similar] Error saving note:", saveError)
				}
			}

			return {
				tldr,
				noteUrl,
				noteId,
				resultCount,
				evidenceCount,
			}
		} catch (error) {
			consola.error("[find-similar] Error:", error)
			return {
				tldr: "An error occurred while finding similar pages.",
				resultCount: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})

/**
 * Format similar pages results as markdown
 */
function formatSimilarPagesAsMarkdown(
	sourceUrl: string,
	results: Array<{
		title: string
		url: string
		publishedDate?: string
		author?: string
		summary: string
		relevanceScore: number
	}>
): string {
	const lines: string[] = [
		`# Similar Pages Analysis`,
		"",
		`**Source URL:** [${sourceUrl}](${sourceUrl})`,
		`**Search Date:** ${new Date().toLocaleDateString()}`,
		`**Similar Pages Found:** ${results.length}`,
		"",
		"---",
		"",
	]

	for (const result of results) {
		lines.push(`## [${result.title}](${result.url})`)
		lines.push("")

		const meta: string[] = []
		if (result.author) meta.push(`**Author:** ${result.author}`)
		if (result.publishedDate) {
			const date = new Date(result.publishedDate)
			meta.push(`**Published:** ${date.toLocaleDateString()}`)
		}
		meta.push(`**Similarity:** ${Math.round(result.relevanceScore * 100)}%`)

		if (meta.length > 0) {
			lines.push(meta.join(" | "))
			lines.push("")
		}

		lines.push(result.summary)
		lines.push("")
		lines.push("---")
		lines.push("")
	}

	return lines.join("\n")
}
