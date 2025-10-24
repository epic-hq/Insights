import { useMemo } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router"
import { useFetcher, useLoaderData } from "react-router-dom"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { userContext } from "~/server/user-context"

interface FacetRow {
	id: number
	label: string
	synonyms: string[]
	is_active: boolean
	kind_slug: string
	kind_label: string
	updated_at: string | null
}

interface LoaderData {
	facets: FacetRow[]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const { supabase } = context.get(userContext)
	const accountId = params.accountId
	if (!accountId) {
		throw new Response("Missing account context", { status: 400 })
	}

	await getFacetCatalog({ db: supabase, accountId })

	const { data, error } = await supabase
		.from("facet_account")
		.select(
			"id, label, synonyms, is_active, updated_at, kind_id, facet_kind_global:facet_kind_global!inner(slug, label)"
		)
		.eq("account_id", accountId)
		.order("updated_at", { ascending: false })

	if (error) throw new Error(`Failed to load facets: ${error.message}`)

	const facets: FacetRow[] = (data ?? []).map((row) => ({
		id: row.id,
		label: row.label ?? "",
		synonyms: Array.isArray(row.synonyms) ? (row.synonyms as string[]) : [],
		is_active: row.is_active ?? false,
		kind_slug: (row.facet_kind_global as { slug: string } | null)?.slug ?? "",
		kind_label: (row.facet_kind_global as { label: string } | null)?.label ?? "",
		updated_at: row.updated_at ?? null,
	}))

	return { facets }
}

export async function action({ context, params, request }: ActionFunctionArgs) {
	if (request.method.toUpperCase() !== "POST") {
		return { ok: false, error: "Unsupported method" }
	}

	const { supabase } = context.get(userContext)
	const accountId = params.accountId
	if (!accountId) {
		return { ok: false, error: "Missing account context" }
	}

	const formData = await request.formData()
	const intent = formData.get("intent")?.toString()

	switch (intent) {
		case "toggle": {
			const facetId = Number(formData.get("facetId"))
			const isActive = formData.get("isActive") === "true"
			if (!facetId) return { ok: false, error: "Missing facet" }
			const { error } = await supabase
				.from("facet_account")
				.update({ is_active: isActive, updated_at: new Date().toISOString() })
				.eq("account_id", accountId)
				.eq("id", facetId)
			if (error) return { ok: false, error: error.message }
			return { ok: true }
		}
		default:
		return { ok: false, error: "Unknown intent" }
	}
}

function formatSynonyms(synonyms: string[]): string {
	if (!synonyms.length) return "–"
	return synonyms.join(", ")
}

export default function FacetCatalogPage() {
	const { facets } = useLoaderData<typeof loader>()
	const toggleFetcher = useFetcher<{ ok: boolean; error?: string }>()

	const facetsByKind = useMemo(() => {
		return facets.reduce<Map<string, FacetRow[]>>((acc, facet) => {
			const bucket = acc.get(facet.kind_label) ?? []
			bucket.push(facet)
			acc.set(facet.kind_label, bucket)
			return acc
		}, new Map())
	}, [facets])

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Facet Catalogue</CardTitle>
				</CardHeader>
				<CardContent>
					{facets.length === 0 ? (
						<p className="text-muted-foreground text-sm">No facets found for this account.</p>
					) : (
						<div className="space-y-6">
							{Array.from(facetsByKind.entries()).map(([kind, list]) => (
								<div key={kind} className="space-y-3">
									<h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
										<Badge variant="outline" className="uppercase tracking-wide text-xs">
											{kind || "Unknown kind"}
										</Badge>
										<span className="text-muted-foreground text-xs">{list.length} facets</span>
									</h3>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Facet</TableHead>
												<TableHead>Synonyms</TableHead>
												<TableHead>Status</TableHead>
												<TableHead className="w-32 text-right">Actions</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{list.map((facet) => (
												<TableRow key={facet.id}>
													<TableCell className="font-medium">{facet.label}</TableCell>
													<TableCell>{formatSynonyms(facet.synonyms)}</TableCell>
													<TableCell>
														<Badge variant={facet.is_active ? "default" : "secondary"} className="text-xs">
															{facet.is_active ? "Active" : "Disabled"}
														</Badge>
													</TableCell>
													<TableCell className="text-right space-x-2">
														<toggleFetcher.Form method="post">
															<input type="hidden" name="intent" value="toggle" />
															<input type="hidden" name="facetId" value={facet.id} />
															<input type="hidden" name="isActive" value={(!facet.is_active).toString()} />
															<Button type="submit" variant="outline" size="sm">
																{facet.is_active ? "Disable" : "Enable"}
															</Button>
														</toggleFetcher.Form>
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
