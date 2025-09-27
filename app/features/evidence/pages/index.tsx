import type { LoaderFunctionArgs } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Card } from "~/components/ui/card"
import { userContext } from "~/server/user-context"
import type { Evidence } from "~/types"

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const projectId = params.projectId
	if (!projectId) throw new Response("Missing projectId", { status: 400 })
	
	// Check for research question filter
	const url = new URL(request.url)
	const rqId = url.searchParams.get("rq_id")
	
	let query = supabase
		.from("evidence")
		.select("id, verbatim, context_summary, support, confidence, created_at")
		.eq("project_id", projectId)
	
	// If filtering by research question, join through project_answer_evidence -> project_answers
	if (rqId) {
		const { data: evidenceIds, error: linkError } = await supabase
			.from("project_answer_evidence")
			.select("evidence_id, project_answers!inner(research_question_id)")
			.eq("project_answers.research_question_id", rqId)
			.eq("project_id", projectId)
		
		if (linkError) throw new Error(`Failed to load evidence links: ${linkError.message}`)
		
		const ids = evidenceIds?.map(link => link.evidence_id).filter((id): id is string => Boolean(id)) || []
		if (ids.length === 0) {
			// No evidence linked to this research question
			return { evidence: [], filteredByRQ: rqId }
		}
		
		query = query.in("id", ids)
	}
	
	const { data, error } = await query.order("created_at", { ascending: false })
	if (error) throw new Error(`Failed to load evidence: ${error.message}`)
	const evidence = (data ?? []) as (Pick<Evidence, "id" | "verbatim" | "support" | "confidence" | "created_at"> & {
		context_summary?: string | null
	})[]

	// Join evidence_people -> people to get person names and roles for each evidence
	let peopleByEvidence = new Map<
		string,
		{ id: string; name: string | null; role: string | null; personas: Array<{ id: string; name: string }> }[]
	>()
	if (evidence.length) {
		const evidenceIds = evidence.map((e) => e.id)
		const { data: evp, error: epErr } = await supabase
			.from("evidence_people")
			.select("evidence_id, role, person:person_id(id, name)")
			.eq("project_id", projectId)
			.in("evidence_id", evidenceIds)
		if (epErr) throw new Error(`Failed to load evidence_people: ${epErr.message}`)

		// Get all person IDs to fetch their personas
		const personIds = new Set<string>()
		for (const row of (evp ?? []) as Array<{
			evidence_id: string
			role: string | null
			person: { id: string; name: string | null } | null
		}>) {
			if (row.person) personIds.add(row.person.id)
		}

		// Fetch personas for all people
		const personasByPerson = new Map<string, Array<{ id: string; name: string }>>()
		if (personIds.size > 0) {
			const { data: pp, error: ppErr } = await supabase
				.from("people_personas")
				.select("person_id, persona:persona_id(id, name)")
				.eq("project_id", projectId)
				.in("person_id", Array.from(personIds))
			if (ppErr) throw new Error(`Failed to load people_personas: ${ppErr.message}`)

			for (const row of (pp ?? []) as Array<{ person_id: string; persona: { id: string; name: string } | null }>) {
				if (!row.persona) continue
				const list = personasByPerson.get(row.person_id) ?? []
				list.push(row.persona)
				personasByPerson.set(row.person_id, list)
			}
		}

		// Build the final people map with personas
		peopleByEvidence = new Map()
		for (const row of (evp ?? []) as Array<{
			evidence_id: string
			role: string | null
			person: { id: string; name: string | null } | null
		}>) {
			if (!row.person) continue
			const list = peopleByEvidence.get(row.evidence_id) ?? []
			list.push({
				id: row.person.id,
				name: row.person.name ?? null,
				role: row.role ?? null,
				personas: personasByPerson.get(row.person.id) ?? [],
			})
			peopleByEvidence.set(row.evidence_id, list)
		}
	}

	const enriched = evidence.map((e) => ({
		...e,
		people: peopleByEvidence.get(e.id) ?? [],
	})) as Array<
		(Pick<Evidence, "id" | "verbatim" | "support" | "confidence" | "created_at"> & { context_summary?: string | null }) & {
			people: { id: string; name: string | null; role: string | null; personas: Array<{ id: string; name: string }> }[]
		}
	>

	return { evidence: enriched, filteredByRQ: rqId }
}

export default function EvidenceIndex() {
	const { evidence, filteredByRQ } = useLoaderData<typeof loader>()
	return (
		<div className="space-y-4 p-4">
			<div className="flex items-center justify-between">
				<h1 className="font-semibold text-xl">Evidence</h1>
				{filteredByRQ && (
					<Badge variant="outline" className="text-sm">
						Filtered by Research Question
					</Badge>
				)}
			</div>
			<ul className="divide-y divide-gray-200">
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{evidence?.length > 0 ? (
						<div>
							{evidence.map((e) => (
								<Link key={e.id} to={e.id} className="text-primary-600 text-sm hover:underline">
									<Card key={e.id} className="flex items-start justify-between gap-4 p-3">
										<div>
											<div className="line-clamp-2 text-foreground text-md">“{e.verbatim}”</div>
											{e.context_summary && (
												<div className="mt-1 line-clamp-2 text-muted-foreground text-sm">{e.context_summary}</div>
											)}
											{/* People + metadata */}
											<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
												{e.people && e.people.length > 0 ? (
													<div className="truncate">
														{e.people.map((p) => `${p.name ?? "Unknown"}${p.role ? ` (${p.role})` : ""}`).join(", ")}
													</div>
												) : (
													<span className="truncate">Unknown speaker</span>
												)}

												{/* Personas */}
												{e.people?.some((p) => p.personas && p.personas.length > 0) && (
													<>
														<span>•</span>
														<div className="flex flex-wrap gap-1">
															{e.people
																.flatMap((p) => p.personas || [])
																.map((persona) => (
																	<Badge
																		key={persona.id}
																		variant="outline"
																		className="border-green-200 bg-green-50 text-green-800 text-xs"
																	>
																		{persona.name}
																	</Badge>
																))}
														</div>
													</>
												)}

												<span>•</span>
												<span>
													{e.support} • {e.confidence} • {new Date(e.created_at).toLocaleString()}
												</span>
											</div>
										</div>
									</Card>
								</Link>
							))}
						</div>
					) : (
						<div className="px-4 text-foreground/80">No Evidence yet.</div>
					)}
				</div>
			</ul>
		</div>
	)
}
