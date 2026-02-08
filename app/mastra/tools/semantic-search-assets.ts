/**
 * Semantic Search Assets Tool
 *
 * Search project_assets (tables, documents, files) using natural language queries.
 * Uses OpenAI embeddings and pgvector for similarity search.
 */

import { createTool } from "@mastra/core/tools";
import type { SupabaseClient } from "@supabase/supabase-js";
import consola from "consola";
import { z } from "zod";
import { supabaseAdmin } from "~/lib/supabase/client.server";
import type { Database } from "~/types";

const DEFAULT_MATCH_COUNT = 10;
const DEFAULT_MATCH_THRESHOLD = 0.35; // Assets need lower threshold - structured data has lower semantic similarity

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
			.nullish()
			.describe("Optional: Filter by asset type"),
		matchThreshold: z
			.number()
			.min(0)
			.max(1)
			.nullish()
			.describe(
				"Similarity threshold (0-1). Default: 0.35. DO NOT override unless specifically needed - asset embeddings have lower similarity scores than text."
			),
		matchCount: z.number().int().min(1).max(50).nullish().describe("Maximum number of results to return. Default: 10"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		query: z.string(),
		assets: z.array(
			z.object({
				id: z.string(),
				url: z.string().describe("Full URL to view/edit this asset (use this for links)"),
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
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>;
		const projectId = input.projectId ?? context?.requestContext?.get?.("project_id") ?? null;
		const accountId = context?.requestContext?.get?.("account_id") ?? null;

		const query = input.query?.trim();
		const matchThreshold = input.matchThreshold ?? DEFAULT_MATCH_THRESHOLD;
		const matchCount = input.matchCount ?? DEFAULT_MATCH_COUNT;

		consola.info("semantic-search-assets: execute start", {
			projectId,
			query,
			assetType: input.assetType,
			matchThreshold,
			matchCount,
		});

		if (!projectId) {
			return {
				success: false,
				message: "Missing projectId. Pass one explicitly or ensure the runtime context sets project_id.",
				query: query || "",
				assets: [],
				totalCount: 0,
				threshold: matchThreshold,
			};
		}

		if (!query) {
			return {
				success: false,
				message: "Missing search query. Provide a natural language query to search for.",
				query: "",
				assets: [],
				totalCount: 0,
				threshold: matchThreshold,
			};
		}

		try {
			// 1. Generate embedding for the query using OpenAI
			const openaiApiKey = process.env.OPENAI_API_KEY;
			if (!openaiApiKey) {
				throw new Error("OPENAI_API_KEY environment variable is not set");
			}

			consola.info("semantic-search-assets: generating query embedding");
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
			});

			if (!embeddingResponse.ok) {
				const errorText = await embeddingResponse.text();
				throw new Error(`OpenAI API error: ${embeddingResponse.status} ${errorText}`);
			}

			const embeddingData = await embeddingResponse.json();
			const queryEmbedding = embeddingData.data[0].embedding as number[];

			// 2. Search for similar assets using pgvector
			consola.info("semantic-search-assets: calling find_similar_assets RPC", {
				projectId,
				embeddingLength: queryEmbedding.length,
				matchThreshold,
				matchCount,
			});

			const { data: assetsData, error: assetsError } = await supabase.rpc("find_similar_assets", {
				query_embedding: queryEmbedding as unknown as string, // pgvector expects array, types are wrong
				project_id_param: projectId as string,
				match_threshold: matchThreshold,
				match_count: matchCount,
			});

			consola.info("semantic-search-assets: RPC response", {
				hasError: !!assetsError,
				errorMsg: assetsError?.message,
				dataLength: assetsData?.length ?? 0,
				sampleResults: assetsData?.slice(0, 3).map((a: any) => ({
					id: a.id,
					title: a.title,
					similarity: a.similarity,
				})),
			});

			if (assetsError) {
				consola.error("semantic-search-assets: database error", assetsError);
				throw assetsError;
			}

			// Filter by asset type if specified
			let results = assetsData || [];
			if (input.assetType) {
				results = results.filter((a: any) => a.asset_type === input.assetType);
			}

			const assets = results.map((row: any) => ({
				id: row.id,
				url: `/a/${accountId}/${projectId}/assets/${row.id}`,
				title: row.title || "Untitled",
				description: row.description || null,
				assetType: row.asset_type,
				similarity: row.similarity,
				rowCount: row.row_count || null,
				columnCount: row.column_count || null,
				preview: row.content_md?.slice(0, 500) || null,
			}));

			// Diagnostic info when no results
			if (assets.length === 0) {
				// Check asset counts for this project
				const { count: totalAssets } = await supabase
					.from("project_assets")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId as string);

				const { count: assetsWithEmbeddings } = await supabase
					.from("project_assets")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId as string)
					.not("embedding", "is", null);

				// Try with no threshold to see actual similarity scores
				const { data: topMatches } = await supabase.rpc("find_similar_assets", {
					query_embedding: queryEmbedding as unknown as string,
					project_id_param: projectId as string,
					match_threshold: 0.0, // No threshold
					match_count: 5,
				});

				consola.warn("semantic-search-assets: no results - diagnostics", {
					query,
					projectId,
					matchThreshold,
					totalAssets,
					assetsWithEmbeddings,
					topSimilarityScores: topMatches?.map((m: any) => m.similarity) || [],
					topMatchPreviews:
						topMatches?.slice(0, 2).map((m: any) => ({
							similarity: m.similarity,
							title: m.title,
						})) || [],
				});

				const highestScore = topMatches?.[0]?.similarity || 0;
				const diagnosticMessage =
					(totalAssets || 0) === 0
						? "No assets exist in this project yet."
						: (assetsWithEmbeddings || 0) === 0
							? `Found ${totalAssets} assets, but none have embeddings. Run embedding backfill.`
							: highestScore > 0 && highestScore < matchThreshold
								? `Highest similarity is ${highestScore.toFixed(2)} for "${topMatches?.[0]?.title}", below threshold ${matchThreshold}. Try lowering threshold.`
								: `No assets found matching "${query}". Try different terms.`;

				return {
					success: true,
					message: diagnosticMessage,
					query,
					assets: [],
					totalCount: 0,
					threshold: matchThreshold,
				};
			}

			consola.info(`semantic-search-assets: found ${assets.length} matching assets for "${query}"`);

			return {
				success: true,
				message: `Found ${assets.length} file(s) matching "${query}".`,
				query,
				assets,
				totalCount: assets.length,
				threshold: matchThreshold,
			};
		} catch (error) {
			consola.error("semantic-search-assets: error", error);
			return {
				success: false,
				message: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				query,
				assets: [],
				totalCount: 0,
				threshold: matchThreshold,
			};
		}
	},
});
