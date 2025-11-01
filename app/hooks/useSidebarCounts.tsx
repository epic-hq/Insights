// app/hooks/useSidebarCounts.ts
import { useEffect, useMemo, useState } from "react"
import { createClient } from "~/lib/supabase/client"

type Counts = {
	// Discovery
	encounters?: number
	personas?: number
	themes?: number
	insights?: number

	// Directory
	people?: number
	organizations?: number

	// Revenue (future)
	accounts?: number
	deals?: number
	contacts?: number
}

export function useSidebarCounts(projectId?: string, workflowType?: string | null) {
	const [counts, setCounts] = useState<Counts>({})
	const [loading, setLoading] = useState(false)

	useEffect(() => {
		if (!projectId) return
		let isCancelled = false

		;(async () => {
			setLoading(true)
			try {
				const supabase = createClient()
				// Execute all count queries in parallel
				const [interviewsResult, personasResult, themesResult, insightsResult, peopleResult, organizationsResult] =
					await Promise.all([
						// Count interviews
						supabase
							.from("interviews")
							.select("*", { count: "exact", head: true })
							.eq("project_id", projectId),

						// Count personas
						supabase
							.from("personas")
							.select("*", { count: "exact", head: true })
							.eq("project_id", projectId),

						// Count themes
						supabase
							.from("themes")
							.select("*", { count: "exact", head: true })
							.eq("project_id", projectId),

						// Count insights
						supabase
							.from("insights")
							.select("*", { count: "exact", head: true })
							.eq("project_id", projectId),

						// Count people
						supabase
							.from("people")
							.select("*", { count: "exact", head: true })
							.eq("project_id", projectId),

						// Count organizations
						supabase
							.from("organizations")
							.select("*", { count: "exact", head: true })
							.eq("project_id", projectId),
					])

				if (!isCancelled) {
					setCounts({
						encounters: interviewsResult.count || 0,
						personas: personasResult.count || 0,
						themes: themesResult.count || 0,
						insights: insightsResult.count || 0,
						people: peopleResult.count || 0,
						organizations: organizationsResult.count || 0,
					})
				}
			} catch (error) {
				console.error("[useSidebarCounts] Error fetching counts:", error)
				if (!isCancelled) {
					setCounts({})
				}
			} finally {
				if (!isCancelled) {
					setLoading(false)
				}
			}
		})()

		return () => {
			isCancelled = true
		}
	}, [projectId, workflowType])

	// Only surface counts > 0 to reduce noise.
	const visible = useMemo(() => {
		const out: Counts = {}
		for (const [k, v] of Object.entries(counts)) {
			if (typeof v === "number" && v > 0) (out as any)[k] = v
		}
		return out
	}, [counts])

	return { counts: visible, loading }
}
