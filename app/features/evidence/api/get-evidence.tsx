/**
 * API endpoint to fetch evidence data for modal display
 * GET /api/evidence/:evidenceId
 */

import type { LoaderFunctionArgs } from "react-router";
import { userContext } from "~/server/user-context";

export async function loader({ context, params }: LoaderFunctionArgs) {
  const { supabase } = context.get(userContext);
  const { evidenceId } = params;

  if (!evidenceId) {
    return Response.json({ error: "Missing evidenceId" }, { status: 400 });
  }

  // Fetch evidence with interview data
  const { data: evidence, error } = await supabase
    .from("evidence")
    .select(
      `
			id,
			verbatim,
			gist,
			chunk,
			topic,
			support,
			confidence,
			journey_stage,
			method,
			anchors,
			interview_id,
			interview:interview_id(
				id,
				title,
				media_url,
				thumbnail_url
			)
		`,
    )
    .eq("id", evidenceId)
    .is("deleted_at", null)
    .single();

  if (error || !evidence) {
    return Response.json({ error: "Evidence not found" }, { status: 404 });
  }

  // Fetch linked people and facets without relational joins.
  const { data: peopleData } = await supabase
    .from("evidence_people")
    .select("role, person_id")
    .eq("evidence_id", evidenceId);
  const { data: facetData } = await supabase
    .from("evidence_facet")
    .select("kind_slug, label, person_id")
    .eq("evidence_id", evidenceId);

  const personIds = new Set<string>();
  for (const row of (peopleData ?? []) as Array<{ person_id: string | null }>) {
    if (row.person_id) personIds.add(row.person_id);
  }
  for (const row of (facetData ?? []) as Array<{ person_id: string | null }>) {
    if (row.person_id) personIds.add(row.person_id);
  }

  const personNameById = new Map<string, string | null>();
  if (personIds.size > 0) {
    const { data: personRows } = await supabase
      .from("people")
      .select("id, name")
      .in("id", Array.from(personIds));
    for (const row of (personRows ?? []) as Array<{
      id: string;
      name: string | null;
    }>) {
      personNameById.set(row.id, row.name ?? null);
    }
  }

  // Transform people data (participants with roles)
  const people = (peopleData ?? [])
    .filter((row: any) => Boolean(row.person_id))
    .map((row: any) => ({
      id: row.person_id,
      name: personNameById.get(row.person_id) ?? null,
      role: row.role,
    }));

  // Transform facets (with owner info)
  const facets = (facetData ?? []).map((row: any) => ({
    kind_slug: row.kind_slug,
    label: row.label,
    person: row.person_id
      ? { id: row.person_id, name: personNameById.get(row.person_id) ?? null }
      : null,
  }));

  return Response.json({
    evidence: {
      ...evidence,
      people,
      facets,
    },
  });
}
