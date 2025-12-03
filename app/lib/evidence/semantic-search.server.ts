/**
 * Semantic Evidence Search
 *
 * Utilities for finding relevant evidence using semantic similarity via embeddings.
 * Uses OpenAI text-embedding-3-small (1536 dims) + pgvector cosine similarity.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "supabase/types"

type DbClient = SupabaseClient<Database>

interface EvidenceSearchResult {
	id: string
	verbatim: string
	chunk: string | null
	gist: string | null
	anchors: any[]
	pains: string[]
	gains: string[]
	thinks: string[]
	feels: string[]
	similarity: number
}

/**
 * Generate embedding for a text query using OpenAI
 */
async function generateQueryEmbedding(queryText: string): Promise<number[]> {
	const apiKey = process.env.OPENAI_API_KEY
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY not configured")
	}

	const response = await fetch("https://api.openai.com/v1/embeddings", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			model: "text-embedding-3-small",
			input: queryText,
		}),
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`OpenAI embedding failed: ${error}`)
	}

	const data = await response.json()
	return data.data[0].embedding
}

/**
 * Search for evidence semantically similar to a query
 */
export async function searchEvidenceSemantic(
	db: DbClient,
	params: {
		query: string
		interviewId: string
		matchThreshold?: number
		matchCount?: number
	}
): Promise<EvidenceSearchResult[]> {
	const { query, interviewId, matchThreshold = 0.6, matchCount = 10 } = params

	// Generate embedding for the query
	const queryEmbedding = await generateQueryEmbedding(query)

	// Use pgvector similarity search
	const { data, error } = await db.rpc("find_similar_evidence_by_interview", {
		query_embedding: queryEmbedding as any,
		interview_id_param: interviewId,
		match_threshold: matchThreshold,
		match_count: matchCount,
	})

	if (error) {
		console.error("[searchEvidenceSemantic] Error:", error)
		throw new Error(`Evidence search failed: ${error.message}`)
	}

	return (data ?? []) as EvidenceSearchResult[]
}

/**
 * Search for multiple types of evidence in parallel (e.g., for BANT components)
 */
export async function searchEvidenceMultipleQueries(
	db: DbClient,
	params: {
		queries: { label: string; query: string }[]
		interviewId: string
		matchThreshold?: number
		matchCountPerQuery?: number
	}
): Promise<Record<string, EvidenceSearchResult[]>> {
	const { queries, interviewId, matchThreshold = 0.6, matchCountPerQuery = 5 } = params

	// Execute all searches in parallel
	const results = await Promise.allSettled(
		queries.map(async ({ label, query }) => {
			const evidence = await searchEvidenceSemantic(db, {
				query,
				interviewId,
				matchThreshold,
				matchCount: matchCountPerQuery,
			})
			return { label, evidence }
		})
	)

	// Collect results, filtering out failures
	const collected: Record<string, EvidenceSearchResult[]> = {}
	for (const result of results) {
		if (result.status === "fulfilled") {
			collected[result.value.label] = result.value.evidence
		} else {
			console.error("[searchEvidenceMultipleQueries] Query failed:", result.reason)
		}
	}

	return collected
}

/**
 * Search for BANT-specific evidence across multiple dimensions
 */
export async function searchBANTEvidence(
	db: DbClient,
	interviewId: string
): Promise<{
	budget: EvidenceSearchResult[]
	authority: EvidenceSearchResult[]
	need: EvidenceSearchResult[]
	timeline: EvidenceSearchResult[]
	nextSteps: EvidenceSearchResult[]
}> {
	const queries = [
		{
			label: "budget",
			query: "budget constraints, pricing concerns, cost, investment, ROI, pricing model, payment terms, financial",
		},
		{
			label: "authority",
			query:
				"decision maker, approval process, stakeholders, sign-off required, who decides, budget authority, procurement",
		},
		{
			label: "need",
			query: "pain points, problems, challenges, goals, needs, requirements, must-have features, critical issues",
		},
		{
			label: "timeline",
			query: "timeline, deadline, urgency, when, timeframe, schedule, launch date, implementation date",
		},
		{
			label: "nextSteps",
			query: "next steps, follow up, action items, who will do what, commitments, meeting scheduled",
		},
	]

	const results = await searchEvidenceMultipleQueries(db, {
		queries,
		interviewId,
		matchThreshold: 0.55, // Slightly lower threshold for broader matches
		matchCountPerQuery: 8, // Get top 8 for each category
	})

	return {
		budget: results.budget ?? [],
		authority: results.authority ?? [],
		need: results.need ?? [],
		timeline: results.timeline ?? [],
		nextSteps: results.nextSteps ?? [],
	}
}
