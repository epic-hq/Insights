/**
 * API Route: Find semantically similar evidence for an insight
 *
 * Uses the insight's statement to generate an embedding and find
 * related evidence that isn't already linked to the insight.
 */

import type { LoaderFunctionArgs } from "react-router";
import { getAuthenticatedUser, getServerClient } from "~/lib/supabase/client.server";

/** Generate embedding for a text query using OpenAI */
async function generateQueryEmbedding(queryText: string): Promise<number[]> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY not configured");
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
	});

	if (!response.ok) {
		const error = await response.text();
		throw new Error(`OpenAI embedding failed: ${error}`);
	}

	const data = await response.json();
	return data.data[0].embedding;
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { user, headers } = await getAuthenticatedUser(request);
	if (!user) {
		return Response.json({ error: "Unauthorized" }, { status: 401, headers });
	}
	const { client: supabase } = getServerClient(request);

	const url = new URL(request.url);
	const insightId = url.searchParams.get("insightId");
	const projectId = url.searchParams.get("projectId");

	if (!insightId || !projectId) {
		return Response.json({ error: "Missing insightId or projectId" }, { status: 400, headers });
	}

	try {
		// 1. Fetch the insight to get its statement
		const { data: insight, error: insightError } = await supabase
			.from("themes")
			.select("id, name, statement")
			.eq("id", insightId)
			.single();

		if (insightError || !insight) {
			return Response.json({ error: "Insight not found" }, { status: 404, headers });
		}

		// Use statement or name as the query
		const queryText = insight.statement || insight.name;
		if (!queryText) {
			return Response.json({ evidence: [] }, { headers });
		}

		// 2. Get already-linked evidence IDs to exclude
		const { data: linkedEvidence } = await supabase
			.from("theme_evidence")
			.select("evidence_id")
			.eq("theme_id", insightId);

		const excludeIds = new Set(linkedEvidence?.map((e) => e.evidence_id).filter(Boolean) ?? []);

		// 3. Generate embedding for the insight statement
		const embedding = await generateQueryEmbedding(queryText);

		// 4. Find similar evidence using pgvector
		const { data: similarEvidence, error: searchError } = await supabase.rpc("find_similar_evidence", {
			query_embedding: embedding as any,
			project_id_param: projectId,
			match_threshold: 0.65,
			match_count: 20, // Get more to filter excluded
		});

		if (searchError) {
			console.error("[similar-evidence] Search error:", searchError);
			return Response.json({ error: "Search failed" }, { status: 500, headers });
		}

		// 5. Filter out already-linked evidence and limit to 8
		const filtered = (similarEvidence ?? []).filter((ev: any) => !excludeIds.has(ev.id)).slice(0, 8);

		if (filtered.length === 0) {
			return Response.json({ evidence: [] }, { headers });
		}

		// 6. Fetch full evidence data for display
		const evidenceIds = filtered.map((ev: any) => ev.id);
		const similarityMap = new Map(filtered.map((ev: any) => [ev.id, ev.similarity]));

		const { data: fullEvidence } = await supabase
			.from("evidence")
			.select(
				`
				id,
				gist,
				verbatim,
				chunk,
				context_summary,
				anchors,
				pains,
				gains,
				interview_id,
				interview:interview_id (
					id,
					title,
					thumbnail_url,
					person:person_id (
						name,
						organizations:organization_id (name)
					)
				)
			`
			)
			.in("id", evidenceIds);

		// 7. Format response with similarity scores and attribution
		const evidence = (fullEvidence ?? []).map((ev: any) => {
			let attribution = "";
			let organization: string | null = null;

			if (ev.interview?.person?.name) {
				const person = ev.interview.person;
				attribution = person.organizations?.name ? `${person.name}, ${person.organizations.name}` : person.name;
				organization = person.organizations?.name ?? null;
			} else if (ev.interview?.title) {
				attribution = ev.interview.title;
			}

			return {
				id: ev.id,
				gist: ev.gist,
				verbatim: ev.verbatim,
				chunk: ev.chunk,
				context_summary: ev.context_summary,
				anchors: ev.anchors,
				pains: ev.pains,
				gains: ev.gains,
				interview_id: ev.interview_id,
				interview: ev.interview
					? { id: ev.interview.id, title: ev.interview.title, thumbnail_url: ev.interview.thumbnail_url }
					: null,
				attribution: attribution || "Interview",
				organization,
				similarity: similarityMap.get(ev.id) ?? null,
			};
		});

		// Sort by similarity descending
		evidence.sort((a: any, b: any) => (b.similarity ?? 0) - (a.similarity ?? 0));

		return Response.json({ evidence }, { headers });
	} catch (error) {
		console.error("[similar-evidence] Error:", error);
		return Response.json({ error: "Internal error" }, { status: 500, headers });
	}
}
