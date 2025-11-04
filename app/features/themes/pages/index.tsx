import { Grid3X3, List, Search } from "lucide-react"
import { useMemo, useState } from "react"
import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Input } from "~/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { InsightCardV3 } from "~/features/insights/components/InsightCardV3"
import { getInsights } from "~/features/insights/db"
import { PersonaThemeMatrix } from "~/features/themes/components/PersonaThemeMatrix"
import { ThemeStudio } from "~/features/themes/components/ThemeStudio"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const projectId = params.projectId
	if (!projectId) throw new Response("Missing projectId", { status: 400 })
	if (!supabase) throw new Response("Supabase client not available", { status: 500 })

	// 1) Load themes for project
	const { data: themes, error: tErr } = await supabase
		.from("themes")
		.select("id, name, statement, created_at")
		.eq("project_id", projectId)
		.order("created_at", { ascending: false })
	if (tErr) throw new Error(`Failed to load themes: ${tErr.message}`)

	// 2) Load all theme_evidence rows for this project, with evidence.interview_id to derive insights coverage
	const { data: links, error: lErr } = await supabase
		.from("theme_evidence")
		.select("theme_id, evidence:evidence_id(id, interview_id)")
		.eq("project_id", projectId)
	if (lErr) throw new Error(`Failed to load theme links: ${lErr.message}`)

	// 3) Load insights for the project (full data for display)
	const { data: insights, error: iErr } = await getInsights({
		supabase,
		accountId: params.accountId,
		projectId,
	})
	if (iErr) throw new Error(`Failed to load insights: ${iErr.message}`)

	// 4) Load all evidence with personas (legacy) and interview for fallback only
	const { data: allEvidence, error: eErr } = await supabase
		.from("evidence")
		.select("id, personas, interview_id")
		.eq("project_id", projectId)
	if (eErr) throw new Error(`Failed to load evidence: ${eErr.message}`)

	// 5) Gather evidence_ids referenced by themes for this project
	const themedEvidenceIds = new Set<string>()
	for (const row of links ?? []) {
		const evId = row.evidence?.id
		if (evId) themedEvidenceIds.add(evId)
	}

	// 6) Load evidence_people for those evidence_ids to link evidence -> person
	const { data: evPeople, error: epErr } = await supabase
		.from("evidence_people")
		.select("evidence_id, person_id")
		.eq("project_id", projectId)
		.in("evidence_id", Array.from(themedEvidenceIds))
	if (epErr) throw new Error(`Failed to load evidence_people: ${epErr.message}`)

	// Index evidence_id -> set(person_id)
	const peopleByEvidence = new Map<string, Set<string>>()
	const personIdSet = new Set<string>()
	for (const row of evPeople ?? []) {
		const set = peopleByEvidence.get(row.evidence_id) ?? new Set<string>()
		set.add(row.person_id)
		peopleByEvidence.set(row.evidence_id, set)
		personIdSet.add(row.person_id)
	}

	// 7) Load people_personas for those person_ids, including persona names
	let personasByPerson = new Map<string, { id: string; name: string }[]>()
	if (personIdSet.size) {
		const { data: pp, error: ppErr } = await supabase
			.from("people_personas")
			.select("person_id, persona:persona_id(id, name)")
			.eq("project_id", projectId)
			.in("person_id", Array.from(personIdSet))
		if (ppErr) throw new Error(`Failed to load people_personas: ${ppErr.message}`)
		personasByPerson = new Map()
		for (const row of (pp ?? []) as Array<{ person_id: string; persona: { id: string; name: string } | null }>) {
			if (!row.persona) continue
			const list = personasByPerson.get(row.person_id) ?? []
			list.push(row.persona)
			personasByPerson.set(row.person_id, list)
		}
	}

	// Build maps
	const evidenceByTheme = new Map<string, string[]>() // theme_id -> evidence ids
	const interviewsByTheme = new Map<string, Set<string>>() // theme_id -> distinct interview ids
	for (const row of (links ?? []) as Array<{
		theme_id: string
		evidence: Pick<Evidence, "id" | "interview_id"> | null
	}>) {
		const theme_id = row.theme_id
		const evidence = row.evidence
		if (!theme_id || !evidence) continue
		const evList = evidenceByTheme.get(theme_id) ?? []
		evList.push(evidence.id)
		evidenceByTheme.set(theme_id, evList)
		if (evidence.interview_id) {
			const set = interviewsByTheme.get(theme_id) ?? new Set<string>()
			set.add(evidence.interview_id)
			interviewsByTheme.set(theme_id, set)
		}
	}

	// Pre-index insights by interview_id for quick counting
	const insightsByInterview = new Map<string, number>()
	for (const ins of insights ?? []) {
		if (ins.interview_id) {
			insightsByInterview.set(ins.interview_id, (insightsByInterview.get(ins.interview_id) ?? 0) + 1)
		}
	}

	// Enrich themes with counts
	const enriched = (themes ?? []).map((t) => {
		const evCount = (evidenceByTheme.get(t.id) ?? []).length
		let insightCount = 0
		const interviewSet = interviewsByTheme.get(t.id)
		if (interviewSet) {
			for (const iid of interviewSet) {
				insightCount += insightsByInterview.get(iid) ?? 0
			}
		}
		return { ...t, evidence_count: evCount, insights_count: insightCount }
	}) as Array<
		Pick<Theme, "id" | "name" | "statement" | "created_at"> & { evidence_count: number; insights_count: number }
	>

	// Build persona-theme matrix data
	const personaSet = new Set<string>()
	const evidenceById = new Map<string, { personas: string[]; interview_id?: string }>()

	// Build normalized personas per evidence via evidence_people -> people_personas
	for (const ev of allEvidence ?? []) {
		const linkedPeople = peopleByEvidence.get(ev.id)
		const normalizedPersonas = new Set<string>()
		if (linkedPeople?.size) {
			for (const pid of linkedPeople) {
				const plist = personasByPerson.get(pid) ?? []
				for (const p of plist) normalizedPersonas.add(p.name)
			}
		}
		// Fallback to legacy evidence.personas if no normalized mapping
		const finalPersonas = normalizedPersonas.size ? Array.from(normalizedPersonas) : (ev.personas ?? [])
		evidenceById.set(ev.id, { personas: finalPersonas, interview_id: ev.interview_id ?? undefined })
		for (const persona of finalPersonas) personaSet.add(persona)
	}

	const personas = Array.from(personaSet)
	const matrixData: Array<{
		persona: string
		themes: Array<{
			themeId: string
			themeName: string
			nEff: number
			coverage: number
			wedge: boolean
		}>
	}> = []

	// Calculate metrics for each persona
	for (const persona of personas) {
		const personaThemes = []

		for (const theme of enriched) {
			const themeEvidenceIds = evidenceByTheme.get(theme.id) ?? []

			// Count evidence for this persona in this theme
			let personaEvidenceCount = 0
			let totalInterviews = 0
			const personaInterviews = new Set<string>()

			for (const evidenceId of themeEvidenceIds) {
				const evidence = evidenceById.get(evidenceId)
				if (evidence?.personas?.includes(persona)) {
					personaEvidenceCount++
					if (evidence.interview_id) {
						personaInterviews.add(evidence.interview_id)
					}
				}
			}

			// Calculate total unique interviews for this theme
			const themeInterviews = interviewsByTheme.get(theme.id) ?? new Set()
			totalInterviews = themeInterviews.size

			// Calculate coverage (% of interviews for this theme that include this persona)
			const coverage = totalInterviews > 0 ? personaInterviews.size / totalInterviews : 0

			// Calculate n_eff (simple count for now, could use cohort logic later)
			const nEff = personaEvidenceCount

			// Determine if it's a wedge (strong signal for this persona)
			// Using simple heuristics: high evidence count AND high coverage
			const wedge = nEff >= 3 && coverage >= 0.7

			personaThemes.push({
				themeId: theme.id,
				themeName: theme.name,
				nEff,
				coverage,
				wedge,
			})
		}

		matrixData.push({
			persona,
			themes: personaThemes,
		})
	}

	return { themes: enriched, matrixData, insights }
}

export default function ThemesIndex() {
	const { themes, matrixData, insights } = useLoaderData<typeof loader>()
	const [viewMode, setViewMode] = useState<"insights" | "matrix" | "cards">("insights")
	const [searchQuery, setSearchQuery] = useState("")

	const filteredInsights = useMemo(() => {
		const normalized = searchQuery.trim().toLowerCase()
		if (!normalized) return insights

		return insights.filter((insight: Insight & { [key: string]: any }) => {
			const haystack = [
				insight.name,
				insight.pain,
				insight.details,
				insight.category,
				insight.emotional_response,
				insight.desired_outcome,
				insight.jtbd,
				insight.evidence,
				insight.motivation,
				insight?.persona_insights?.map((pi: any) => pi.personas?.name).join(" "),
				insight?.linked_themes?.map((theme: any) => theme.name).join(" "),
			]

			return haystack.some((text) => typeof text === "string" && text.toLowerCase().includes(normalized))
		})
	}, [insights, searchQuery])

	// Show generate button when no themes exist
	if (themes.length === 0) {
		return (
			<PageContainer className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
				<h2 className="font-semibold text-2xl text-foreground">No themes yet</h2>
				<p className="max-w-md text-foreground/70 text-sm">
					Add themes or connect evidence to personas to unlock persona coverage insights.
				</p>
			</PageContainer>
		)
	}

	return (
		<PageContainer className="space-y-8">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div>
					<h1 className="font-semibold text-3xl text-foreground">Topics by Persona</h1>
					{/* <p className="max-w-2xl text-sm text-foreground/70">
						Compare how personas engage with your themes. Purple highlights call out wedge opportunities where a persona
						over-indexes.
					</p> */}
				</div>
				<div className="relative w-full max-w-md">
					<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
					<Input
						className="pl-9"
						placeholder="Search by insight, pain, tags, personas…"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
			</div>
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-1.5">
					<h2 className="font-medium text-foreground text-xl">Project Insights</h2>
					<p className="max-w-2xl text-foreground/70 text-sm">
						Browse the latest validated findings. Open a card to review context, linked themes, and leave feedback for
						your team.
					</p>
				</div>
				<ToggleGroup
					type="single"
					value={viewMode}
					onValueChange={(next) => next && setViewMode(next as "insights" | "matrix" | "cards")}
					size="sm"
					className="shrink-0"
				>
					<ToggleGroupItem value="insights" aria-label="Insights view" className="gap-2">
						<Grid3X3 className="h-4 w-4" />
						Insights
					</ToggleGroupItem>
					<ToggleGroupItem value="matrix" aria-label="Matrix view" className="gap-2">
						<List className="h-4 w-4" />
						Matrix
					</ToggleGroupItem>
					<ToggleGroupItem value="cards" aria-label="Cards view" className="gap-2">
						<List className="h-4 w-4" />
						Cards
					</ToggleGroupItem>
				</ToggleGroup>
			</div>

			{viewMode === "insights" ? (
				filteredInsights.length === 0 ? (
					<div className="rounded-lg border border-dashed bg-muted/30 py-16 text-center text-muted-foreground">
						<p className="font-medium">No insights match your filters</p>
						{searchQuery ? <p className="mt-2 text-sm">Try a different keyword or clear the search field.</p> : null}
					</div>
				) : (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{filteredInsights.map((insight) => (
							<InsightCardV3 key={insight.id} insight={insight} />
						))}
					</div>
				)
			) : viewMode === "matrix" && matrixData.length > 0 ? (
				<PersonaThemeMatrix matrixData={matrixData} />
			) : viewMode === "matrix" ? (
				<div className="py-12 text-center text-foreground/60">
					<p>No persona data available. Add evidence with personas to see the matrix.</p>
				</div>
			) : (
				<ThemeStudio themes={themes} />
			)}
		</PageContainer>
	)
}
