import { useMemo } from "react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link, useParams } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { useCurrentProject } from "~/contexts/current-project-context"
import EnhancedPersonCard from "~/features/people/components/EnhancedPersonCard"
import { getPeople } from "~/features/people/db"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { getServerClient } from "~/lib/supabase/server"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction = () => {
	return [{ title: "People" }, { name: "description", content: "Manage research participants and contacts" }]
}

export async function loader({ request, params }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	// const accountId = jwt?.claims.sub
	//
	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}
	const _routes = createProjectRoutes(accountId, projectId)

	//
	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
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

	const facetsByRef = useMemo(() => {
		const map = new Map<string, { label: string; alias?: string; kind_slug: string }>()
		for (const facet of catalog.facets) {
			map.set(facet.facet_ref, {
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
				const facetMeta = facetsByRef.get(row.facet_ref)
				return {
					facet_ref: row.facet_ref,
					label: facetMeta?.alias || facetMeta?.label || row.facet_ref,
					kind_slug: facetMeta?.kind_slug || "",
					source: row.source || null,
					confidence: row.confidence ?? null,
				}
			})
			return { person, facets: personFacets }
		})
	}, [people, facetsByRef])

	return (
		<div className="relative min-h-screen bg-gray-50 dark:bg-gray-950">
			{/* Compact Subnav */}
			<PersonaPeopleSubnav />

			{/* Clean Header - Metro Style */}
			<div className="border-gray-200 border-b bg-white px-6 py-8 dark:border-gray-800 dark:bg-gray-950">
				<div className="mx-auto max-w-6xl">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="mt-2 text-gray-600 text-lg dark:text-gray-400"> </p>
						</div>
						<div className="flex flex-wrap gap-3">
							<Button asChild variant="secondary" className="border-gray-300 dark:border-gray-600">
								<Link to={routes.facets()}>Manage Facets</Link>
							</Button>
							<Button asChild variant="outline" className="border-gray-300 dark:border-gray-600">
								<Link to={routes.people.new()}>Add Person</Link>
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="mx-auto max-w-6xl px-6 py-12">
				{people.length === 0 ? (
					<div className="py-16 text-center">
						<div className="mx-auto max-w-md">
							<div className="mb-6 flex justify-center">
								<div className="rounded-full bg-gray-100 p-6 dark:bg-gray-800">
									<svg
										className="h-12 w-12 text-gray-400 dark:text-gray-500"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
										/>
									</svg>
								</div>
							</div>
							<h3 className="mb-3 font-semibold text-gray-900 text-xl dark:text-white">No people yet</h3>
							<p className="mb-8 text-gray-600 dark:text-gray-400">
								Add your first person to start tracking research participants and contacts.
							</p>
							<Button asChild>
								<Link to={routes.people.new()}>Add Person</Link>
							</Button>
						</div>
					</div>
				) : (
					<div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
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
			</div>
		</div>
	)
}
