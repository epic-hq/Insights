import { useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Form, useLoaderData, useNavigation } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { ThemeCard, type ThemeCardTheme } from "~/features/themes/components/ThemeCard"
import { userContext } from "~/server/user-context"
import type { Evidence } from "~/types"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { themeId } = params
	if (!themeId) throw new Response("Missing themeId", { status: 400 })

	// Get theme with evidence and insights counts
	const { data: theme, error: terr } = await supabase.from("themes").select("*").eq("id", themeId).single()
	if (terr) throw new Error(`Failed to load theme: ${terr.message}`)

	// Get evidence count
	const { count: evidenceCount } = await supabase
		.from("theme_evidence")
		.select("*", { count: "exact", head: true })
		.eq("theme_id", themeId)

	// Get insights count (proxy via interviews)
	const { data: interviewIds } = await supabase
		.from("theme_evidence")
		.select("evidence:evidence_id(interview_id)")
		.eq("theme_id", themeId)

	type LinkRow = { evidence: { interview_id: string } | null }
	const uniqueInterviewIds = Array.from(
		new Set(((interviewIds ?? []) as LinkRow[]).map((link) => link.evidence?.interview_id).filter(Boolean))
	) as string[]

	let insightsCount = 0
	if (uniqueInterviewIds.length > 0) {
		const { count } = await supabase
			.from("themes")
			.select("*", { count: "exact", head: true })
			.in("interview_id", uniqueInterviewIds)
		insightsCount = count ?? 0
	}

	// Get evidence options for linking form
	let evidenceQuery = supabase
		.from("evidence")
		.select("id, verbatim, support, confidence, project_id")
		.order("created_at", { ascending: false })
		.limit(25)
	if (theme?.project_id) {
		evidenceQuery = evidenceQuery.eq("project_id", theme.project_id)
	}
	const { data: evidenceOptions, error: eerr } = await evidenceQuery
	if (eerr) throw new Error(`Failed to load evidence options: ${eerr.message}`)

	return {
		theme: {
			...theme,
			evidence_count: evidenceCount ?? 0,
			insights_count: insightsCount,
		} as ThemeCardTheme,
		evidenceOptions: (evidenceOptions ?? []) as Pick<
			Evidence,
			"id" | "verbatim" | "support" | "confidence" | "project_id"
		>[],
	}
}

export async function action({ context, params, request }: ActionFunctionArgs) {
	const { supabase, account_id } = context.get(userContext)
	const { themeId } = params
	if (!themeId) throw new Response("Missing themeId", { status: 400 })
	const form = await request.formData()
	const evidenceId = String(form.get("evidence_id") || "").trim()
	const rationale = (form.get("rationale") as string) || null
	const confidenceRaw = form.get("confidence") as string | null
	const confidence = confidenceRaw ? Number(confidenceRaw) : null
	if (!evidenceId) return new Response("Evidence is required", { status: 400 })

	// Get project_id from the theme to include in junction row
	const { data: trow } = await supabase.from("themes").select("project_id").eq("id", themeId).single()
	const project_id = trow?.project_id ?? null

	const { error } = await supabase.from("theme_evidence").upsert(
		[
			{
				account_id,
				project_id,
				theme_id: themeId,
				evidence_id: evidenceId,
				rationale,
				confidence,
			},
		],
		{ onConflict: "theme_id,evidence_id,account_id" }
	)
	if (error) throw new Error(`Failed to link evidence: ${error.message}`)
	return { ok: true }
}

export default function ThemeDetail() {
	const { theme, evidenceOptions } = useLoaderData<typeof loader>()
	const nav = useNavigation()
	const [showAddEvidence, setShowAddEvidence] = useState(false)

	return (
		<div className="mx-auto max-w-4xl space-y-8 p-6">
			{/* Theme Card in Expanded Mode */}
			<ThemeCard theme={theme} defaultExpanded={true} />

			{/* Evidence Linking Form */}
			<Button onClick={() => setShowAddEvidence(!showAddEvidence)}>Add Evidence</Button>
			{showAddEvidence ? (
				<div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
					<h2 className="mb-4 font-medium text-foreground text-lg">Link New Evidence</h2>
					<Form method="post" className="grid gap-4 sm:grid-cols-2">
						<label className="flex flex-col gap-2">
							<span className="font-medium text-gray-700 text-sm dark:text-gray-300">Evidence</span>
							<select
								name="evidence_id"
								className="rounded-lg border border-gray-300 p-3 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
							>
								<option value="">Select evidence to link…</option>
								{evidenceOptions.map((e) => (
									<option key={e.id} value={e.id}>
										{e.verbatim?.slice(0, 80) || e.id}
									</option>
								))}
							</select>
						</label>

						<label className="flex flex-col gap-2">
							<span className="font-medium text-gray-700 text-sm dark:text-gray-300">Confidence (0–1)</span>
							<input
								name="confidence"
								type="number"
								min="0"
								max="1"
								step="0.1"
								placeholder="0.8"
								className="rounded-lg border border-gray-300 p-3 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
							/>
						</label>

						<label className="flex flex-col gap-2 sm:col-span-2">
							<span className="font-medium text-gray-700 text-sm dark:text-gray-300">Rationale</span>
							<textarea
								name="rationale"
								rows={3}
								placeholder="Explain why this evidence supports the theme..."
								className="rounded-lg border border-gray-300 p-3 text-sm transition-colors focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
							/>
						</label>

						<div className="sm:col-span-2">
							<button
								type="submit"
								disabled={nav.state === "submitting"}
								className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{nav.state === "submitting" ? "Linking…" : "Link Evidence"}
							</button>
						</div>
					</Form>
				</div>
			) : null}
		</div>
	)
}
