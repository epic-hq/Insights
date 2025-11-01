import { LayoutGrid, Table as TableIcon, UserCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link, useParams } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Button } from "~/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group"
import { useCurrentProject } from "~/contexts/current-project-context"
import EnhancedPersonCard from "~/features/people/components/EnhancedPersonCard"
import { PeopleDataTable, type PersonTableRow } from "~/features/people/components/PeopleDataTable"
import { getPeople } from "~/features/people/db"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { getServerClient } from "~/lib/supabase/client.server"

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

	const [{ data: people, error }, catalog] = await Promise.all([
		getPeople({ supabase, accountId, projectId }),
		getFacetCatalog({ db: supabase, accountId, projectId }),
	])

	if (error) {
		throw new Response("Error loading people", { status: 500 })
	}

	return { people: people || [], catalog }
}

export default function PeopleIndexPage() {
	const { people, catalog } = useLoaderData<typeof loader>()
	const currentProjectContext = useCurrentProject()
	const { accountId, projectId } = useParams()
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
				return {
					facet_account_id: row.facet_account_id,
					label: facetMeta?.alias || facetMeta?.label || `ID:${row.facet_account_id}`,
					kind_slug: facetMeta?.kind_slug || "",
					source: row.source ?? null,
					confidence: row.confidence ?? null,
				}
			})
			return { person, facets: personFacets }
		})
	}, [people, facetsById])

	const tableRows = useMemo<PersonTableRow[]>(() => {
		return peopleWithFacets.map(({ person, facets }) => {
			const persona = person.people_personas?.[0]?.personas
			const primaryOrgLink =
				person.people_organizations?.find((link) => link.is_primary) ?? person.people_organizations?.[0]
			const primaryOrganization = primaryOrgLink?.organization ?? null
			const jobTitle = (person as { title?: string | null }).title ?? null
			return {
				id: person.id,
				name: person.name || "Unnamed person",
				title: jobTitle,
				segment: person.segment ?? null,
				persona: persona
					? {
							id: persona.id,
							name: persona.name,
						}
					: null,
				personaColor: persona?.color_hex || null,
				organization: primaryOrganization
					? {
							id: primaryOrganization.id,
							name: primaryOrganization.name || primaryOrganization.website_url || null,
						}
					: null,
				interviewCount: person.interview_people?.length ?? 0,
				keySignals: facets.map((facet) => facet.label),
				updatedAt: person.updated_at ?? null,
			}
		})
	}, [peopleWithFacets])

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
							<h1 className="font-semibold text-3xl text-foreground">People</h1>
							<p className="mt-2 max-w-2xl text-muted-foreground text-sm">
								Track the people behind your interviews. Explore linked personas, signals, and engagement recency from
								one view.
							</p>
						</div>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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

				{people.length === 0 ? (
					<div className="rounded-lg border border-dashed bg-muted/40 py-16 text-center">
						<div className="mx-auto max-w-md space-y-4">
							<h3 className="font-semibold text-foreground text-xl">No people yet</h3>
							<p className="text-muted-foreground text-sm">
								Add your first person to start tracking research participants and contacts.
							</p>
							<Button asChild>
								<Link to={routes.people.new()}>Add Person</Link>
							</Button>
						</div>
					</div>
				) : viewMode === "table" ? (
					<PeopleDataTable rows={tableRows} />
				) : (
					<div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
						{peopleWithFacets.map(({ person, facets }) => (
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
								facets={facets}
							/>
						))}
					</div>
				)}
			</PageContainer>
		</>
	)
}
