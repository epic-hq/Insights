import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { useState } from "react"
import { userContext } from "~/server/user-context"
import type { Evidence, Theme } from "~/types"
import { ThemeStudio } from "~/features/themes/components/ThemeStudio"
import { GenerateThemesButton } from "~/features/themes/components/GenerateThemesButton"
import { PersonaThemeMatrix } from "~/features/themes/components/PersonaThemeMatrix"
import { Button } from "~/components/ui/button"
import { Grid3X3, List } from "lucide-react"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const projectId = params.projectId
	if (!projectId) throw new Response("Missing projectId", { status: 400 })

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

	// 3) Load insights for the project (id, interview_id) once to compute counts per theme via evidence->interview
	const { data: insights, error: iErr } = await supabase
		.from("insights")
		.select("id, interview_id, project_id")
		.eq("project_id", projectId)
	if (iErr) throw new Error(`Failed to load insights: ${iErr.message}`)

	// 4) Load all evidence with personas to build matrix data
	const { data: allEvidence, error: eErr } = await supabase
		.from("evidence")
		.select("id, personas, interview_id")
		.eq("project_id", projectId)
	if (eErr) throw new Error(`Failed to load evidence: ${eErr.message}`)

	// Build maps
	const evidenceByTheme = new Map<string, string[]>() // theme_id -> evidence ids
	const interviewsByTheme = new Map<string, Set<string>>() // theme_id -> distinct interview ids
	for (const row of (links ?? []) as Array<{ theme_id: string; evidence: Pick<Evidence, "id" | "interview_id"> | null }>) {
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
			insightsByInterview.set(
				ins.interview_id,
				(insightsByInterview.get(ins.interview_id) ?? 0) + 1,
			)
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
	}) as Array<Pick<Theme, "id" | "name" | "statement" | "created_at"> & { evidence_count: number; insights_count: number }>

	// Build persona-theme matrix data
	const personaSet = new Set<string>()
	const evidenceById = new Map<string, { personas: string[]; interview_id?: string }>()
	
	// Index all evidence by id and collect all personas
	for (const ev of allEvidence ?? []) {
		evidenceById.set(ev.id, { personas: ev.personas ?? [], interview_id: ev.interview_id ?? undefined })
		for (const persona of ev.personas ?? []) {
			personaSet.add(persona)
		}
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
				wedge
			})
		}
		
		matrixData.push({
			persona,
			themes: personaThemes
		})
	}

	return { themes: enriched, matrixData }
}

export default function ThemesIndex() {
    const { themes, matrixData } = useLoaderData<typeof loader>()
    const [showMatrix, setShowMatrix] = useState(false)
    
    // Show generate button when no themes exist
    if (themes.length === 0) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
                <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-semibold text-gray-900">No themes found</h2>
                    <p className="max-w-md text-gray-600">
                        Generate themes automatically from your evidence to identify patterns and insights.
                    </p>
                </div>
                <GenerateThemesButton />
            </div>
        )
    }
    
    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant={showMatrix ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowMatrix(true)}
                        className="flex items-center gap-2"
                    >
                        <Grid3X3 className="h-4 w-4" />
                        Matrix View
                    </Button>
                    <Button
                        variant={showMatrix ? "outline" : "default"}
                        size="sm"
                        onClick={() => setShowMatrix(false)}
                        className="flex items-center gap-2"
                    >
                        <List className="h-4 w-4" />
                        Studio View
                    </Button>
                </div>
            </div>
            
            {showMatrix && matrixData.length > 0 ? (
                <PersonaThemeMatrix matrixData={matrixData} />
            ) : showMatrix ? (
                <div className="text-center text-gray-600 py-12">
                    <p>No persona data available. Add evidence with personas to see the matrix.</p>
                </div>
            ) : (
                <ThemeStudio themes={themes} />
            )}
        </div>
    )
}
