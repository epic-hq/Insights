import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const DEFAULT_MATCH_COUNT = 10
const DEFAULT_MATCH_THRESHOLD = 0.5 // Lowered from 0.7 - semantic similarity scores are typically lower than exact matches

export const semanticSearchEvidenceTool = createTool({
	id: "semantic-search-evidence",
	description:
		"Semantically search for evidence using natural language queries. Searches both verbatim interview quotes AND structured evidence facets (pains, gains, thinks, feels, etc.). Uses AI embeddings to find evidence that matches the meaning of your query, not just exact keywords. Great for finding related insights, pain points, goals, or specific topics mentioned in interviews.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				"Natural language search query (e.g., 'budget concerns', 'decision makers', 'integration challenges', 'timeline for implementation')"
			),
		projectId: z
			.string()
			.optional()
			.describe("Project ID to search within. Defaults to the current project in context."),
		interviewId: z.string().optional().describe("Optional: Limit search to a specific interview."),
		matchThreshold: z
			.number()
			.min(0)
			.max(1)
			.optional()
			.describe(
				"Similarity threshold (0-1). Higher = more strict. Default: 0.5. Recommended: 0.4-0.6 for broad searches, 0.6-0.8 for precise matches."
			),
		matchCount: z.number().int().min(1).max(50).optional().describe("Maximum number of results to return. Default: 10"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		query: z.string(),
		evidence: z.array(
			z.object({
				id: z.string(),
				verbatim: z.string().nullable(),
				gist: z.string().nullable(),
				similarity: z.number(),
				interviewId: z.string().nullable(),
				interviewTitle: z.string().nullable(),
				pains: z.array(z.string()).nullable(),
				gains: z.array(z.string()).nullable(),
				thinks: z.array(z.string()).nullable(),
				feels: z.array(z.string()).nullable(),
				anchors: z.any().nullable(),
			})
		),
		totalCount: z.number(),
		threshold: z.number(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = runtimeContext?.get?.("project_id")

		const projectId = context.projectId ?? runtimeProjectId ?? null
		const query = context.query?.trim()
		const interviewId = context.interviewId?.trim() || null
		const matchThreshold = context.matchThreshold ?? DEFAULT_MATCH_THRESHOLD
		const matchCount = context.matchCount ?? DEFAULT_MATCH_COUNT

		consola.debug("semantic-search-evidence: execute start", {
			projectId,
			query,
			interviewId,
			matchThreshold,
			matchCount,
		})

		if (!projectId) {
			consola.warn("semantic-search-evidence: missing projectId")
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				query: query || "",
				evidence: [],
				totalCount: 0,
				threshold: matchThreshold,
			}
		}

		if (!query) {
			consola.warn("semantic-search-evidence: missing query")
			return {
				success: false,
				message: "Missing search query. Provide a natural language query to search for.",
				query: "",
				evidence: [],
				totalCount: 0,
				threshold: matchThreshold,
			}
		}

		try {
			// 1. Generate embedding for the query using OpenAI
			const openaiApiKey = process.env.OPENAI_API_KEY
			if (!openaiApiKey) {
				throw new Error("OPENAI_API_KEY environment variable is not set")
			}

			consola.debug("semantic-search-evidence: generating query embedding")
			const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${openaiApiKey}`,
				},
				body: JSON.stringify({
					model: "text-embedding-3-small",
					input: query,
				}),
			})

			if (!embeddingResponse.ok) {
				const errorText = await embeddingResponse.text()
				throw new Error(`OpenAI API error: ${embeddingResponse.status} ${errorText}`)
			}

			const embeddingData = await embeddingResponse.json()
			const queryEmbedding = embeddingData.data[0].embedding as number[]

			// 2. Search for similar evidence using pgvector
			consola.debug("semantic-search-evidence: searching for similar evidence", {
				embeddingLength: queryEmbedding.length,
				embeddingPreview: queryEmbedding.slice(0, 5),
			})

			// If interview-specific, use that function
			if (interviewId) {
				const { data: evidenceData, error: evidenceError } = await supabase.rpc("find_similar_evidence_by_interview", {
					query_embedding: queryEmbedding,
					interview_id_param: interviewId,
					match_threshold: matchThreshold,
					match_count: matchCount,
				})

				if (evidenceError) {
					consola.error("semantic-search-evidence: database error", evidenceError)
					throw evidenceError
				}

				// Fetch interview titles for the results
				const interviewIds = [...new Set(evidenceData?.map((_e) => interviewId).filter(Boolean) || [])]
				const { data: interviewData } = interviewIds.length
					? await supabase.from("interviews").select("id, title").in("id", interviewIds)
					: { data: [] }

				const interviewTitles = new Map(interviewData?.map((i) => [i.id, i.title]) || [])

				const evidence = (evidenceData || []).map((row) => ({
					id: row.id,
					verbatim: row.verbatim || null,
					gist: row.gist || null,
					similarity: row.similarity,
					interviewId: interviewId,
					interviewTitle: interviewTitles.get(interviewId) || null,
					pains: row.pains || null,
					gains: row.gains || null,
					thinks: row.thinks || null,
					feels: row.feels || null,
					anchors: row.anchors || null,
				}))

				return {
					success: true,
					message: `Found ${evidence.length} evidence pieces matching "${query}" in interview.`,
					query,
					evidence,
					totalCount: evidence.length,
					threshold: matchThreshold,
				}
			}

			// Project-wide search - search both evidence and evidence_facets in parallel
			consola.debug("semantic-search-evidence: calling find_similar_evidence + find_similar_evidence_facets RPCs", {
				projectId,
				matchThreshold,
				matchCount,
			})

			// Search evidence verbatim
			const evidencePromise = supabase.rpc("find_similar_evidence", {
				query_embedding: queryEmbedding,
				project_id_param: projectId,
				match_threshold: matchThreshold,
				match_count: matchCount,
			})

			// Search evidence facets (pains, gains, thinks, feels, etc.)
			const facetsPromise = supabase.rpc("find_similar_evidence_facets", {
				query_embedding: queryEmbedding,
				project_id_param: projectId,
				match_threshold: matchThreshold,
				match_count: matchCount,
				kind_slug_filter: null, // Search all facet types
			})

			const [{ data: evidenceData, error: evidenceError }, { data: facetsData, error: facetsError }] =
				await Promise.all([evidencePromise, facetsPromise])

			consola.debug("semantic-search-evidence: RPC responses", {
				evidence: {
					hasError: !!evidenceError,
					dataLength: evidenceData?.length || 0,
					sampleResults: evidenceData?.slice(0, 2).map((e) => ({
						id: e.id,
						similarity: e.similarity,
						verbatimPreview: e.verbatim?.substring(0, 60),
					})),
				},
				facets: {
					hasError: !!facetsError,
					dataLength: facetsData?.length || 0,
					sampleResults: facetsData?.slice(0, 2).map((f) => ({
						id: f.id,
						kind: f.kind_slug,
						label: f.label,
						similarity: f.similarity,
					})),
				},
			})

			if (evidenceError) {
				consola.error("semantic-search-evidence: evidence query error", evidenceError)
				throw evidenceError
			}

			if (facetsError) {
				consola.error("semantic-search-evidence: facets query error", facetsError)
				throw facetsError
			}

			// Combine results from both searches
			// Get unique evidence IDs from both sources
			const evidenceIds = new Set<string>()
			const facetEvidenceIds = new Set<string>()

			evidenceData?.forEach((e) => evidenceIds.add(e.id))
			facetsData?.forEach((f) => {
				if (f.evidence_id) {
					facetEvidenceIds.add(f.evidence_id)
					evidenceIds.add(f.evidence_id)
				}
			})

			consola.debug("semantic-search-evidence: combined results", {
				uniqueEvidenceIds: evidenceIds.size,
				fromVerbatim: evidenceData?.length || 0,
				fromFacets: facetEvidenceIds.size,
			})

			if (evidenceIds.size === 0) {
				// Check if there's any evidence at all in the project
				const { count: totalEvidenceCount } = await supabase
					.from("evidence")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId)

				const { count: evidenceWithEmbeddings } = await supabase
					.from("evidence")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId)
					.not("embedding", "is", null)

				// Check what the top similarity scores actually are (without threshold filter)
				const { data: topMatches } = await supabase.rpc("find_similar_evidence", {
					query_embedding: queryEmbedding,
					project_id_param: projectId,
					match_threshold: 0.0, // No threshold to see actual scores
					match_count: 5,
				})

				consola.warn("semantic-search-evidence: no results found", {
					query,
					projectId,
					matchThreshold,
					matchCount,
					totalEvidenceCount,
					evidenceWithEmbeddings,
					topSimilarityScores: topMatches?.map((m) => m.similarity) || [],
					topMatchPreviews:
						topMatches?.slice(0, 2).map((m) => ({
							similarity: m.similarity,
							preview: m.verbatim?.substring(0, 80),
						})) || [],
					diagnostics: {
						hasEvidence: (totalEvidenceCount || 0) > 0,
						hasEmbeddings: (evidenceWithEmbeddings || 0) > 0,
						percentWithEmbeddings:
							totalEvidenceCount && totalEvidenceCount > 0
								? Math.round(((evidenceWithEmbeddings || 0) / totalEvidenceCount) * 100)
								: 0,
						highestSimilarity: topMatches?.[0]?.similarity || 0,
						thresholdTooHigh: (topMatches?.[0]?.similarity || 0) < matchThreshold,
					},
				})

				const highestScore = topMatches?.[0]?.similarity || 0
				const diagnosticMessage =
					(totalEvidenceCount || 0) === 0
						? "No evidence exists in this project yet. Upload interviews to create evidence."
						: (evidenceWithEmbeddings || 0) === 0
							? `Found ${totalEvidenceCount} evidence pieces, but none have embeddings generated yet. Embeddings are being processed in the background.`
							: highestScore > 0 && highestScore < matchThreshold
								? `Found evidence with similarity scores up to ${highestScore.toFixed(2)}, but your threshold is ${matchThreshold}. The highest matching evidence is: "${topMatches?.[0]?.verbatim?.substring(0, 150)}...". Try lowering the threshold to 0.5 or 0.6 to see more results.`
								: `No evidence found matching "${query}". Try lowering the similarity threshold (current: ${matchThreshold}) or using different search terms.`

				return {
					success: true,
					message: diagnosticMessage,
					query,
					evidence: [],
					totalCount: 0,
					threshold: matchThreshold,
				}
			}

			// Fetch full evidence data for all matched IDs
			const evidenceIdsArray = Array.from(evidenceIds)
			consola.debug("semantic-search-evidence: fetching full evidence data", {
				count: evidenceIdsArray.length,
			})

			const { data: fullEvidence } = await supabase
				.from("evidence")
				.select("id, verbatim, gist, interview_id, pains, gains, thinks, feels, anchors")
				.in("id", evidenceIdsArray)

			consola.debug("semantic-search-evidence: full evidence fetched", {
				fullEvidenceCount: fullEvidence?.length || 0,
			})

			const evidenceMap = new Map(fullEvidence?.map((e) => [e.id, e]) || [])

			// Get interview titles
			const interviewIds = [...new Set(fullEvidence?.map((e) => e.interview_id).filter(Boolean) || [])]
			const { data: interviewData } = interviewIds.length
				? await supabase.from("interviews").select("id, title").in("id", interviewIds)
				: { data: [] }

			const interviewTitles = new Map(interviewData?.map((i) => [i.id, i.title]) || [])

			// Create similarity map from both sources (use highest similarity for each evidence)
			const similarityMap = new Map<string, number>()
			evidenceData?.forEach((e) => {
				similarityMap.set(e.id, e.similarity)
			})
			facetsData?.forEach((f: any) => {
				if (f.evidence_id) {
					const existing = similarityMap.get(f.evidence_id) || 0
					// Use the higher similarity score
					similarityMap.set(f.evidence_id, Math.max(existing, f.similarity))
				}
			})

			// Map full evidence with similarity scores, sorted by similarity
			const evidence = evidenceIdsArray
				.map((id) => {
					const fullData = evidenceMap.get(id)
					if (!fullData) return null

					return {
						id,
						verbatim: fullData.verbatim || null,
						gist: fullData.gist || null,
						similarity: similarityMap.get(id) || 0,
						interviewId: fullData.interview_id || null,
						interviewTitle: fullData.interview_id ? interviewTitles.get(fullData.interview_id) || null : null,
						pains: fullData.pains || null,
						gains: fullData.gains || null,
						thinks: fullData.thinks || null,
						feels: fullData.feels || null,
						anchors: fullData.anchors || null,
					}
				})
				.filter((e): e is NonNullable<typeof e> => e !== null)
				.sort((a, b) => b.similarity - a.similarity)
				.slice(0, matchCount) // Limit to requested count

			const facetMatchCount = facetEvidenceIds.size
			const verbatimMatchCount = evidenceData?.length || 0
			const message =
				facetMatchCount > 0 && verbatimMatchCount > 0
					? `Found ${evidence.length} evidence pieces matching "${query}" (${verbatimMatchCount} from verbatim, ${facetMatchCount} from facets like pains/gains).`
					: facetMatchCount > 0
						? `Found ${evidence.length} evidence pieces matching "${query}" from structured facets (pains, gains, thinks, feels).`
						: `Found ${evidence.length} evidence pieces matching "${query}" from verbatim quotes.`

			return {
				success: true,
				message,
				query,
				evidence,
				totalCount: evidence.length,
				threshold: matchThreshold,
			}
		} catch (error) {
			consola.error("semantic-search-evidence: unexpected error", error)
			const errorMessage = error instanceof Error ? error.message : "Unexpected error during semantic search."
			return {
				success: false,
				message: errorMessage,
				query: query || "",
				evidence: [],
				totalCount: 0,
				threshold: matchThreshold,
			}
		}
	},
})
