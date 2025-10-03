import slugify from "@sindresorhus/slugify"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useMemo, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useFetcher, useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import type { FacetCatalog } from "~/../baml_client/types"
import type { Database } from "~/../supabase/types"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { userContext } from "~/server/user-context"

interface CandidateRow {
	id: string
	kind_slug: string
	label: string
	synonyms: string[] | null
	source: string
	status: string
	evidence_id: string | null
	notes: string | null
	created_at: string
	reviewed_at: string | null
	reviewed_by: string | null
	person_id: string | null
}

interface AccountFacetRow {
	id: number
	kind_id: number
	slug: string
	label: string
	synonyms: string[] | null
	updated_at: string | null
}

interface ProjectFacetRow {
	facet_ref: string
	scope: "catalog" | "project"
	kind_slug: string | null
	label: string | null
	synonyms: string[] | null
	is_enabled: boolean | null
	alias: string | null
	pinned: boolean | null
	sort_weight: number | null
	updated_at: string | null
}

type LoaderData = {
	catalog: FacetCatalog
	candidates: CandidateRow[]
	accountFacets: AccountFacetRow[]
	projectFacets: ProjectFacetRow[]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const accountId = params.accountId
	const projectId = params.projectId
	if (!accountId || !projectId) {
		throw new Response("Missing account or project context", { status: 400 })
	}

	const catalog = await getFacetCatalog({ db: supabase, accountId, projectId })

	const [{ data: candidates, error: candidateError }, { data: accountFacets, error: accountFacetError }, { data: projectFacets, error: projectFacetError }] =
		await Promise.all([
			supabase
				.from("facet_candidate")
				.select("id, kind_slug, label, synonyms, source, status, evidence_id, notes, created_at, reviewed_at, reviewed_by, person_id")
				.eq("account_id", accountId)
				.eq("project_id", projectId)
				.order("created_at", { ascending: false }),
			supabase
				.from("facet_account")
				.select("id, kind_id, slug, label, synonyms, updated_at")
				.eq("account_id", accountId),
			supabase
				.from("project_facet")
				.select("facet_ref, scope, kind_slug, label, synonyms, is_enabled, alias, pinned, sort_weight, updated_at")
				.eq("project_id", projectId),
		])

	if (candidateError) throw new Error(`Failed to load facet candidates: ${candidateError.message}`)
	if (accountFacetError) throw new Error(`Failed to load account facets: ${accountFacetError.message}`)
	if (projectFacetError) throw new Error(`Failed to load project facet config: ${projectFacetError.message}`)

	return {
		catalog,
		candidates: candidates ?? [],
		accountFacets: accountFacets ?? [],
		projectFacets: projectFacets ?? [],
	} satisfies LoaderData
}

export async function action({ context, params, request }: ActionFunctionArgs) {
	if (request.method.toUpperCase() !== "POST") {
		return { ok: false, error: "Unsupported method" }
	}

	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId
	if (!accountId || !projectId) {
		return { ok: false, error: "Missing account or project context" }
	}

	const formData = await request.formData()
	const intent = formData.get("intent")?.toString()

	try {
		switch (intent) {
			case "approve-candidate": {
				const candidateId = formData.get("candidateId")?.toString()
				if (!candidateId) return { ok: false, error: "Missing candidate" }
				return await approveCandidate({ supabase, accountId, projectId, candidateId, reviewerId: ctx.claims?.sub ?? null })
			}
			case "reject-candidate": {
				const candidateId = formData.get("candidateId")?.toString()
				if (!candidateId) return { ok: false, error: "Missing candidate" }
				await supabase
					.from("facet_candidate")
					.update({
						status: "rejected",
						reviewed_at: new Date().toISOString(),
						reviewed_by: ctx.claims?.sub ?? null,
						resolved_facet_ref: null,
					})
					.eq("id", candidateId)
					.eq("account_id", accountId)
					.eq("project_id", projectId)
				return { ok: true }
			}
			case "autoaccept-pending": {
				const { data: pending, error } = await supabase
					.from("facet_candidate")
					.select("id")
					.eq("account_id", accountId)
					.eq("project_id", projectId)
					.eq("status", "pending")
				if (error) throw new Error(`Failed to load pending candidates: ${error.message}`)
				if (!pending?.length) return { ok: true, processed: 0 }
				let processed = 0
				for (const row of pending) {
					const result = await approveCandidate({ supabase, accountId, projectId, candidateId: row.id, reviewerId: ctx.claims?.sub ?? null })
					if (result.ok) processed += 1
				}
				return { ok: true, processed }
			}
			case "update-project-facet": {
				const facetRef = formData.get("facetRef")?.toString()
				if (!facetRef) return { ok: false, error: "Missing facet reference" }
				const alias = formData.get("alias")?.toString().trim() || null
				const isEnabled = formData.get("isEnabled") === "true"
				const pinned = formData.get("pinned") === "true"
				const sortWeightRaw = formData.get("sortWeight")?.toString()
				const sortWeight = sortWeightRaw ? Number.parseInt(sortWeightRaw, 10) || 0 : 0
				const scope = facetRef.startsWith("p:") ? "project" : "catalog"
				const synonyms = formData
					.getAll("synonyms")
					.map((value) => value.toString())
					.filter((value) => value.trim().length)
				const payload: Database["public"]["Tables"]["project_facet"]["Insert"] = {
					project_id: projectId,
					account_id: accountId,
					facet_ref: facetRef,
					scope,
					is_enabled: isEnabled,
					alias,
					pinned,
					sort_weight: sortWeight,
				}
				if (synonyms.length) {
					payload.synonyms = synonyms
				}
				const { error } = await supabase
					.from("project_facet")
					.upsert(payload, { onConflict: "project_id,facet_ref" })
				if (error) throw new Error(`Failed to update project facet: ${error.message}`)
				return { ok: true }
			}
			default:
				return { ok: false, error: "Unknown intent" }
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unexpected error"
		return { ok: false, error: message }
	}
}

type Supabase = SupabaseClient<Database>

async function approveCandidate({
	supabase,
	accountId,
	projectId,
	candidateId,
	reviewerId,
}: {
	supabase: Supabase
	accountId: string
	projectId: string
	candidateId: string
	reviewerId: string | null
}) {
	const { data: candidate, error: candidateError } = await supabase
		.from("facet_candidate")
		.select("id, kind_slug, label, synonyms, notes, status, person_id, evidence_id")
		.eq("id", candidateId)
		.eq("account_id", accountId)
		.eq("project_id", projectId)
		.single()

	if (candidateError) return { ok: false, error: candidateError.message }
	if (!candidate) return { ok: false, error: "Candidate not found" }
	if (candidate.status !== "pending") return { ok: true, skipped: true }

	const { data: kindRow, error: kindError } = await supabase
		.from("facet_kind_global")
		.select("id")
		.eq("slug", candidate.kind_slug)
		.single()
	if (kindError || !kindRow) return { ok: false, error: kindError?.message ?? "Unknown facet kind" }

	const { data: existingSlugs } = await supabase
		.from("facet_account")
		.select("slug")
		.eq("account_id", accountId)
		.eq("kind_id", kindRow.id)

	const existingSet = new Set((existingSlugs ?? []).map((row) => row.slug))
	const baseSlug = slugify(candidate.label, { separator: "-" }) || `facet-${Date.now()}`
	let slug = baseSlug
	let counter = 1
	while (existingSet.has(slug)) {
		slug = `${baseSlug}-${counter}`
		counter += 1
	}

	const { data: insertedFacet, error: insertError } = await supabase
		.from("facet_account")
		.insert({
			account_id: accountId,
			kind_id: kindRow.id,
			slug,
			label: candidate.label,
			synonyms: candidate.synonyms ?? [],
			description: candidate.notes ?? null,
		})
		.select("id")
		.single()

	if (insertError) return { ok: false, error: insertError.message }
	if (!insertedFacet?.id) return { ok: false, error: "Failed to create account facet" }

	const facetRef = `a:${insertedFacet.id}`

	const { error: projectFacetError } = await supabase
		.from("project_facet")
		.upsert(
			{
				project_id: projectId,
				account_id: accountId,
				facet_ref: facetRef,
				scope: "catalog",
				is_enabled: true,
			},
			{ onConflict: "project_id,facet_ref" },
		)
	if (projectFacetError) return { ok: false, error: projectFacetError.message }

	const { error: updateCandidateError } = await supabase
		.from("facet_candidate")
		.update({
			status: "approved",
			resolved_facet_ref: facetRef,
			reviewed_by: reviewerId,
			reviewed_at: new Date().toISOString(),
		})
		.eq("id", candidateId)
	if (updateCandidateError) return { ok: false, error: updateCandidateError.message }

	if (candidate.person_id) {
		await supabase
			.from("person_facet")
			.upsert(
				{
					account_id: accountId,
					project_id: projectId,
					person_id: candidate.person_id,
					facet_ref: facetRef,
					source: "manual",
					evidence_id: candidate.evidence_id,
					confidence: 0.8,
					noted_at: new Date().toISOString(),
				},
				{ onConflict: "person_id,facet_ref" },
			)
	}

	return { ok: true, facetRef }
}

export default function FacetManagementPage() {
	const loaderData = useLoaderData() as LoaderData
	const fetcher = useFetcher()
	const [aliasEdits, setAliasEdits] = useState<Record<string, string>>({})

	const projectFacetIndex = useMemo(() => {
		const map = new Map<string, ProjectFacetRow>()
		for (const row of loaderData.projectFacets) {
			map.set(row.facet_ref, row)
		}
		return map
	}, [loaderData.projectFacets])

	return (
		<div className="space-y-10 px-6 py-8">
			<header className="flex items-start justify-between gap-4">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Facet Catalog</h1>
					<p className="text-muted-foreground">
						Manage reusable facets, review AI suggestions, and keep people data consistent.
					</p>
				</div>
				<fetcher.Form method="post">
					<input type="hidden" name="intent" value="autoaccept-pending" />
					<Button type="submit" disabled={fetcher.state !== "idle"}>
						Auto-accept pending
					</Button>
				</fetcher.Form>
			</header>

			<section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
				<Card className="lg:col-span-1 lg:row-span-2">
					<CardHeader>
						<CardTitle>Project Facets</CardTitle>
						<CardDescription>
							Enable or alias facets for this project.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{loaderData.catalog.facets.length === 0 ? (
							<p className="text-sm text-muted-foreground">No facets available yet.</p>
						) : (
							<div className="space-y-4">
								{loaderData.catalog.facets.map((facet) => {
									const projectConfig = projectFacetIndex.get(facet.facet_ref)
									const baseEnabled = projectConfig?.is_enabled ?? true
									const enabledKey = `${facet.facet_ref}-enabled`
									const enabledValue = aliasEdits[enabledKey] ?? (baseEnabled ? "true" : "false")
									const isEnabled = enabledValue === "true"
									const aliasValue = aliasEdits[facet.facet_ref] ?? projectConfig?.alias ?? ""
									return (
										<Card key={facet.facet_ref} className="border-muted bg-muted/40">
											<CardContent className="space-y-3 py-4">
												<div className="flex items-center justify-between gap-3">
													<div>
														<p className="text-sm font-medium">{facet.alias ?? facet.label}</p>
														<p className="text-xs text-muted-foreground uppercase tracking-wide">{facet.kind_slug}</p>
													</div>
													<Badge variant={isEnabled ? "default" : "secondary"}>{isEnabled ? "Enabled" : "Disabled"}</Badge>
												</div>
												<div className="grid gap-2">
													<Label htmlFor={`alias-${facet.facet_ref}`}>Alias</Label>
													<Input
														id={`alias-${facet.facet_ref}`}
														defaultValue={projectConfig?.alias ?? ""}
														onChange={(event) =>
															setAliasEdits((prev) => ({ ...prev, [facet.facet_ref]: event.target.value }))
														}
														placeholder="Optional project-specific label"
													/>
												</div>
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<Switch
															id={`enabled-${facet.facet_ref}`}
															checked={isEnabled}
															onCheckedChange={(checked) => {
																setAliasEdits((prev) => ({ ...prev, [enabledKey]: checked ? "true" : "false" }))
															}}
														/>
														<Label htmlFor={`enabled-${facet.facet_ref}`}>Enabled</Label>
													</div>
													<fetcher.Form method="post" className="flex items-center gap-2">
														<input type="hidden" name="intent" value="update-project-facet" />
														<input type="hidden" name="facetRef" value={facet.facet_ref} />
														<input type="hidden" name="isEnabled" value={enabledValue} />
														<input type="hidden" name="alias" value={aliasValue} />
														<input type="hidden" name="pinned" value={projectConfig?.pinned ? "true" : "false"} />
														<input type="hidden" name="sortWeight" value={projectConfig?.sort_weight ?? 0} />
														<Button type="submit" size="sm" disabled={fetcher.state !== "idle"}>
															Save
														</Button>
													</fetcher.Form>
												</div>
												{facet.synonyms && facet.synonyms.length > 0 && (
													<p className="text-xs text-muted-foreground">Synonyms: {facet.synonyms.join(", ")}</p>
												)}
											</CardContent>
										</Card>
									)
								})}
							</div>
						)}
					</CardContent>
				</Card>

				<Card className="lg:col-span-1">
					<CardHeader>
						<CardTitle>Account Facets</CardTitle>
						<CardDescription>Reusable vocabulary promoted to the entire account.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						{loaderData.accountFacets.length === 0 ? (
							<p className="text-sm text-muted-foreground">No account-specific facets yet.</p>
						) : (
							loaderData.accountFacets.map((facet) => (
								<div key={facet.id} className="rounded-md border border-dashed border-muted-foreground/30 px-4 py-3">
									<p className="text-sm font-medium">{facet.label}</p>
									<p className="text-xs text-muted-foreground">Slug: {facet.slug}</p>
								</div>
							))
						)}
					</CardContent>
				</Card>
			</section>

			<section>
				<Card>
					<CardHeader>
						<CardTitle>AI Suggestions</CardTitle>
						<CardDescription>Review candidates harvested from transcripts. Approve to add them to the catalog.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{loaderData.candidates.length === 0 ? (
							<p className="text-sm text-muted-foreground">No candidates right now. New ones appear after interviews are processed.</p>
						) : (
							loaderData.candidates.map((candidate) => (
								<div key={candidate.id} className="rounded-md border border-border bg-card p-4">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<h3 className="text-base font-semibold">{candidate.label}</h3>
											<p className="text-xs uppercase tracking-wide text-muted-foreground">{candidate.kind_slug}</p>
										</div>
										<Badge variant={candidate.status === "pending" ? "default" : "secondary"}>
											{candidate.status}
										</Badge>
									</div>
									{candidate.synonyms && candidate.synonyms.length > 0 && (
										<p className="text-xs text-muted-foreground">Synonyms: {candidate.synonyms.join(", ")}</p>
									)}
									{candidate.notes && <p className="text-xs text-muted-foreground">Notes: {candidate.notes}</p>}
									<div className="mt-4 flex flex-wrap gap-2">
										<fetcher.Form method="post">
											<input type="hidden" name="intent" value="approve-candidate" />
											<input type="hidden" name="candidateId" value={candidate.id} />
											<Button type="submit" size="sm" disabled={fetcher.state !== "idle" || candidate.status !== "pending"}>
												Approve
											</Button>
										</fetcher.Form>
										<fetcher.Form method="post">
											<input type="hidden" name="intent" value="reject-candidate" />
											<input type="hidden" name="candidateId" value={candidate.id} />
											<Button type="submit" size="sm" variant="secondary" disabled={fetcher.state !== "idle" || candidate.status !== "pending"}>
												Reject
											</Button>
										</fetcher.Form>
									</div>
								</div>
							))
						)}
					</CardContent>
				</Card>
			</section>
		</div>
	)
}
