import type { LoaderFunctionArgs } from "react-router"
import { useLoaderData } from "react-router-dom"
import { userContext } from "~/server/user-context"
import type { Evidence, Theme } from "~/types"
import { ThemeStudio } from "~/features/themes/components/ThemeStudio"
import { GenerateThemesButton } from "~/features/themes/components/GenerateThemesButton"

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

	return { themes: enriched }
}

export default function ThemesIndex() {
    const { themes } = useLoaderData<typeof loader>()
    
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
    
    return <ThemeStudio themes={themes} />
}
