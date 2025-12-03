import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const DEFAULT_MATCH_COUNT = 10
const DEFAULT_MATCH_THRESHOLD = 0.7

export const semanticSearchEvidenceTool = createTool({
	id: "semantic-search-evidence",
	description:
		"Semantically search for evidence using natural language queries. Uses AI embeddings to find evidence that matches the meaning of your query, not just exact keywords. Great for finding related insights, pain points, goals, or specific topics mentioned in interviews.",
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
			.describe("Similarity threshold (0-1). Higher = more strict. Default: 0.7"),
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
	execute: async (context, _options) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context.runtimeContext?.get?.("project_id")

		const projectId = context.projectId ?? runtimeProjectId ?? null
		const query = context.query?.trim()
		const interviewId = context.interviewId?.trim() || null
		const matchThreshold = context.matchThreshold ?? DEFAULT_MATCH_THRESHOLD
		const matchCount = context.matchCount ?? DEFAULT_MATCH_COUNT

		consola.info("semantic-search-evidence: execute start", {
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

			consola.info("semantic-search-evidence: generating query embedding")
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
			consola.info("semantic-search-evidence: searching for similar evidence")

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
				const interviewIds = [...new Set(evidenceData?.map((e) => interviewId).filter(Boolean) || [])]
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

			// Project-wide search
			const { data: evidenceData, error: evidenceError } = await supabase.rpc("find_similar_evidence", {
				query_embedding: queryEmbedding,
				project_id_param: projectId,
				match_threshold: matchThreshold,
				match_count: matchCount,
			})

			if (evidenceError) {
				consola.error("semantic-search-evidence: database error", evidenceError)
				throw evidenceError
			}

			if (!evidenceData || evidenceData.length === 0) {
				return {
					success: true,
					message: `No evidence found matching "${query}". Try lowering the similarity threshold or using different search terms.`,
					query,
					evidence: [],
					totalCount: 0,
					threshold: matchThreshold,
				}
			}

			// Fetch additional data for better context
			const evidenceIds = evidenceData.map((e) => e.id)
			const { data: fullEvidence } = await supabase
				.from("evidence")
				.select("id, interview_id, pains, gains, thinks, feels, anchors")
				.in("id", evidenceIds)

			const evidenceMap = new Map(fullEvidence?.map((e) => [e.id, e]) || [])

			// Get interview titles
			const interviewIds = [...new Set(fullEvidence?.map((e) => e.interview_id).filter(Boolean) || [])]
			const { data: interviewData } = interviewIds.length
				? await supabase.from("interviews").select("id, title").in("id", interviewIds)
				: { data: [] }

			const interviewTitles = new Map(interviewData?.map((i) => [i.id, i.title]) || [])

			const evidence = evidenceData.map((row) => {
				const fullData = evidenceMap.get(row.id)
				return {
					id: row.id,
					verbatim: row.verbatim || null,
					gist: null,
					similarity: row.similarity,
					interviewId: fullData?.interview_id || null,
					interviewTitle: fullData?.interview_id ? interviewTitles.get(fullData.interview_id) || null : null,
					pains: fullData?.pains || null,
					gains: fullData?.gains || null,
					thinks: fullData?.thinks || null,
					feels: fullData?.feels || null,
					anchors: fullData?.anchors || null,
				}
			})

			return {
				success: true,
				message: `Found ${evidence.length} evidence pieces semantically matching "${query}".`,
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
