import { createTool } from "@mastra/core/tools"
import type { SupabaseClient } from "@supabase/supabase-js"
import consola from "consola"
import { z } from "zod"
import { supabaseAdmin } from "~/lib/supabase/client.server"
import type { Database } from "~/types"

const DEFAULT_MATCH_COUNT = 10
const DEFAULT_MATCH_THRESHOLD = 0.5

export const semanticSearchPeopleTool = createTool({
	id: "semantic-search-people",
	description:
		"Semantically search for people by their demographic and behavioral traits using natural language queries. Searches person facets like roles, titles, company size, industry, behaviors, etc. Great for finding 'CTOs at enterprise companies', 'product managers in fintech', 'early adopters', etc.",
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				"Natural language search query for people traits (e.g., 'CTOs', 'product managers', 'enterprise buyers', 'early adopters', 'technical decision makers')"
			),
		projectId: z
			.string()
			.optional()
			.describe("Project ID to search within. Defaults to the current project in context."),
		kindSlugFilter: z
			.string()
			.optional()
			.describe(
				"Optional: Filter by facet kind (e.g., 'role', 'title', 'company_size', 'industry'). Leave empty to search all facet types."
			),
		matchThreshold: z
			.number()
			.min(0)
			.max(1)
			.optional()
			.describe(
				"Similarity threshold (0-1). Higher = more strict. Default: 0.5. Recommended: 0.4-0.6 for broad searches, 0.6-0.8 for precise matches."
			),
		matchCount: z.number().int().min(1).max(50).optional().describe("Maximum number of people to return. Default: 10"),
	}),
	outputSchema: z.object({
		success: z.boolean(),
		message: z.string(),
		query: z.string(),
		people: z.array(
			z.object({
				id: z.string(),
				name: z.string().nullable(),
				matchingFacets: z.array(
					z.object({
						kind: z.string(),
						label: z.string(),
						similarity: z.number(),
					})
				),
				highestSimilarity: z.number(),
			})
		),
		totalCount: z.number(),
		threshold: z.number(),
	}),
	execute: async (input, context?) => {
		const supabase = supabaseAdmin as SupabaseClient<Database>
		const runtimeProjectId = context?.requestContext?.get?.("project_id")

		const projectId = input.projectId ?? runtimeProjectId ?? null
		const query = input.query?.trim()
		const kindSlugFilter = input.kindSlugFilter?.trim() || null
		const matchThreshold = input.matchThreshold ?? DEFAULT_MATCH_THRESHOLD
		const matchCount = input.matchCount ?? DEFAULT_MATCH_COUNT

		consola.debug("semantic-search-people: execute start", {
			projectId,
			query,
			kindSlugFilter,
			matchThreshold,
			matchCount,
		})

		if (!query) {
			consola.warn("semantic-search-people: missing query")
			return {
				success: false,
				message: "Query parameter is required for semantic search.",
				query: "",
				people: [],
				totalCount: 0,
				threshold: matchThreshold,
			}
		}

		if (!projectId) {
			consola.warn("semantic-search-people: missing projectId")
			return {
				success: false,
				message: "Project ID is required. Please provide projectId or ensure it's available in runtime context.",
				query,
				people: [],
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

			consola.debug("semantic-search-people: generating query embedding")
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

			// 2. Search for similar person facets using pgvector
			consola.debug("semantic-search-people: searching for similar person facets", {
				embeddingLength: queryEmbedding.length,
				embeddingPreview: queryEmbedding.slice(0, 5),
			})

			consola.debug("semantic-search-people: calling find_similar_person_facets RPC", {
				projectId,
				matchThreshold,
				matchCount: matchCount * 3, // Get more facets to ensure we have enough unique people
				kindSlugFilter,
			})

			const { data: facetsData, error: facetsError } = await supabase.rpc("find_similar_person_facets", {
				query_embedding: `[${queryEmbedding.join(",")}]`,
				project_id_param: projectId,
				match_threshold: matchThreshold,
				match_count: matchCount * 3, // Get more facets than people requested
				kind_slug_filter: kindSlugFilter ?? null,
			})

			consola.debug("semantic-search-people: RPC response", {
				hasError: !!facetsError,
				dataLength: facetsData?.length || 0,
				error: facetsError,
				sampleResults: facetsData?.slice(0, 3).map((f: any) => ({
					personId: f.person_id,
					kind: f.kind_slug,
					label: f.label,
					similarity: f.similarity,
				})),
			})

			if (facetsError) {
				consola.error("semantic-search-people: database error", facetsError)
				throw facetsError
			}

			if (!facetsData || facetsData.length === 0) {
				// Check if there are any person facets at all
				const { count: totalFacetsCount } = await supabase
					.from("person_facet")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId as string)

				const { count: facetsWithEmbeddings } = await supabase
					.from("person_facet")
					.select("*", { count: "exact", head: true })
					.eq("project_id", projectId as string)
					.not("embedding", "is", null)

				consola.warn("semantic-search-people: no results found", {
					query,
					projectId,
					matchThreshold,
					matchCount,
					totalFacetsCount,
					facetsWithEmbeddings,
					diagnostics: {
						hasFacets: (totalFacetsCount || 0) > 0,
						hasEmbeddings: (facetsWithEmbeddings || 0) > 0,
						percentWithEmbeddings:
							totalFacetsCount && totalFacetsCount > 0
								? Math.round(((facetsWithEmbeddings || 0) / totalFacetsCount) * 100)
								: 0,
					},
				})

				const diagnosticMessage =
					(totalFacetsCount || 0) === 0
						? "No people data exists in this project yet."
						: (facetsWithEmbeddings || 0) === 0
							? `Found ${totalFacetsCount} person facets, but none have embeddings generated yet. Embeddings are being processed in the background.`
							: `No people found matching "${query}". Try lowering the similarity threshold (current: ${matchThreshold}) or using different search terms.`

				return {
					success: true,
					message: diagnosticMessage,
					query,
					people: [],
					totalCount: 0,
					threshold: matchThreshold,
				}
			}

			// 3. Group facets by person and get unique people
			const personFacetsMap = new Map<string, Array<{ kind_slug: string; label: string; similarity: number }>>()
			facetsData.forEach((f) => {
				if (!f.person_id) return
				const existing = personFacetsMap.get(f.person_id) || []
				existing.push({
					kind_slug: f.kind_slug,
					label: f.label,
					similarity: f.similarity,
				})
				personFacetsMap.set(f.person_id, existing)
			})

			const uniquePersonIds = Array.from(personFacetsMap.keys()).slice(0, matchCount)

			consola.debug("semantic-search-people: fetching person details", {
				uniquePeopleCount: uniquePersonIds.length,
			})

			// 4. Fetch person details
			const { data: peopleData, error: peopleError } = await supabase
				.from("people")
				.select("id, name")
				.in("id", uniquePersonIds)

			if (peopleError) {
				consola.error("semantic-search-people: error fetching people", peopleError)
				throw peopleError
			}

			consola.debug("semantic-search-people: people fetched", {
				peopleCount: peopleData?.length || 0,
			})

			// 5. Map people with their matching facets
			const people = (peopleData || [])
				.map((person) => {
					const facets = personFacetsMap.get(person.id) || []
					if (facets.length === 0) return null

					const matchingFacets = facets.map((f) => ({
						kind: f.kind_slug,
						label: f.label,
						similarity: f.similarity,
					}))

					const highestSimilarity = Math.max(...facets.map((f) => f.similarity))

					return {
						id: person.id,
						name: person.name,
						matchingFacets,
						highestSimilarity,
					}
				})
				.filter((p): p is NonNullable<typeof p> => p !== null)
				.sort((a, b) => b.highestSimilarity - a.highestSimilarity)

			const message = kindSlugFilter
				? `Found ${people.length} people with ${kindSlugFilter} facets matching "${query}".`
				: `Found ${people.length} people with traits matching "${query}".`

			return {
				success: true,
				message,
				query,
				people,
				totalCount: people.length,
				threshold: matchThreshold,
			}
		} catch (error) {
			consola.error("semantic-search-people: unexpected error", error)
			const errorMessage = error instanceof Error ? error.message : "Unexpected error during people search."
			return {
				success: false,
				message: errorMessage,
				query: query || "",
				people: [],
				totalCount: 0,
				threshold: matchThreshold,
			}
		}
	},
})
