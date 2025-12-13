/**
 * Semantic Search Assets Tool
 *
 * Search project_assets (tables, documents, files) using natural language queries.
 * Uses OpenAI embeddings and pgvector for similarity search.
 */

import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const DEFAULT_MATCH_COUNT = 10
const DEFAULT_MATCH_THRESHOLD = 0.45 // Assets need lower threshold due to structured data

export const semanticSearchAssetsTool = createTool({
	id: "semantic-search-assets",
	description:
		"Search for files, tables, and documents in the project using natural language queries. Use this to find imported spreadsheets, saved tables, or uploaded documents. Returns matching assets ranked by semantic similarity.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				"Natural language search query (e.g., 'competitive pricing comparison', 'customer contact list', 'interview transcripts')"
			),
		assetType: z
			.enum(["table", "pdf", "document", "image", "audio", "video", "link"])
			.optional()
			.describe("Optional: Filter by asset type"),
		matchThreshold: z
			.number()
			.min(0)
			.max(1)
			.optional()
			.describe("Similarity threshold (0-1). Higher = more strict. Default: 0.45"),
		matchCount: z
			.number()
			.int()
			.min(1)
			.max(50)
			.optional()
			.describe("Maximum number of results to return. Default: 10"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		query: z.string(),
		assets: z.array(
			z.object({
				id: z.string(),
				title: z.string(),
				description: z.string().nullable(),
				assetType: z.string(),
				similarity: z.number(),
				rowCount: z.number().nullable(),
				columnCount: z.number().nullable(),
				preview: z.string().nullable().describe("First ~500 chars of content"),
			})
		),
		totalCount: z.number(),
		threshold: z.number(),
	}),
	execute: async ({ context, runtimeContext }) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const projectId = context.projectId ?? runtimeContext?.get?.("project_id") ?? null

		const query = context.query?.trim()
		const matchThreshold = context.matchThreshold ?? DEFAULT_MATCH_THRESHOLD
		const matchCount = context.matchCount ?? DEFAULT_MATCH_COUNT

		consola.debug("semantic-search-assets: execute start", {
			projectId,
			query,
			matchThreshold,
			matchCount,
		})

		if (!projectId) {
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				query: query || "",
				assets: [],
				totalCount: 0,
				threshold: matchThreshold,
			}
		}

		if (!query) {
			return {
				success: false,
				message: "Missing search query. Provide a natural language query to search for.",
				query: "",
				assets: [],
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

			consola.debug("semantic-search-assets: generating query embedding")
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

			// 2. Search for similar assets using pgvector
			consola.debug("semantic-search-assets: calling find_similar_assets RPC", {
				projectId,
				matchThreshold,
				matchCount,
			})

			const { data: assetsData, error: assetsError } = await supabase.rpc("find_similar_assets", {
				query_embedding: queryEmbedding as unknown as string, // pgvector expects array, types are wrong
				project_id_param: projectId as string,
				match_threshold: matchThreshold,
				match_count: matchCount,
			})

			if (assetsError) {
				consola.error("semantic-search-assets: database error", assetsError)
				throw assetsError
			}

			// Filter by asset type if specified
			let results = assetsData || []
			if (context.assetType) {
				results = results.filter((a: any) => a.asset_type === context.assetType)
			}

			const assets = results.map((row: any) => ({
				id: row.id,
				title: row.title || "Untitled",
				description: row.description || null,
				assetType: row.asset_type,
				similarity: row.similarity,
				rowCount: row.row_count || null,
				columnCount: row.column_count || null,
				preview: row.content_md?.slice(0, 500) || null,
			}))

			consola.info(`semantic-search-assets: found ${assets.length} matching assets for "${query}"`)

			return {
				success: true,
				message: assets.length > 0
					? `Found ${assets.length} file(s) matching "${query}".`
					: `No files found matching "${query}". Try a different search term or check if assets have been indexed.`,
				query,
				assets,
				totalCount: assets.length,
				threshold: matchThreshold,
			}
		} catch (error) {
			consola.error("semantic-search-assets: error", error)
			return {
				success: false,
				message: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				query,
				assets: [],
				totalCount: 0,
				threshold: matchThreshold,
			}
		}
	},
})
