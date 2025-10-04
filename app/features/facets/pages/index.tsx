import slugify from "@sindresorhus/slugify"
import type { SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useMemo, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useFetcher, useLoaderData } from "react-router-dom"
import type { FacetCatalog } from "~/../baml_client/types"
import type { Database } from "~/../supabase/types"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "~/components/ui/sheet"
import { Switch } from "~/components/ui/switch"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
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

interface FacetTableRow {
	facetRef: string
	kind_slug: string
	label: string
	alias: string
	resolvedLabel: string
	synonyms: string[]
	scope: "catalog" | "project"
	isEnabled: boolean
	pinned: boolean
	sortWeight: number
	updatedAt: string | null
}

interface FacetEditorState {
	alias: string
	isEnabled: boolean
	pinned: boolean
	sortWeight: number
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

	const [
		{ data: candidates, error: candidateError },
		{ data: accountFacets, error: accountFacetError },
		{ data: projectFacets, error: projectFacetError },
	] = await Promise.all([
		supabase
			.from("facet_candidate")
			.select(
				"id, kind_slug, label, synonyms, source, status, evidence_id, notes, created_at, reviewed_at, reviewed_by, person_id"
			)
			.eq("account_id", accountId)
			.eq("project_id", projectId)
			.order("created_at", { ascending: false }),
		supabase.from("facet_account").select("id, kind_id, slug, label, synonyms, updated_at").eq("account_id", accountId),
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
				return await approveCandidate({
					supabase,
					accountId,
					projectId,
					candidateId,
					reviewerId: ctx.claims?.sub ?? null,
				})
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
					const result = await approveCandidate({
						supabase,
						accountId,
						projectId,
						candidateId: row.id,
						reviewerId: ctx.claims?.sub ?? null,
					})
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
				const { error } = await supabase.from("project_facet").upsert(payload, { onConflict: "project_id,facet_ref" })
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

	const { error: projectFacetError } = await supabase.from("project_facet").upsert(
		{
			project_id: projectId,
			account_id: accountId,
			facet_ref: facetRef,
			scope: "catalog",
			is_enabled: true,
		},
		{ onConflict: "project_id,facet_ref" }
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
		await supabase.from("person_facet").upsert(
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
			{ onConflict: "person_id,facet_ref" }
		)
	}

	return { ok: true, facetRef }
}

export default function FacetManagementPage() {
	const loaderData = useLoaderData() as LoaderData
	const fetcher = useFetcher()
	const autoApproveFetcher = useFetcher()
	const [selectedFacet, setSelectedFacet] = useState<FacetTableRow | null>(null)
	const [editorState, setEditorState] = useState<FacetEditorState | null>(null)
	const [isEditorOpen, setIsEditorOpen] = useState(false)

	const projectFacetIndex = useMemo(() => {
		const map = new Map<string, ProjectFacetRow>()
		for (const row of loaderData.projectFacets) {
			map.set(row.facet_ref, row)
		}
		return map
	}, [loaderData.projectFacets])

	const facetRows: FacetTableRow[] = useMemo(() => {
		return loaderData.catalog.facets.map((facet) => {
			const projectConfig = projectFacetIndex.get(facet.facet_ref)
			const alias = projectConfig?.alias ?? facet.alias ?? ""
			const isEnabled = projectConfig?.is_enabled ?? true
			return {
				facetRef: facet.facet_ref,
				kind_slug: facet.kind_slug,
				label: facet.label,
				alias,
				resolvedLabel: alias.trim().length ? alias : facet.label,
				synonyms: facet.synonyms ?? [],
				scope: projectConfig?.scope ?? "catalog",
				isEnabled,
				pinned: projectConfig?.pinned ?? false,
				sortWeight: projectConfig?.sort_weight ?? 0,
				updatedAt: projectConfig?.updated_at ?? null,
			}
		})
	}, [loaderData.catalog.facets, projectFacetIndex])

	const pendingCandidates = useMemo(
		() => loaderData.candidates.filter((candidate) => candidate.status === "pending"),
		[loaderData.candidates]
	)

	useEffect(() => {
		if (selectedFacet) {
			setEditorState({
				alias: selectedFacet.alias,
				isEnabled: selectedFacet.isEnabled,
				pinned: selectedFacet.pinned,
				sortWeight: selectedFacet.sortWeight,
			})
		}
	}, [selectedFacet])

	useEffect(() => {
		if (!isEditorOpen) {
			setSelectedFacet(null)
			setEditorState(null)
		}
	}, [isEditorOpen])

	useEffect(() => {
		if (isEditorOpen && fetcher.state === "idle" && fetcher.data && (fetcher.data as any).ok) {
			setIsEditorOpen(false)
		}
	}, [fetcher.data, fetcher.state, isEditorOpen])

	const formatTimestamp = (value: string | null) => {
		if (!value) return "—"
		try {
			return new Date(value).toLocaleDateString()
		} catch {
			return value
		}
	}

	return (
		<div className="space-y-10 px-6 py-8">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Facet Catalog</h1>
					<p className="max-w-2xl text-muted-foreground text-sm">
						Browse the merged facet catalog for this project. Click any row to adjust aliases, enablement, or pinning.
						AI-suggested candidates are auto-approved in bulk but stay reviewable below.
					</p>
				</div>
				<div className="flex items-center gap-2">
					{pendingCandidates.length > 0 && (
						<autoApproveFetcher.Form method="post">
							<input type="hidden" name="intent" value="autoaccept-pending" />
							<Button type="submit" size="sm" disabled={autoApproveFetcher.state !== "idle"}>
								Auto-approve {pendingCandidates.length} pending
							</Button>
						</autoApproveFetcher.Form>
					)}
				</div>
			</header>

			<Card>
				<CardHeader>
					<CardTitle>Project Facet View</CardTitle>
					<CardDescription>
						Merged catalog (project → account → global). Select a row to edit project-level settings.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{facetRows.length === 0 ? (
						<p className="text-muted-foreground text-sm">No facets available yet.</p>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Facet</TableHead>
									<TableHead>Kind</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Scope</TableHead>
									<TableHead>Synonyms</TableHead>
									<TableHead>Updated</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{facetRows.map((row) => (
									<TableRow
										key={row.facetRef}
										className="cursor-pointer"
										onClick={() => {
											setSelectedFacet(row)
											setIsEditorOpen(true)
										}}
									>
										<TableCell className="max-w-xs">
											<div className="font-medium text-foreground">{row.resolvedLabel}</div>
											{row.resolvedLabel !== row.label && (
												<p className="text-muted-foreground text-xs">Base: {row.label}</p>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs uppercase tracking-wide">
											{row.kind_slug}
										</TableCell>
										<TableCell>
											<Badge variant={row.isEnabled ? "default" : "secondary"}>
												{row.isEnabled ? "Enabled" : "Disabled"}
											</Badge>
										</TableCell>
										<TableCell className="text-muted-foreground text-xs capitalize">{row.scope}</TableCell>
										<TableCell className="max-w-sm truncate text-muted-foreground text-xs">
											{row.synonyms.length ? row.synonyms.join(", ") : "—"}
										</TableCell>
										<TableCell className="text-muted-foreground text-xs">{formatTimestamp(row.updatedAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
							<TableCaption>
								Project facet settings inherit from higher scopes. Editing applies only to this project.
							</TableCaption>
						</Table>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-6 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Account Facets</CardTitle>
						<CardDescription>Vocabulary promoted to the entire account.</CardDescription>
					</CardHeader>
					<CardContent>
						{loaderData.accountFacets.length === 0 ? (
							<p className="text-muted-foreground text-sm">No account-level facets have been promoted yet.</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Label</TableHead>
										<TableHead>Slug</TableHead>
										<TableHead>Synonyms</TableHead>
										<TableHead>Updated</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loaderData.accountFacets.map((facet) => (
										<TableRow key={facet.id}>
											<TableCell>{facet.label}</TableCell>
											<TableCell className="text-muted-foreground text-xs">{facet.slug}</TableCell>
											<TableCell className="max-w-sm truncate text-muted-foreground text-xs">
												{facet.synonyms?.length ? facet.synonyms.join(", ") : "—"}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{formatTimestamp(facet.updated_at)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>AI Suggestions</CardTitle>
						<CardDescription>Recently harvested candidates remain visible even after auto-approval.</CardDescription>
					</CardHeader>
					<CardContent>
						{loaderData.candidates.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No candidates right now. New observations appear after interviews are processed.
							</p>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Label</TableHead>
										<TableHead>Kind</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Synonyms</TableHead>
										<TableHead>Notes</TableHead>
										<TableHead>Created</TableHead>
										<TableHead>Reviewed</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loaderData.candidates.map((candidate) => (
										<TableRow key={candidate.id}>
											<TableCell className="font-medium">{candidate.label}</TableCell>
											<TableCell className="text-muted-foreground text-xs uppercase tracking-wide">
												{candidate.kind_slug}
											</TableCell>
											<TableCell>
												<Badge variant={candidate.status === "pending" ? "default" : "secondary"}>
													{candidate.status}
												</Badge>
											</TableCell>
											<TableCell className="max-w-xs truncate text-muted-foreground text-xs">
												{candidate.synonyms?.length ? candidate.synonyms.join(", ") : "—"}
											</TableCell>
											<TableCell className="max-w-xs truncate text-muted-foreground text-xs">
												{candidate.notes ?? "—"}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{formatTimestamp(candidate.created_at)}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{formatTimestamp(candidate.reviewed_at)}
											</TableCell>
											<TableCell>
												<div className="flex justify-end gap-2">
													<fetcher.Form method="post">
														<input type="hidden" name="intent" value="approve-candidate" />
														<input type="hidden" name="candidateId" value={candidate.id} />
														<Button
															type="submit"
															size="sm"
															disabled={fetcher.state !== "idle" || candidate.status !== "pending"}
														>
															Approve
														</Button>
													</fetcher.Form>
													<fetcher.Form method="post">
														<input type="hidden" name="intent" value="reject-candidate" />
														<input type="hidden" name="candidateId" value={candidate.id} />
														<Button
															variant="secondary"
															size="sm"
															disabled={fetcher.state !== "idle" || candidate.status !== "pending"}
														>
															Reject
														</Button>
													</fetcher.Form>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			<Sheet open={isEditorOpen} onOpenChange={setIsEditorOpen}>
				<SheetContent side="right" className="sm:max-w-md">
					{selectedFacet && editorState ? (
						<fetcher.Form method="post" className="flex h-full flex-col gap-6">
							<SheetHeader className="gap-2">
								<SheetTitle>Edit facet</SheetTitle>
								<SheetDescription>
									{selectedFacet.label} · {selectedFacet.kind_slug}
								</SheetDescription>
							</SheetHeader>
							<div className="flex flex-1 flex-col gap-6 px-4">
								<div className="space-y-2">
									<Label htmlFor="alias">Project alias</Label>
									<Input
										id="alias"
										name="alias"
										placeholder="Defaults to catalog label"
										value={editorState.alias}
										onChange={(event) =>
											setEditorState((prev) => (prev ? { ...prev, alias: event.target.value } : prev))
										}
									/>
								</div>
								<div className="space-y-2">
									<Label htmlFor="sortWeight">Sort weight</Label>
									<Input
										id="sortWeight"
										name="sortWeight"
										type="number"
										value={editorState.sortWeight}
										onChange={(event) =>
											setEditorState((prev) => {
												if (!prev) return prev
												const next = Number.parseInt(event.target.value, 10)
												return { ...prev, sortWeight: Number.isNaN(next) ? 0 : next }
											})
										}
									/>
								</div>
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<p className="font-medium text-sm">Enabled</p>
										<p className="text-muted-foreground text-xs">
											Controls whether this facet is available in project workflows.
										</p>
									</div>
									<Switch
										checked={editorState.isEnabled}
										onCheckedChange={(checked) =>
											setEditorState((prev) => (prev ? { ...prev, isEnabled: checked } : prev))
										}
									/>
								</div>
								<div className="flex items-center justify-between">
									<div className="space-y-1">
										<p className="font-medium text-sm">Pinned</p>
										<p className="text-muted-foreground text-xs">Pinned facets surface to the top of pickers.</p>
									</div>
									<Switch
										checked={editorState.pinned}
										onCheckedChange={(checked) =>
											setEditorState((prev) => (prev ? { ...prev, pinned: checked } : prev))
										}
									/>
								</div>
								{selectedFacet.synonyms.length > 0 && (
									<div className="space-y-1">
										<Label>Catalog synonyms</Label>
										<p className="text-muted-foreground text-xs">{selectedFacet.synonyms.join(", ")}</p>
									</div>
								)}
							</div>

							<div className="flex items-center justify-end gap-3 border-t px-4 py-4">
								<input type="hidden" name="intent" value="update-project-facet" />
								<input type="hidden" name="facetRef" value={selectedFacet.facetRef} />
								<input type="hidden" name="isEnabled" value={editorState.isEnabled ? "true" : "false"} />
								<input type="hidden" name="pinned" value={editorState.pinned ? "true" : "false"} />
								<Button type="submit" disabled={fetcher.state !== "idle"}>
									{fetcher.state === "idle" ? "Save changes" : "Saving"}
								</Button>
							</div>
						</fetcher.Form>
					) : null}
				</SheetContent>
			</Sheet>
		</div>
	)
}
