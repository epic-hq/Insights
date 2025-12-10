/**
 * API endpoint to fetch evidence data for modal display
 * GET /api/evidence/:evidenceId
 */

import type { LoaderFunctionArgs } from "react-router"
import { userContext } from "~/server/user-context"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { evidenceId } = params

	if (!evidenceId) {
		return Response.json({ error: "Missing evidenceId" }, { status: 400 })
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
		`
		)
		.eq("id", evidenceId)
		.single()

	if (error || !evidence) {
		return Response.json({ error: "Evidence not found" }, { status: 404 })
	}

	// Fetch people separately
	const { data: peopleData } = await supabase
		.from("evidence_people")
		.select(
			`
			role,
			people:person_id!inner(
				id,
				name
			)
		`
		)
		.eq("evidence_id", evidenceId)

	// Fetch facets
	const { data: facetData } = await supabase
		.from("evidence_facet")
		.select("kind_slug, label")
		.eq("evidence_id", evidenceId)

	// Transform people data
	const people = (peopleData ?? []).map((row: any) => ({
		id: row.people?.id,
		name: row.people?.name,
		role: row.role,
	}))

	// Transform facets
	const facets = (facetData ?? []).map((row: any) => ({
		kind_slug: row.kind_slug,
		label: row.label,
	}))

	return Response.json({
		evidence: {
			...evidence,
			people,
			facets,
		},
	})
}
