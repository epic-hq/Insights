import { useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Link, useFetcher, useLoaderData, useSearchParams } from "react-router-dom"
import { BackButton } from "~/components/ui/BackButton"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Evidence } from "~/types"
import { regenerateEvidenceForProject } from "~/utils/regenerateEvidence.server"
import EvidenceCard from "../components/EvidenceCard"

type EvidenceListPerson = {
	id: string
	name: string | null
	role: string | null
	personas: Array<{ id: string; name: string }>
}

type EvidenceListItem = (Pick<
	Evidence,
	| "id"
	| "verbatim"
	| "gist"
	| "chunk"
	| "topic"
	| "support"
	| "confidence"
	| "created_at"
	| "journey_stage"
	| "kind_tags"
	| "method"
	| "anchors"
	| "interview_id"
> & {
	context_summary?: string | null
	interview?: {
		id: string
		title: string | null
		media_url: string | null
		duration_sec: number | null
	} | null
}) & {
	people: EvidenceListPerson[]
}

type EvidenceRow = Omit<EvidenceListItem, "people">

export async function action({ context, params, request }: ActionFunctionArgs) {
	if (request.method.toUpperCase() !== "POST") {
		return { ok: false, error: "Unsupported method" }
	}

	const formData = await request.formData()
	if (formData.get("intent") !== "regenerate") {
		return { ok: false }
	}

	const accountId = params.accountId
	const projectId = params.projectId
	if (!accountId || !projectId) {
		throw new Response("Missing account or project context", { status: 400 })
	}

	const { supabase } = context.get(userContext)
	const result = await regenerateEvidenceForProject({
		supabase,
		accountId,
		projectId,
		userId: undefined,
	})

	return { ok: true, ...result }
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const projectId = params.projectId
	if (!projectId) throw new Response("Missing projectId", { status: 400 })

	// Check for research question filter
	const url = new URL(request.url)
	const rqId = url.searchParams.get("rq_id")

	// Sort and filter params
	const sortBy = url.searchParams.get("sort_by") || "created_at"
	const sortDir = (url.searchParams.get("sort_dir") || "desc").toLowerCase() === "asc" ? "asc" : "desc"
	const filterSupport = url.searchParams.get("support")
	const filterConfidence = url.searchParams.get("confidence")
	const filterMethod = url.searchParams.get("method")

	let query = supabase
		.from("evidence")
		.select(
			`
				id,
				verbatim,
				gist,
				chunk,
				topic,
				context_summary,
				support,
				confidence,
				created_at,
				journey_stage,
				kind_tags,
				method,
				anchors,
				interview_id,
				interview:interview_id (
					id,
					title,
					media_url,
					duration_sec
				)
			`
		)
		.eq("project_id", projectId)

	// If filtering by research question, join through project_answer_evidence -> project_answers
	if (rqId) {
		const { data: evidenceIds, error: linkError } = await supabase
			.from("project_answer_evidence")
			.select("evidence_id, project_answers!inner(research_question_id)")
			.eq("project_answers.research_question_id", rqId)
			.eq("project_id", projectId)

		if (linkError) throw new Error(`Failed to load evidence links: ${linkError.message}`)

		const ids = evidenceIds?.map((link) => link.evidence_id).filter((id): id is string => Boolean(id)) || []
		if (ids.length === 0) {
			// No evidence linked to this research question
			return { evidence: [], filteredByRQ: rqId }
		}

		query = query.in("id", ids)
	}

	// Apply simple filters
	if (filterSupport) query = query.eq("support", filterSupport)
	if (filterConfidence) query = query.eq("confidence", filterConfidence)
	if (filterMethod) query = query.eq("method", filterMethod)

	// Sorting
	const sortable = new Set(["created_at", "confidence"]) // extendable
	const sortField = sortable.has(sortBy) ? sortBy : "created_at"
	const { data, error } = await query.order(sortField, { ascending: sortDir === "asc" })
	if (error) throw new Error(`Failed to load evidence: ${error.message}`)
	const rows = (data ?? []) as EvidenceRow[]

	// Join evidence_people -> people to get person names and roles for each evidence
	const peopleByEvidence = new Map<string, EvidenceListPerson[]>()
	if (rows.length) {
		const evidenceIds = rows.map((e) => e.id)
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

	const enriched: EvidenceListItem[] = rows.map((row) => ({
		...row,
		people: peopleByEvidence.get(row.id) ?? [],
	}))

	return { evidence: enriched, filteredByRQ: rqId }
}

export default function EvidenceIndex() {
	const { evidence, filteredByRQ } = useLoaderData<typeof loader>()
	const fetcher = useFetcher<typeof action>()
	const isRegenerating = fetcher.state !== "idle"
	const [viewMode, setViewMode] = useState<"mini" | "expanded">("mini")
	const [searchParams, setSearchParams] = useSearchParams()
	const currentProject = useCurrentProject()
	const routes = useProjectRoutes(currentProject?.projectPath || "")
	const listClassName = viewMode === "expanded" ? "space-y-4" : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"

	// Controlled select helpers
	const sortBy = searchParams.get("sort_by") || "created_at"
	const sortDir = searchParams.get("sort_dir") || "desc"
	const support = searchParams.get("support") || ""
	const confidence = searchParams.get("confidence") || ""
	const method = searchParams.get("method") || ""

	const updateParam = (key: string, value: string) => {
		const next = new URLSearchParams(searchParams)
		if (value) next.set(key, value)
		else next.delete(key)
		setSearchParams(next)
	}

	return (
		<div className="space-y-6 p-4">
			<div className="relative">
				<BackButton to={routes.insights.index()} label="Back" position="absolute" />
			</div>
			<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<div className="space-y-2">
					<h1 className="font-semibold text-xl">Evidence</h1>
					{filteredByRQ && (
						<Badge variant="outline" className="w-fit text-sm">
							Filtered by Research Question
						</Badge>
					)}
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					{/* Sort & Filters */}
					<div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
						<label className="text-muted-foreground text-xs">Sort by</label>
						<select
							value={sortBy}
							onChange={(e) => updateParam("sort_by", e.target.value)}
							className="rounded border bg-background p-1 text-sm"
						>
							<option value="created_at">Created</option>
							<option value="confidence">Confidence</option>
						</select>
						<select
							value={sortDir}
							onChange={(e) => updateParam("sort_dir", e.target.value)}
							className="rounded border bg-background p-1 text-sm"
						>
							<option value="desc">Desc</option>
							<option value="asc">Asc</option>
						</select>

						<label className="ml-2 text-muted-foreground text-xs">Support</label>
						<select
							value={support}
							onChange={(e) => updateParam("support", e.target.value)}
							className="rounded border bg-background p-1 text-sm"
						>
							<option value="">All</option>
							<option value="supports">Supports</option>
							<option value="neutral">Neutral</option>
							<option value="refutes">Refutes</option>
						</select>

						<label className="ml-2 text-muted-foreground text-xs">Confidence</label>
						<select
							value={confidence}
							onChange={(e) => updateParam("confidence", e.target.value)}
							className="rounded border bg-background p-1 text-sm"
						>
							<option value="">All</option>
							<option value="high">High</option>
							<option value="medium">Medium</option>
							<option value="low">Low</option>
						</select>

						<label className="ml-2 text-muted-foreground text-xs">Method</label>
						<select
							value={method}
							onChange={(e) => updateParam("method", e.target.value)}
							className="rounded border bg-background p-1 text-sm"
						>
							<option value="">All</option>
							<option value="interview">Interview</option>
							<option value="secondary">Secondary</option>
						</select>
					</div>
					<div className="flex items-center gap-2 rounded-md border border-border p-1">
						<Button
							type="button"
							variant={viewMode === "mini" ? "default" : "ghost"}
							size="sm"
							onClick={() => setViewMode("mini")}
							aria-pressed={viewMode === "mini"}
						>
							Mini view
						</Button>
						<Button
							type="button"
							variant={viewMode === "expanded" ? "default" : "ghost"}
							size="sm"
							onClick={() => setViewMode("expanded")}
							aria-pressed={viewMode === "expanded"}
						>
							Expanded view
						</Button>
					</div>
					<fetcher.Form method="post" className="flex items-center">
						<input type="hidden" name="intent" value="regenerate" />
						<Button type="submit" variant="secondary" size="sm" disabled={isRegenerating}>
							{isRegenerating ? "Regenerating…" : "Regenerate Evidence"}
						</Button>
					</fetcher.Form>
				</div>
			</div>
			{fetcher.data?.ok && (
				<p className="text-muted-foreground text-xs">
					Refreshed {fetcher.data.processed} interview{fetcher.data.processed === 1 ? "" : "s"}
					{fetcher.data.skipped ? `, skipped ${fetcher.data.skipped}` : ""}
					{fetcher.data.errors?.length ? ` (${fetcher.data.errors.length} failed)` : ""}
				</p>
			)}
			{evidence.length === 0 ? (
				<div className="rounded-lg border border-border border-dashed px-6 py-12 text-center text-muted-foreground text-sm">
					No evidence yet.
				</div>
			) : (
				<div className={listClassName}>
					{evidence.map((item) => (
						<Link
							key={item.id}
							to={item.id}
							className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
						>
							<EvidenceCard
								evidence={item}
								people={item.people}
								interview={item.interview ?? null}
								variant={viewMode}
								className="h-full"
							/>
						</Link>
					))}
				</div>
			)}
		</div>
	)
}
