import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { Form, Link, useLoaderData, useNavigation } from "react-router-dom"
import { userContext } from "~/server/user-context"
import type { Evidence, Theme } from "~/types"

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const { themeId } = params
	if (!themeId) throw new Response("Missing themeId", { status: 400 })
	const { data: theme, error: terr } = await supabase.from("themes").select("*").eq("id", themeId).single()
	if (terr) throw new Error(`Failed to load theme: ${terr.message}`)
	const { data: links, error: lerr } = await supabase
		.from("theme_evidence")
		.select("evidence:evidence_id(id, verbatim, support, confidence), rationale, confidence")
		.eq("theme_id", themeId)
		.order("created_at", { ascending: false })
	if (lerr) throw new Error(`Failed to load theme evidence: ${lerr.message}`)

	// Fetch recent evidence options to quickly link, scoped to the theme's project when available
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
		theme: theme as Theme,
		links: (links ?? []) as Array<{
			evidence: Pick<Evidence, "id" | "verbatim" | "support" | "confidence">
			rationale: string | null
			confidence: number | null
		}>,
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
	const { theme, links, evidenceOptions } = useLoaderData<typeof loader>()
	const nav = useNavigation()
	return (
		<div className="space-y-6 p-6">
			<div>
				<h1 className="font-semibold text-xl">{theme.name}</h1>
				{theme.statement && <p className="mt-1 text-gray-600">{theme.statement}</p>}
			</div>
			<div className="rounded border bg-white p-4">
				<h2 className="mb-3 font-medium">Link evidence</h2>
				<Form method="post" className="grid gap-3 sm:grid-cols-2">
					<label className="flex flex-col gap-1">
						<span className="text-gray-600 text-xs">Evidence</span>
						<select name="evidence_id" className="rounded border p-2 text-sm">
							<option value="">Select…</option>
							{evidenceOptions.map((e) => (
								<option key={e.id} value={e.id}>
									{e.verbatim?.slice(0, 80) || e.id}
								</option>
							))}
						</select>
					</label>
					<label className="flex flex-col gap-1">
						<span className="text-gray-600 text-xs">Confidence (0–1)</span>
						<input name="confidence" type="number" min="0" max="1" step="0.1" className="rounded border p-2 text-sm" />
					</label>
					<label className="flex flex-col gap-1 sm:col-span-2">
						<span className="text-gray-600 text-xs">Rationale</span>
						<textarea
							name="rationale"
							rows={2}
							className="rounded border p-2 text-sm"
							placeholder="Why does this evidence support the theme?"
						/>
					</label>
					<div className="sm:col-span-2">
						<button
							type="submit"
							className="rounded bg-primary-600 px-3 py-2 font-medium text-sm text-white disabled:opacity-60"
							disabled={nav.state === "submitting"}
						>
							{nav.state === "submitting" ? "Linking…" : "Link evidence"}
						</button>
					</div>
				</Form>
			</div>
			<div>
				<h2 className="mb-2 font-medium">Evidence</h2>
				<ul className="space-y-3">
					{links.map((l) => (
						<li key={l.evidence.id} className="rounded border bg-white p-3">
							<div className="text-sm">“{l.evidence.verbatim}”</div>
							<div className="mt-1 text-gray-500 text-xs">
								{l.evidence.support} • {l.evidence.confidence}
							</div>
						</li>
					))}
				</ul>
			</div>
			<div>
				<Link to=".." relative="path" className="text-primary-600 text-sm hover:underline">
					Back
				</Link>
			</div>
		</div>
	)
}
