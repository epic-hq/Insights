import consola from "consola"
import { LayoutGrid, Table as TableIcon, UserCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData, useNavigate, useSearchParams } from "react-router"
import { Link, useParams } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import EnhancedPersonCard from "~/features/people/components/EnhancedPersonCard"
import { PeopleDataTable, type PersonTableRow } from "~/features/people/components/PeopleDataTable"
import { getPeople } from "~/features/people/db"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { getServerClient } from "~/lib/supabase/client.server"
import { getImageUrl } from "~/utils/storeImage.server"

export const meta: MetaFunction = () => {
	return [{ title: "People" }, { name: "description", content: "Manage research participants and contacts" }]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	// Get scope from URL search params (defaults to "project")
	const url = new URL(request.url)
	const scope = (url.searchParams.get("scope") as "project" | "account") || "project"

	const [{ data: people, error }, catalog] = await Promise.all([
		getPeople({ supabase, accountId, projectId, scope }),
		getFacetCatalog({ db: supabase, accountId }),
	])

	if (error) {
		throw new Response("Error loading people", { status: 500 })
	}

	// Convert R2 keys to presigned URLs for avatars
	const peopleWithImageUrls = (people || []).map((person) => {
		if (person.image_url?.startsWith("images/")) {
			return { ...person, image_url: getImageUrl(person.image_url) ?? null }
		}
		return person
	})

	const evidence_counts: Record<string, number> = {}
	const person_ids = peopleWithImageUrls.map((person) => person.id)
	if (person_ids.length) {
		const { data: evidencePeople, error: evidenceError } = await supabase
			.from("evidence_people")
			.select("person_id")
			.in("person_id", person_ids)
		if (evidenceError) {
			consola.warn("Failed to load evidence counts for people index", evidenceError.message)
		} else {
			for (const row of evidencePeople ?? []) {
				const person_id = row.person_id
				if (!person_id) continue
				evidence_counts[person_id] = (evidence_counts[person_id] ?? 0) + 1
			}
		}
	}

	return { people: peopleWithImageUrls, catalog, evidence_counts, scope }
}

export default function PeopleIndexPage() {
	const { people, catalog, evidence_counts, scope } = useLoaderData<typeof loader>()
	const currentProjectContext = useCurrentProject()
	const { accountId, projectId } = useParams()
	const navigate = useNavigate()
	const [searchParams] = useSearchParams()
	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}
	const routes = useProjectRoutes(currentProjectContext?.projectPath)

	const facetsById = useMemo(() => {
		const map = new Map<number, { label: string; alias?: string; kind_slug: string }>()
		for (const facet of catalog.facets) {
			map.set(facet.facet_account_id, {
				label: facet.label,
				alias: facet.alias,
				kind_slug: facet.kind_slug,
			})
		}
		return map
	}, [catalog])

	const peopleWithFacets = useMemo(() => {
		return people.map((person) => {
			const personFacets = (person.person_facet ?? []).map((row) => {
				const facetMeta = facetsById.get(row.facet_account_id)
				const joinedFacet = row.facet as {
					label?: string | null
					facet_kind_global?: { slug?: string | null } | null
				} | null
				const fallbackLabel = joinedFacet?.label ?? null
				return {
					facet_account_id: row.facet_account_id,
					label: facetMeta?.alias || facetMeta?.label || fallbackLabel || `ID:${row.facet_account_id}`,
					kind_slug: facetMeta?.kind_slug || joinedFacet?.facet_kind_global?.slug || "",
					source: row.source ?? null,
					confidence: row.confidence ?? null,
				}
			})
			return { person, facets: personFacets }
		})
	}, [people, facetsById])

	const [searchQuery, setSearchQuery] = useState("")
	const [organizationFilter, setOrganizationFilter] = useState<string>("all")
	const [stakeholderFilter, setStakeholderFilter] = useState<string>("all")

	const organizations = useMemo(() => {
		const seen = new Set<string>()
		for (const { person } of peopleWithFacets) {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0]
			const label = primaryOrgLink?.organization?.name || primaryOrgLink?.organization?.website_url || null
			if (!label) continue
			seen.add(label)
		}
		return Array.from(seen).sort((a, b) => a.localeCompare(b))
	}, [peopleWithFacets])

	const stakeholder_statuses = useMemo(() => {
		const seen = new Set<string>()
		for (const { person } of peopleWithFacets) {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0]
			const status = primaryOrgLink?.relationship_status || person.lifecycle_stage || null
			if (!status) continue
			seen.add(status)
		}
		return Array.from(seen).sort((a, b) => a.localeCompare(b))
	}, [peopleWithFacets])

	const filteredPeopleWithFacets = useMemo(() => {
		const normalized_query = searchQuery.trim().toLowerCase()
		return peopleWithFacets.filter(({ person }) => {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0]
			const organization_label = primaryOrgLink?.organization?.name || primaryOrgLink?.organization?.website_url || null
			const stakeholder_status = primaryOrgLink?.relationship_status || person.lifecycle_stage || null
			const job_title = person.title || null

			if (organizationFilter !== "all" && organization_label !== organizationFilter) return false
			if (stakeholderFilter !== "all" && stakeholder_status !== stakeholderFilter) return false
			if (!normalized_query) return true

			const haystack = [person.name, job_title, organization_label, person.description]
				.filter(Boolean)
				.join(" ")
				.toLowerCase()
			return haystack.includes(normalized_query)
		})
	}, [organizationFilter, peopleWithFacets, searchQuery, stakeholderFilter])

	const tableRows = useMemo<PersonTableRow[]>(() => {
		return filteredPeopleWithFacets.map(({ person }) => {
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0]
			const primaryOrganization = primaryOrgLink?.organization ?? null
			const jobTitle = (person as { title?: string | null }).title ?? null
			const stakeholderStatus = primaryOrgLink?.relationship_status || person.lifecycle_stage || null
			return {
				id: person.id,
				name: person.name || "Unnamed person",
				title: jobTitle,
				organization: primaryOrganization
					? {
						id: primaryOrganization.id,
						name: primaryOrganization.name || primaryOrganization.website_url || null,
					}
					: null,
				conversationCount: person.interview_people?.length ?? 0,
				evidenceCount: evidence_counts[person.id] ?? 0,
				stakeholderStatus,
				updatedAt: person.updated_at ?? null,
			}
		})
	}, [evidence_counts, filteredPeopleWithFacets])

	const [viewMode, setViewMode] = useState<"cards" | "table">("cards")

	return (
		<>
			<PersonaPeopleSubnav />
			<PageContainer className="space-y-6">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex items-start gap-3">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
							<UserCircle className="h-6 w-6" />
						</div>
						<div>
							<div className="flex items-baseline gap-2">
								<h1 className="font-semibold text-3xl text-foreground">People</h1>
								<span className="text-foreground/75 text-sm">({people.length})</span>
							</div>
						</div>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						{/* Scope toggle - Project vs Account */}
						<ToggleGroup
							type="single"
							value={scope}
							onValueChange={(value) => {
								if (value) {
									const newParams = new URLSearchParams(searchParams)
									newParams.set("scope", value)
									navigate(`?${newParams.toString()}`, { replace: true })
								}
							}}
							className="w-full sm:w-auto"
							variant="outline"
							size="sm"
						>
							<ToggleGroupItem value="project" aria-label="Current project">
								Project
							</ToggleGroupItem>
							<ToggleGroupItem value="account" aria-label="All account">
								All
							</ToggleGroupItem>
						</ToggleGroup>

						{/* View mode toggle */}
						<ToggleGroup
							type="single"
							value={viewMode}
							onValueChange={(value) => value && setViewMode(value as "cards" | "table")}
							className="w-full sm:w-auto"
							variant="outline"
							size="sm"
						>
							<ToggleGroupItem value="cards" aria-label="Card view">
								<LayoutGrid className="h-4 w-4" />
							</ToggleGroupItem>
							<ToggleGroupItem value="table" aria-label="Table view">
								<TableIcon className="h-4 w-4" />
							</ToggleGroupItem>
						</ToggleGroup>
						<Button asChild variant="outline" className="w-full sm:w-auto">
							<Link to={routes.people.new()}>Add Person</Link>
						</Button>
					</div>
				</div>

				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-1 flex-col gap-3 sm:flex-row">
						<div className="flex-1">
							<Input
								value={searchQuery}
								onChange={(event) => setSearchQuery(event.target.value)}
								placeholder="Search people…"
								aria-label="Search people"
							/>
						</div>
						{/* <div className="w-full sm:w-56">
							<Select value={organizationFilter} onValueChange={setOrganizationFilter}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Organization" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All organizations</SelectItem>
									{organizations.map((org) => (
										<SelectItem key={org} value={org}>
											{org}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div> */}
						{/* <div className="w-full sm:w-56">
							<Select value={stakeholderFilter} onValueChange={setStakeholderFilter}>
								<SelectTrigger className="w-full">
									<SelectValue placeholder="Stakeholder status" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All statuses</SelectItem>
									{stakeholder_statuses.map((status) => (
										<SelectItem key={status} value={status}>
											{status}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div> */}
					</div>
					<div className="text-muted-foreground text-sm">{filteredPeopleWithFacets.length} results</div>
				</div>

				{people.length === 0 ? (
					<div className="rounded-lg border border-dashed bg-muted/40 py-16 text-center">
						<div className="mx-auto max-w-md space-y-4">
							<h3 className="font-semibold text-lg text-muted-foreground">No people yet</h3>

							<Button asChild>
								<Link to={routes.people.new()}>Add Person</Link>
							</Button>
						</div>
					</div>
				) : viewMode === "table" ? (
					<PeopleDataTable rows={tableRows} />
				) : (
					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
						{filteredPeopleWithFacets.map(({ person, facets }) => (
							<EnhancedPersonCard
								key={person.id}
								person={{
									...person,
									people_personas: (person.people_personas || []).map((pp) => ({
										personas: pp.personas
											? {
												name: pp.personas.name,
												color_hex: pp.personas.color_hex || undefined,
											}
											: undefined,
									})),
								}}
								conversationCount={person.interview_people?.length ?? 0}
								evidenceCount={evidence_counts[person.id] ?? 0}
								facets={facets}
							/>
						))}
					</div>
				)}
			</PageContainer>
		</>
	)
}
