/**
 * API Route: Semantic search for evidence
 *
 * General-purpose semantic search across all evidence in a project.
 * Uses embeddings to find evidence matching the meaning of the query.
 */

import type { LoaderFunctionArgs } from "react-router";
import { userContext } from "~/server/user-context";

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

export async function loader({ request, context }: LoaderFunctionArgs) {
  const ctx = context.get(userContext);
  const supabase = ctx.supabase;

  if (!supabase) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query");
  const projectId = url.searchParams.get("projectId");
  const matchThreshold = Number.parseFloat(
    url.searchParams.get("matchThreshold") || "0.3",
  );
  const matchCount = Number.parseInt(
    url.searchParams.get("matchCount") || "20",
    10,
  );

  if (!query || !projectId) {
    return Response.json(
      { error: "Missing query or projectId" },
      { status: 400 },
    );
  }

  try {
    // 1. Generate embedding for the search query
    const embedding = await generateQueryEmbedding(query);
    console.log("[API] Generated embedding, length:", embedding.length);

    // First, check if any evidence has embeddings at all
    const { count: totalEvidence } = await supabase
      .from("evidence")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .eq("is_archived", false);

    const { count: withEmbeddings } = await supabase
      .from("evidence")
      .select("*", { count: "exact", head: true })
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .eq("is_archived", false)
      .not("embedding", "is", null);

    console.log("[API] Evidence stats:", {
      totalEvidence,
      withEmbeddings,
      percentWithEmbeddings:
        totalEvidence && totalEvidence > 0
          ? Math.round(((withEmbeddings || 0) / totalEvidence) * 100)
          : 0,
    });

    // 2. Search evidence using pgvector (verbatim)
    console.log("[API] Calling find_similar_evidence RPC with:", {
      projectId,
      matchThreshold,
      matchCount,
    });
    const { data: evidenceData, error: evidenceError } = await supabase.rpc(
      "find_similar_evidence",
      {
        query_embedding: embedding as any,
        project_id_param: projectId,
        match_threshold: matchThreshold,
        match_count: matchCount,
      },
    );
    console.log("[API] Evidence RPC response:", {
      error: evidenceError,
      resultCount: evidenceData?.length || 0,
      sampleResults: evidenceData?.slice(0, 2).map((e: any) => ({
        id: e.id,
        similarity: e.similarity,
      })),
    });

    if (evidenceError) {
      console.error("[semantic-search] Evidence search error:", evidenceError);
      throw evidenceError;
    }

    // 3. Search evidence facets (pains, gains, thinks, feels)
    console.log("[API] Calling find_similar_evidence_facets RPC");
    const { data: facetsData, error: facetsError } = await supabase.rpc(
      "find_similar_evidence_facets",
      {
        query_embedding: embedding as any,
        project_id_param: projectId,
        match_threshold: matchThreshold,
        match_count: matchCount,
        kind_slug_filter: undefined, // Search all facet types
      },
    );
    console.log("[API] Facets RPC response:", {
      error: facetsError,
      resultCount: facetsData?.length || 0,
    });

    if (facetsError) {
      console.error("[semantic-search] Facets search error:", facetsError);
      throw facetsError;
    }

    // 4. Combine results from both searches
    const evidenceIds = new Set<string>();
    const similarityMap = new Map<string, number>();

    // Add evidence from verbatim matches
    for (const row of evidenceData || []) {
      evidenceIds.add(row.id);
      similarityMap.set(row.id, row.similarity);
    }

    // Add evidence from facet matches (use higher similarity if duplicate)
    for (const row of facetsData || []) {
      if (row.evidence_id) {
        evidenceIds.add(row.evidence_id);
        const existing = similarityMap.get(row.evidence_id) || 0;
        similarityMap.set(row.evidence_id, Math.max(existing, row.similarity));
      }
    }

    if (evidenceIds.size === 0) {
      return Response.json({
        evidence: [],
        totalCount: 0,
        query,
        threshold: matchThreshold,
      });
    }

    // 5. Fetch full evidence data
    const evidenceIdsArray = Array.from(evidenceIds);
    const { data: fullEvidence, error: fetchError } = await supabase
      .from("evidence")
      .select(
        `
				id,
				gist,
				verbatim,
				chunk,
				topic,
				support,
				confidence,
				created_at,
				journey_stage,
				method,
				anchors,
				interview_id,
				pains,
				gains,
				thinks,
				feels
			`,
      )
      .in("id", evidenceIdsArray)
      .is("deleted_at", null)
      .eq("is_archived", false);

    if (fetchError) {
      console.error("[semantic-search] Fetch error:", fetchError);
      throw fetchError;
    }

    // 6. Format response with similarity scores
    const evidence = (fullEvidence || [])
      .map((ev) => ({
        ...ev,
        similarity: similarityMap.get(ev.id) || 0,
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, matchCount);

    return Response.json({
      evidence,
      totalCount: evidence.length,
      query,
      threshold: matchThreshold,
    });
  } catch (error) {
    console.error("[semantic-search] Error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal error";
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
