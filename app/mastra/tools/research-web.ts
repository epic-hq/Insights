import { createTool } from "@mastra/core/tools";
import consola from "consola";
import { z } from "zod";
import { generateEmbeddingWithBilling, systemBillingContext } from "~/lib/billing";
import { supabaseAdmin } from "~/lib/supabase/client.server";

const EXA_API_URL = "https://api.exa.ai";

import { HOST } from "~/paths";

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

/**
 * Simple delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Web research tool using Exa.ai semantic search API.
 * Use this when users ask for web research, market research, competitor analysis,
 * or any external information gathering.
 */
export const webResearchTool = createTool({
	id: "web-research",
	description:
		"Search the web using Exa.ai semantic search. Use for market research, competitor analysis, industry trends, company information, or any external research needs. IMPORTANT: Use ONE query with multiple results (numResults=10) instead of multiple separate queries to avoid rate limits. Returns relevant web pages with summaries.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				"Natural language search query - be specific and descriptive. Combine multiple topics into ONE query when possible."
			),
		numResults: z
			.number()
			.min(1)
			.max(10)
			.nullish()
			.transform((val) => val ?? 5)
			.describe("Number of results to return (1-10). Use higher values instead of multiple separate searches."),
		type: z
			.enum(["neural", "keyword", "auto"])
			.nullish()
			.transform((val) => val ?? "auto")
			.describe("Search type: neural (semantic), keyword (traditional), or auto"),
		useAutoprompt: z
			.boolean()
			.nullish()
			.transform((val) => val ?? true)
			.describe("Let Exa optimize the query for better results"),
		includeText: z
			.boolean()
			.nullish()
			.transform((val) => val ?? true)
			.describe("Include text snippets from pages"),
		category: z
			.enum(["company", "research paper", "news", "pdf", "github", "tweet", "personal site", "linkedin profile"])
			.nullish()
			.describe("Filter to specific content category"),
	}),
	outputSchema: z.object({
		tldr: z.string().describe("2-3 key takeaways from the search"),
		noteUrl: z.string().nullish().describe("Link to the full research note"),
		noteId: z.string().nullish().describe("ID of the created note"),
		resultCount: z.number().describe("Number of results found"),
		evidenceCount: z.number().nullish().describe("Number of evidence records created"),
		error: z.string().optional(),
	}),
	execute: async (input, context?) => {
		const apiKey = process.env.EXA_API_KEY;
		if (!apiKey) {
			return {
				tldr: "Web research is not configured.",
				resultCount: 0,
				error: "EXA_API_KEY not configured",
			};
		}

		// Get project context for saving the note
		const projectId = context?.requestContext?.get?.("project_id");
		const accountId = context?.requestContext?.get?.("account_id");

		try {
			const { query, numResults, type, useAutoprompt, includeText, category } = input;

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
			};

			if (category) {
				requestBody.category = category;
			}

			consola.info("[web-research] Searching Exa:", {
				query,
				numResults,
				type,
			});

			// Retry logic for rate limits
			let response: Response | null = null;
			let lastError = "";
			for (let attempt = 0; attempt < 3; attempt++) {
				if (attempt > 0) {
					const waitTime = 1000 * (attempt + 1); // 2s, 3s backoff
					consola.info(`[web-research] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`);
					await delay(waitTime);
				}

				response = await fetch(`${EXA_API_URL}/search`, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-api-key": apiKey,
					},
					body: JSON.stringify(requestBody),
				});

				if (response.ok) break;

				if (response.status === 429) {
					lastError = "Rate limit exceeded";
					continue; // Retry on rate limit
				}

				// Other errors - don't retry
				const errorText = await response.text();
				consola.error("[web-research] Exa API error:", response.status, errorText);
				return {
					tldr: "Search failed due to an API error.",
					resultCount: 0,
					error: `Exa API error: ${response.status} - ${errorText}`,
				};
			}

			if (!response || !response.ok) {
				consola.error("[web-research] Exa API error after retries:", lastError);
				return {
					tldr: "Search failed due to rate limiting. Try again in a few seconds or use fewer parallel searches.",
					resultCount: 0,
					error: "Exa API rate limit exceeded after retries",
				};
			}

			const data = (await response.json()) as ExaSearchResponse;
			const resultCount = data.results?.length || 0;

			consola.info("[web-research] Found results:", resultCount);

			if (resultCount === 0) {
				return {
					tldr: `No results found for "${query}". Try broadening your search or using different keywords.`,
					resultCount: 0,
				};
			}

			// Format results for markdown note
			const results = (data.results || []).map((result) => ({
				title: result.title || "Untitled",
				url: result.url,
				publishedDate: result.publishedDate,
				author: result.author,
				summary: result.highlights?.join(" ") || result.text?.slice(0, 500) || "No summary available",
				relevanceScore: result.score,
			}));

			// Generate concise TLDR (2-3 key takeaways)
			const topResults = results.slice(0, 3);
			const takeaways = topResults.map((r, i) => `${i + 1}. ${r.title}`).join("; ");
			const tldr = `${resultCount} sources found. Key: ${takeaways}`;

			// Format as markdown for the note
			const markdownContent = formatResearchAsMarkdown(query, results, data.autopromptString);

			// Save as a note if we have project context
			let noteId: string | undefined;
			let noteUrl: string | undefined;
			let evidenceCount = 0;

			if (projectId && accountId) {
				try {
					// Use schema-specific client for public tables
					// Generate a concise title: 3-5 words derived from the query
					const conciseTitle = (() => {
						const words = query.trim().split(/\s+/).filter(Boolean);
						return words.slice(0, 5).join(" ") || "Web research note";
					})();

					const { data: note, error: noteError } = await supabaseAdmin
						.schema("public")
						.from("interviews")
						.insert({
							account_id: accountId,
							project_id: projectId,
							title: `Web Research: ${conciseTitle}`,
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
						.single();

					if (noteError) {
						consola.error("[web-research] Failed to save note:", noteError);
					} else if (note) {
						noteId = (note as any).id;
						noteUrl = `${HOST}/a/${accountId}/${projectId}/interviews/${noteId}`;
						consola.info("[web-research] Saved research note:", noteId);

						// Create evidence records for each search result (for semantic search)
						const billingCtx = systemBillingContext(accountId, "embedding_generation", projectId);
						for (const result of results) {
							try {
								// Generate embedding for the result content
								const textToEmbed = `${result.title}: ${result.summary}`;
								const embedding = await generateEmbeddingWithBilling(billingCtx, textToEmbed, {
									idempotencyKey: `web-research:${noteId}:${result.url}`,
									resourceType: "evidence",
								});

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
								};

								const { error: evidenceError } = await supabaseAdmin
									.schema("public")
									.from("evidence")
									.insert(evidenceRecord as any);

								if (evidenceError) {
									consola.error("[web-research] Failed to save evidence:", evidenceError);
								} else {
									evidenceCount++;
								}
							} catch (evidenceErr) {
								consola.error("[web-research] Error creating evidence:", evidenceErr);
							}
						}

						consola.info(`[web-research] Created ${evidenceCount} evidence records`);

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
								.eq("id", noteId);
						}
					}
				} catch (saveError) {
					consola.error("[web-research] Error saving note:", saveError);
				}
			}

			return {
				tldr,
				noteUrl,
				noteId,
				resultCount,
				evidenceCount,
			};
		} catch (error) {
			consola.error("[web-research] Error:", error);
			return {
				tldr: "An error occurred during the search.",
				resultCount: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

/**
 * Format research results as a markdown document
 */
function formatResearchAsMarkdown(
	query: string,
	results: Array<{
		title: string;
		url: string;
		publishedDate?: string;
		author?: string;
		summary: string;
		relevanceScore: number;
	}>,
	optimizedQuery?: string
): string {
	const lines: string[] = [
		`# Web Research: ${query}`,
		"",
		`**Search Date:** ${new Date().toLocaleDateString()}`,
		`**Results Found:** ${results.length}`,
	];

	if (optimizedQuery && optimizedQuery !== query) {
		lines.push(`**Optimized Query:** ${optimizedQuery}`);
	}

	lines.push("", "---", "");

	for (const result of results) {
		lines.push(`## [${result.title}](${result.url})`);
		lines.push("");

		const meta: string[] = [];
		if (result.author) meta.push(`**Author:** ${result.author}`);
		if (result.publishedDate) {
			const date = new Date(result.publishedDate);
			meta.push(`**Published:** ${date.toLocaleDateString()}`);
		}
		meta.push(`**Relevance:** ${Math.round(result.relevanceScore * 100)}%`);

		if (meta.length > 0) {
			lines.push(meta.join(" | "));
			lines.push("");
		}

		lines.push(result.summary);
		lines.push("");
		lines.push("---");
		lines.push("");
	}

	return lines.join("\n");
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
		numResults: z
			.number()
			.min(1)
			.max(10)
			.nullish()
			.transform((val) => val ?? 5)
			.describe("Number of results (1-10)"),
		includeText: z
			.boolean()
			.nullish()
			.transform((val) => val ?? true)
			.describe("Include text snippets"),
	}),
	outputSchema: z.object({
		tldr: z.string().describe("2-3 key takeaways from similar pages"),
		noteUrl: z.string().nullish().describe("Link to the full research note"),
		noteId: z.string().nullish().describe("ID of the created note"),
		resultCount: z.number().describe("Number of similar pages found"),
		evidenceCount: z.number().nullish().describe("Number of evidence records created"),
		error: z.string().optional(),
	}),
	execute: async (input, context?) => {
		const apiKey = process.env.EXA_API_KEY;
		if (!apiKey) {
			return {
				tldr: "Similar pages search is not configured.",
				resultCount: 0,
				error: "EXA_API_KEY not configured",
			};
		}

		const projectId = context?.requestContext?.get?.("project_id");
		const accountId = context?.requestContext?.get?.("account_id");

		try {
			const { url, numResults, includeText } = input;

			consola.info("[find-similar] Finding pages similar to:", url);

			// Retry logic for rate limits
			let response: Response | null = null;
			let lastError = "";
			for (let attempt = 0; attempt < 3; attempt++) {
				if (attempt > 0) {
					const waitTime = 1000 * (attempt + 1);
					consola.info(`[find-similar] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}`);
					await delay(waitTime);
				}

				response = await fetch(`${EXA_API_URL}/findSimilar`, {
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
				});

				if (response.ok) break;

				if (response.status === 429) {
					lastError = "Rate limit exceeded";
					continue;
				}

				const errorText = await response.text();
				consola.error("[find-similar] Exa API error:", response.status, errorText);
				return {
					tldr: "Search failed due to an API error.",
					resultCount: 0,
					error: `Exa API error: ${response.status}`,
				};
			}

			if (!response || !response.ok) {
				consola.error("[find-similar] Exa API error after retries:", lastError);
				return {
					tldr: "Search failed due to rate limiting. Try again in a few seconds.",
					resultCount: 0,
					error: "Exa API rate limit exceeded after retries",
				};
			}

			const data = (await response.json()) as ExaSearchResponse;
			const resultCount = data.results?.length || 0;

			if (resultCount === 0) {
				return {
					tldr: `No similar pages found for ${url}. The page may be unique or not indexed.`,
					resultCount: 0,
				};
			}

			const results = (data.results || []).map((result) => ({
				title: result.title || "Untitled",
				url: result.url,
				publishedDate: result.publishedDate,
				author: result.author,
				summary: result.highlights?.join(" ") || result.text?.slice(0, 500) || "No summary available",
				relevanceScore: result.score,
			}));

			// Generate concise TLDR (2-3 key takeaways)
			const topResults = results.slice(0, 3);
			const takeaways = topResults.map((r, i) => `${i + 1}. ${r.title}`).join("; ");
			const tldr = `${resultCount} similar pages. Key: ${takeaways}`;

			// Format as markdown
			const markdownContent = formatSimilarPagesAsMarkdown(url, results);

			// Save as a note
			let noteId: string | undefined;
			let noteUrl: string | undefined;
			let evidenceCount = 0;

			if (projectId && accountId) {
				try {
					const urlDomain = new URL(url).hostname.replace("www.", "");
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
						.single();

					if (noteError) {
						consola.error("[find-similar] Failed to save note:", noteError);
					} else if (note) {
						noteId = (note as any).id;
						noteUrl = `${HOST}/a/${accountId}/${projectId}/interviews/${noteId}`;
						consola.info("[find-similar] Saved research note:", noteId);

						// Create evidence records for each similar page (for semantic search)
						const billingCtx = systemBillingContext(accountId, "embedding_generation", projectId);
						for (const result of results) {
							try {
								// Generate embedding for the result content
								const textToEmbed = `${result.title}: ${result.summary}`;
								const embedding = await generateEmbeddingWithBilling(billingCtx, textToEmbed, {
									idempotencyKey: `find-similar:${noteId}:${result.url}`,
									resourceType: "evidence",
								});

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
								};

								const { error: evidenceError } = await supabaseAdmin
									.schema("public")
									.from("evidence")
									.insert(evidenceRecord as any);

								if (evidenceError) {
									consola.error("[find-similar] Failed to save evidence:", evidenceError);
								} else {
									evidenceCount++;
								}
							} catch (evidenceErr) {
								consola.error("[find-similar] Error creating evidence:", evidenceErr);
							}
						}

						consola.info(`[find-similar] Created ${evidenceCount} evidence records`);

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
								.eq("id", noteId);
						}
					}
				} catch (saveError) {
					consola.error("[find-similar] Error saving note:", saveError);
				}
			}

			return {
				tldr,
				noteUrl,
				noteId,
				resultCount,
				evidenceCount,
			};
		} catch (error) {
			consola.error("[find-similar] Error:", error);
			return {
				tldr: "An error occurred while finding similar pages.",
				resultCount: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	},
});

/**
 * Format similar pages results as markdown
 */
function formatSimilarPagesAsMarkdown(
	sourceUrl: string,
	results: Array<{
		title: string;
		url: string;
		publishedDate?: string;
		author?: string;
		summary: string;
		relevanceScore: number;
	}>
): string {
	const lines: string[] = [
		"# Similar Pages Analysis",
		"",
		`**Source URL:** [${sourceUrl}](${sourceUrl})`,
		`**Search Date:** ${new Date().toLocaleDateString()}`,
		`**Similar Pages Found:** ${results.length}`,
		"",
		"---",
		"",
	];

	for (const result of results) {
		lines.push(`## [${result.title}](${result.url})`);
		lines.push("");

		const meta: string[] = [];
		if (result.author) meta.push(`**Author:** ${result.author}`);
		if (result.publishedDate) {
			const date = new Date(result.publishedDate);
			meta.push(`**Published:** ${date.toLocaleDateString()}`);
		}
		meta.push(`**Similarity:** ${Math.round(result.relevanceScore * 100)}%`);

		if (meta.length > 0) {
			lines.push(meta.join(" | "));
			lines.push("");
		}

		lines.push(result.summary);
		lines.push("");
		lines.push("---");
		lines.push("");
	}

	return lines.join("\n");
}
