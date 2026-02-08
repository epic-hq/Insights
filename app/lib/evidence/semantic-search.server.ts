/**
 * Semantic Evidence Search
 *
 * Utilities for finding relevant evidence using semantic similarity via embeddings.
 * Uses OpenAI text-embedding-3-small (1536 dims) + pgvector cosine similarity.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "supabase/types";
import { generateEmbeddingOrThrow, SIMILARITY_THRESHOLDS } from "~/lib/embeddings/openai.server";

type DbClient = SupabaseClient<Database>;

interface EvidenceSearchResult {
	id: string;
	verbatim: string;
	chunk: string | null;
	gist: string | null;
	anchors: any[];
	pains: string[];
	gains: string[];
	thinks: string[];
	feels: string[];
	similarity: number;
}

/**
 * Search for evidence semantically similar to a query
 */
export async function searchEvidenceSemantic(
	db: DbClient,
	params: {
		query: string;
		interviewId: string;
		matchThreshold?: number;
		matchCount?: number;
	}
): Promise<EvidenceSearchResult[]> {
	const { query, interviewId, matchThreshold = SIMILARITY_THRESHOLDS.SEMANTIC_SEARCH, matchCount = 10 } = params;

	// Generate embedding for the query
	const queryEmbedding = await generateEmbeddingOrThrow(query, {
		label: "evidence-search",
	});

	// Use pgvector similarity search
	const { data, error } = await db.rpc("find_similar_evidence_by_interview", {
		query_embedding: queryEmbedding as any,
		interview_id_param: interviewId,
		match_threshold: matchThreshold,
		match_count: matchCount,
	});

	if (error) {
		console.error("[searchEvidenceSemantic] Error:", error);
		throw new Error(`Evidence search failed: ${error.message}`);
	}

	return (data ?? []) as EvidenceSearchResult[];
}

/**
 * Search for multiple types of evidence in parallel (e.g., for BANT components)
 */
export async function searchEvidenceMultipleQueries(
	db: DbClient,
	params: {
		queries: { label: string; query: string }[];
		interviewId: string;
		matchThreshold?: number;
		matchCountPerQuery?: number;
	}
): Promise<Record<string, EvidenceSearchResult[]>> {
	const { queries, interviewId, matchThreshold = 0.6, matchCountPerQuery = 5 } = params;

	// Execute all searches in parallel
	const results = await Promise.allSettled(
		queries.map(async ({ label, query }) => {
			const evidence = await searchEvidenceSemantic(db, {
				query,
				interviewId,
				matchThreshold,
				matchCount: matchCountPerQuery,
			});
			return { label, evidence };
		})
	);

	// Collect results, filtering out failures
	const collected: Record<string, EvidenceSearchResult[]> = {};
	for (const result of results) {
		if (result.status === "fulfilled") {
			collected[result.value.label] = result.value.evidence;
		} else {
			console.error("[searchEvidenceMultipleQueries] Query failed:", result.reason);
		}
	}

	return collected;
}

/**
 * Search for evidence semantically matching a theme query
 * Used for theme-evidence linking during insight generation
 */
export async function searchEvidenceForTheme(
	db: DbClient,
	params: {
		themeQuery: string;
		interviewId: string;
		matchThreshold?: number;
		matchCount?: number;
	}
): Promise<Array<{ id: string; verbatim: string; similarity: number }>> {
	const { themeQuery, interviewId, matchThreshold = SIMILARITY_THRESHOLDS.EVIDENCE_TO_THEME, matchCount = 20 } = params;

	// Generate embedding for the theme query
	const queryEmbedding = await generateEmbeddingOrThrow(themeQuery, {
		label: "theme-evidence-link",
	});

	// Use pgvector similarity search by interview
	const { data, error } = await db.rpc("find_similar_evidence_by_interview", {
		query_embedding: queryEmbedding as any,
		interview_id_param: interviewId,
		match_threshold: matchThreshold,
		match_count: matchCount,
	});

	if (error) {
		console.error("[searchEvidenceForTheme] Error:", error);
		throw new Error(`Evidence search failed: ${error.message}`);
	}

	return (data ?? []).map((row: any) => ({
		id: row.id,
		verbatim: row.verbatim,
		similarity: row.similarity,
	}));
}

/**
 * Search for BANT-specific evidence across multiple dimensions
 */
export async function searchBANTEvidence(
	db: DbClient,
	interviewId: string
): Promise<{
	budget: EvidenceSearchResult[];
	authority: EvidenceSearchResult[];
	need: EvidenceSearchResult[];
	timeline: EvidenceSearchResult[];
	nextSteps: EvidenceSearchResult[];
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
	];

	const results = await searchEvidenceMultipleQueries(db, {
		queries,
		interviewId,
		matchThreshold: 0.55, // Slightly lower threshold for broader matches
		matchCountPerQuery: 8, // Get top 8 for each category
	});

	return {
		budget: results.budget ?? [],
		authority: results.authority ?? [],
		need: results.need ?? [],
		timeline: results.timeline ?? [],
		nextSteps: results.nextSteps ?? [],
	};
}
