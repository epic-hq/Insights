import consola from "consola"
import { useEffect, useMemo, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, Link, redirect, useActionData, useLoaderData, useParams } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getOrganizations, linkPersonToOrganization, unlinkPersonFromOrganization } from "~/features/organizations/db"
import { getPersonById } from "~/features/people/db"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes, useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { userContext } from "~/server/user-context"
import { createProjectRoutes } from "~/utils/routes.server"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.person?.name || "Person"} | Insights` },
		{ name: "description", content: "Person details and interview history" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const personId = params.personId

	consola.info("PersonDetail loader start", { accountId, projectId, personId, params })

	if (!accountId || !projectId || !personId) {
		consola.error("PersonDetail loader missing params", { accountId, projectId, personId })
		throw new Response("Account ID, Project ID, and Person ID are required", { status: 400 })
	}

	try {
		const [person, catalog, organizations] = await Promise.all([
			getPersonById({
				supabase,
				accountId,
				projectId,
				id: personId,
			}),
			getFacetCatalog({ db: supabase, accountId, projectId }),
			getOrganizations({ supabase, accountId, projectId }),
		])

		if (!person) {
			consola.warn("PersonDetail loader: person not found", { accountId, projectId, personId })
			throw new Response("Person not found", { status: 404 })
		}
		if (organizations.error) {
			consola.error("PersonDetail loader: organizations fetch error", { error: organizations.error })
			throw new Response("Failed to load organizations", { status: 500 })
		}
		consola.info("PersonDetail loader success", { personId: person.id, orgCount: organizations.data?.length ?? 0 })
		return { person, catalog, organizations: organizations.data ?? [] }
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		consola.error("PersonDetail loader error", { accountId, projectId, personId, message, error })
		throw new Response("Failed to load person", { status: 500 })
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const accountId = params.accountId
	const projectId = params.projectId
	const personId = params.personId

	if (!accountId || !projectId || !personId) {
		throw new Response("Account ID, Project ID, and Person ID are required", { status: 400 })
	}

	const routes = createProjectRoutes(accountId, projectId)
	const formData = await request.formData()
	const intent = formData.get("_action")

	if (intent === "link-organization") {
		const organizationId = (formData.get("organization_id") as string | null)?.trim()
		if (!organizationId) {
			return { error: "Organization is required" }
		}

		const role = (formData.get("role") as string | null)?.trim() || null
		const relationshipStatus = (formData.get("relationship_status") as string | null)?.trim() || null
		const notes = (formData.get("notes") as string | null)?.trim() || null

		const { error } = await linkPersonToOrganization({
			supabase,
			accountId,
			projectId,
			personId,
			organizationId,
			role,
			relationshipStatus,
			notes,
		})

		if (error) {
			return { error: "Failed to link organization" }
		}

		return redirect(routes.people.detail(personId))
	}

	if (intent === "unlink-organization") {
		const organizationId = formData.get("organization_id") as string | null
		if (!organizationId) {
			return { error: "Organization is required" }
		}

		const { error } = await unlinkPersonFromOrganization({
			supabase,
			accountId,
			projectId,
			personId,
			organizationId,
		})

		if (error) {
			return { error: "Failed to unlink organization" }
		}

		return redirect(routes.people.detail(personId))
	}

	return redirect(routes.people.detail(personId))
}

export default function PersonDetail() {
	const { person, catalog, organizations } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const { projectPath } = useCurrentProject()
	const { accountId, projectId } = useParams()
	const routesByIds = useProjectRoutesFromIds(accountId ?? "", projectId ?? "")
	const routesByPath = useProjectRoutes(projectPath || "")
	const routes = accountId && projectId ? routesByIds : routesByPath

	const interviews = (person.interview_people || []).filter((ip) => ip.interviews?.id)
	const people_personas = person.people_personas || []
	const primaryPersona = people_personas.length > 0 ? people_personas[0] : null
	const persona = primaryPersona?.personas
	const themeColor = persona?.color_hex || "#6366f1"
	const name = person.name || "Unnamed Person"
	const initials =
		(name || "?")
			.split(" ")
			.map((w) => w[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "?"

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

	const personFacets = useMemo(() => {
		return (person.person_facet ?? []).map((row) => {
			const meta = facetsByRef.get(row.facet_ref)
			return {
				facet_ref: row.facet_ref,
				label: meta?.alias || meta?.label || row.facet_ref,
				kind_slug: meta?.kind_slug || "",
				source: row.source || null,
				confidence: row.confidence ?? null,
			}
		})
	}, [person.person_facet, facetsByRef])

	const facetsGrouped = useMemo(() => {
		const kindLabelMap = new Map(catalog.kinds.map((kind) => [kind.slug, kind.label]))
		const groups = new Map<string, { label: string; facets: typeof personFacets }>()
		for (const facet of personFacets) {
			const key = facet.kind_slug || "other"
			const label = kindLabelMap.get(facet.kind_slug) ?? (facet.kind_slug || "Other")
			if (!groups.has(key)) {
				groups.set(key, { label, facets: [] })
			}
			groups.get(key)?.facets.push(facet)
		}
		return Array.from(groups.entries()).map(([slug, value]) => ({ kind_slug: slug, ...value }))
	}, [personFacets, catalog.kinds])

	const linkedOrganizations = useMemo(() => {
		return (person.people_organizations ?? []).filter((link) => link.organization)
	}, [person.people_organizations])

	const sortedLinkedOrganizations = useMemo(() => {
		return [...linkedOrganizations].sort((a, b) => {
			const nameA = a.organization?.name || ""
			const nameB = b.organization?.name || ""
			return nameA.localeCompare(nameB)
		})
	}, [linkedOrganizations])

	const availableOrganizations = useMemo(() => {
		const linkedIds = new Set(
			linkedOrganizations.map((link) => link.organization?.id).filter((id): id is string => Boolean(id))
		)
		return organizations
			.filter((organization) => !linkedIds.has(organization.id))
			.slice()
			.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
	}, [linkedOrganizations, organizations])

	const [showLinkForm, setShowLinkForm] = useState(() => sortedLinkedOrganizations.length > 0)

	useEffect(() => {
		if (sortedLinkedOrganizations.length > 0) {
			setShowLinkForm(true)
		}
	}, [sortedLinkedOrganizations.length])

	useEffect(() => {
		if (actionData?.error) {
			setShowLinkForm(true)
		}
	}, [actionData?.error])

	return (
		<PageContainer size="lg" padded={false} className="max-w-6xl py-8">
			<PersonaPeopleSubnav />

			{/* Colored Header Section */}
			<div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-900">
				{/* Header with persona color */}
				<div className="h-20 w-full" style={{ backgroundColor: themeColor }}>
					<div className="flex flex-col p-4 md:flex-row md:items-center md:justify-between">
						<div className="flex items-center gap-3">
							<Avatar className="h-12 w-12 border-2" style={{ borderColor: "#ffffff55" }}>
								{person.image_url && <AvatarImage src={person.image_url} alt={name} />}
								<AvatarFallback className="bg-white/20 text-white">{initials}</AvatarFallback>
							</Avatar>
							<h1 className="font-bold text-2xl text-white">{name}</h1>
							<div className="flex items-center gap-2 text-white/90">
								{persona?.name && (
									<Link to={routes.personas.detail(persona.id)} className="hover:text-white">
										<Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
											{persona.name}
										</Badge>
									</Link>
								)}
								{person.segment && (
									<Badge variant="outline" className="border-white/30 text-white">
										{person.segment}
									</Badge>
								)}
							</div>
						</div>
						<div className="mt-2 flex gap-2 md:mt-0">
							<Button
								asChild
								variant="outline"
								size="sm"
								className="border-white/30 bg-white/10 text-white hover:bg-white/20"
							>
								<Link to={`${routes.evidence.index()}?person_id=${person.id}`}>View Evidence</Link>
							</Button>
							<Button
								asChild
								variant="outline"
								size="sm"
								className="border-white/30 bg-white/10 text-white hover:bg-white/20"
							>
								<Link to={routes.people.edit(person.id)}>Edit</Link>
							</Button>
						</div>
					</div>
				</div>

				{/* Main Content Grid - 2 columns like PersonaDetail */}
				<div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
					{/* Left Column - Description and Key Attributes */}
					<div className="space-y-6">
						{/* Description */}
						{person.description && (
							<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
								<h2 className="mb-3 font-semibold text-lg">About</h2>
								<p className="text-gray-700 dark:text-gray-300">{person.description}</p>
							</div>
						)}

						{/* Attributes/Facets */}
						{facetsGrouped.length > 0 && (
							<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
								<h2 className="mb-3 font-semibold text-lg">Key Attributes</h2>
								<div className="space-y-3">
									{facetsGrouped.map((group) => (
										<div key={group.kind_slug}>
											<h3 className="mb-2 font-medium text-sm">{group.label}</h3>
											<div className="flex flex-wrap gap-2">
												{group.facets.map((facet) => (
													<span
														key={facet.facet_ref}
														className="rounded bg-white px-2 py-1 text-xs shadow-sm dark:bg-gray-900"
													>
														{facet.label}
													</span>
												))}
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>

					{/* Right Column - Organizations and Interview History */}
					<div className="space-y-6">
						{/* Organizations Section */}
						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<div className="mb-3 flex items-center justify-between">
								<h2 className="font-semibold text-lg">Organizations</h2>
								<Button asChild variant="outline" size="sm">
									<Link to={routes.organizations.new()}>Add</Link>
								</Button>
							</div>

							{sortedLinkedOrganizations.length > 0 ? (
								<div className="space-y-3">
									{sortedLinkedOrganizations.map((link) => {
										const organization = link.organization
										if (!organization) return null
										return (
											<div key={link.id} className="flex items-center justify-between rounded-md border p-3">
												<div className="flex items-center gap-3">
													<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
														<span className="font-medium text-primary text-xs">
															{organization.name?.charAt(0)?.toUpperCase() || "?"}
														</span>
													</div>
													<div>
														<Link
															to={routes.organizations.detail(organization.id)}
															className="font-medium text-sm hover:text-primary"
														>
															{organization.name}
														</Link>
														{link.role && <div className="text-muted-foreground text-xs">{link.role}</div>}
													</div>
												</div>
												<Form method="post">
													<input type="hidden" name="_action" value="unlink-organization" />
													<input type="hidden" name="organization_id" value={organization.id} />
													<Button type="submit" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
														×
													</Button>
												</Form>
											</div>
										)
									})}
								</div>
							) : (
								<div className="rounded-md border border-dashed p-6 text-center">
									<p className="text-muted-foreground text-sm">No organizations linked</p>
								</div>
							)}

							{/* Link Form */}
							{actionData?.error && (
								<div className="mt-4 rounded-md bg-destructive/15 p-3 text-destructive text-sm">{actionData.error}</div>
							)}

							{showLinkForm ? (
								<Form method="post" className="mt-4 space-y-3">
									<input type="hidden" name="_action" value="link-organization" />
									<Select name="organization_id" defaultValue={availableOrganizations[0]?.id ?? ""}>
										<SelectTrigger>
											<SelectValue placeholder="Select organization" />
										</SelectTrigger>
										<SelectContent>
											{availableOrganizations.map((org) => (
												<SelectItem key={org.id} value={org.id}>
													{org.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<div className="flex gap-2">
										<Input name="role" placeholder="Role" className="flex-1" />
										<Button type="submit">Link</Button>
										<Button type="button" variant="outline" onClick={() => setShowLinkForm(false)}>
											Cancel
										</Button>
									</div>
								</Form>
							) : (
								availableOrganizations.length > 0 && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setShowLinkForm(true)}
										className="mt-4"
									>
										Link Organization
									</Button>
								)
							)}
						</div>

						{/* Interview History */}
						<div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
							<h2 className="mb-3 font-semibold text-lg">Interview History</h2>
							{interviews.length > 0 ? (
								<div className="space-y-2">
									{interviews.slice(0, 5).map((interviewPerson) => (
										<div
											key={interviewPerson.id}
											className="rounded bg-white p-3 shadow-sm transition-shadow hover:shadow-md dark:bg-gray-900"
										>
											<Link
												to={routes.interviews.detail(interviewPerson.interviews?.id || "")}
												className="font-medium text-blue-600 hover:text-blue-800"
											>
												{interviewPerson.interviews?.title ||
													`Interview ${interviewPerson.interviews?.id?.slice(0, 8) || "Unknown"}`}
											</Link>
											<p className="text-gray-400 text-xs">
												{interviewPerson.interviews?.created_at &&
													new Date(interviewPerson.interviews.created_at).toLocaleDateString()}
											</p>
										</div>
									))}
									{interviews.length > 5 && (
										<p className="pt-2 text-center text-gray-500">+{interviews.length - 5} more interviews</p>
									)}
								</div>
							) : (
								<p className="text-gray-500">No interviews yet</p>
							)}
						</div>
					</div>

					{/* Statistics - Full width like PersonaDetail */}
					<div className="rounded-lg bg-gray-50 p-4 md:col-span-2 dark:bg-gray-800">
						<h2 className="mb-3 font-semibold text-lg">Person Details</h2>
						<div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
							<div>
								<span className="text-gray-500">Added</span>
								<div className="font-medium">{new Date(person.created_at).toLocaleDateString()}</div>
							</div>
							<div>
								<span className="text-gray-500">Updated</span>
								<div className="font-medium">{new Date(person.updated_at).toLocaleDateString()}</div>
							</div>
							<div>
								<span className="text-gray-500">Interviews</span>
								<div className="font-medium">{interviews.length}</div>
							</div>
							<div>
								<span className="text-gray-500">Organizations</span>
								<div className="font-medium">{sortedLinkedOrganizations.length}</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</PageContainer>
	)
}
