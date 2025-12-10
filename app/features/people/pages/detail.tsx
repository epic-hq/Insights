import consola from "consola"
import { Edit2, FileText, MoreVertical, Paperclip, RefreshCw, Trash2, UserCircle } from "lucide-react"
import { useMemo } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import {
	Link,
	redirect,
	useActionData,
	useFetcher,
	useLoaderData,
	useNavigate,
	useNavigation,
	useParams,
} from "react-router-dom"
import { DetailPageHeader } from "~/components/layout/DetailPageHeader"
import { PageContainer } from "~/components/layout/PageContainer"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "~/components/ui/dropdown-menu"
import { InlineEditableField } from "~/components/ui/InlineEditableField"
import { useCurrentProject } from "~/contexts/current-project-context"
import { InsightCardV3 } from "~/features/insights/components/InsightCardV3"
import { getOrganizations, linkPersonToOrganization, unlinkPersonFromOrganization } from "~/features/organizations/db"
import { deletePerson, getPersonById, updatePerson } from "~/features/people/db"
import { generatePersonDescription } from "~/features/people/services/generatePersonDescription.server"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes, useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"
import { getImageUrl } from "~/utils/storeImage.server"
import { PersonFacetLenses } from "../components/PersonFacetLenses"
import { generatePersonFacetSummaries } from "../services/generatePersonFacetSummaries.server"

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

	// consola.info("PersonDetail loader start", { accountId, projectId, personId, params })

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

		// Refresh or reuse facet lens summaries in-line so the accordion always has a headline
		const facetSummaries = await generatePersonFacetSummaries({
			supabase,
			person,
			projectId,
			accountId,
		})

		// Convert R2 key to presigned URL if needed
		let imageUrl = person.image_url
		if (imageUrl?.startsWith("images/")) {
			imageUrl = getImageUrl(imageUrl) ?? null
		}

		const personWithFacetSummaries = {
			...person,
			person_facet_summaries: facetSummaries,
			image_url: imageUrl,
		}

		consola.info("PersonDetail loader success", { personId: person.id, orgCount: organizations.data?.length ?? 0 })
		return { person: personWithFacetSummaries, catalog, organizations: organizations.data ?? [] }
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

	if (intent === "refresh-description") {
		try {
			const person = await getPersonById({
				supabase,
				accountId,
				projectId,
				id: personId,
			})
			const [summary] = await Promise.all([
				generatePersonDescription({
					supabase,
					person,
					projectId,
				}),
				generatePersonFacetSummaries({
					supabase,
					person,
					projectId,
					accountId,
					force: true,
				}),
			])
			await updatePerson({
				supabase,
				accountId,
				projectId,
				id: personId,
				data: { description: summary },
			})
			// Return success data instead of redirect to allow fetcher to handle revalidation
			return { refresh: { success: true, description: summary } }
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to refresh description."
			return { refresh: { error: message } }
		}
	}

	if (intent === "link-organization") {
		const organizationId = (formData.get("organization_id") as string | null)?.trim()
		if (!organizationId) {
			return { organization: { error: "Organization is required" } }
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
			return { organization: { error: "Failed to link organization" } }
		}

		return redirect(routes.people.detail(personId))
	}

	if (intent === "unlink-organization") {
		const organizationId = formData.get("organization_id") as string | null
		if (!organizationId) {
			return { organization: { error: "Organization is required" } }
		}

		const { error } = await unlinkPersonFromOrganization({
			supabase,
			accountId,
			projectId,
			personId,
			organizationId,
		})

		if (error) {
			return { organization: { error: "Failed to unlink organization" } }
		}

		return redirect(routes.people.detail(personId))
	}

	if (intent === "add-facet-signal") {
		const facetAccountId = formData.get("facet_account_id") as string | null
		if (!facetAccountId) {
			return { facet: { error: "Facet is required" } }
		}

		const { error } = await supabase.from("person_facet").insert({
			person_id: personId,
			account_id: accountId,
			project_id: projectId,
			facet_account_id: Number.parseInt(facetAccountId, 10),
			source: "manual",
			confidence: 1.0,
			noted_at: new Date().toISOString(),
		})

		if (error) {
			consola.error("Failed to add facet signal:", error)
			return { facet: { error: "Failed to add facet signal" } }
		}

		return redirect(routes.people.detail(personId))
	}

	if (intent === "create-and-add-facet-signal") {
		const kindSlug = (formData.get("kind_slug") as string | null)?.trim()
		const facetLabel = (formData.get("facet_label") as string | null)?.trim()

		if (!kindSlug || !facetLabel) {
			return { facet: { error: "Facet kind and label are required" } }
		}

		// Get the facet kind
		const { data: kind, error: kindError } = await supabase
			.from("facet_kind_global")
			.select("id")
			.eq("slug", kindSlug)
			.single()

		if (kindError || !kind) {
			return { facet: { error: "Invalid facet kind" } }
		}

		// Create slug from label
		const slug = facetLabel
			.toLowerCase()
			.trim()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-]/g, "")

		// Create or get the facet_account
		const { data: existingFacet } = await supabase
			.from("facet_account")
			.select("id")
			.eq("account_id", accountId)
			.eq("kind_id", kind.id)
			.eq("slug", slug)
			.single()

		let facetAccountId: number

		if (existingFacet) {
			facetAccountId = existingFacet.id
		} else {
			const { data: newFacet, error: createError } = await supabase
				.from("facet_account")
				.insert({
					account_id: accountId,
					kind_id: kind.id,
					slug,
					label: facetLabel,
					is_active: true,
				})
				.select("id")
				.single()

			if (createError || !newFacet) {
				consola.error("Failed to create facet:", createError)
				return { facet: { error: "Failed to create facet" } }
			}

			facetAccountId = newFacet.id
		}

		// Link the facet to the person
		const { error: linkError } = await supabase.from("person_facet").insert({
			person_id: personId,
			account_id: accountId,
			project_id: projectId,
			facet_account_id: facetAccountId,
			source: "manual",
			confidence: 1.0,
			noted_at: new Date().toISOString(),
		})

		if (linkError) {
			consola.error("Failed to link facet to person:", linkError)
			return { facet: { error: "Failed to link facet to person" } }
		}

		return redirect(routes.people.detail(personId))
	}

	if (intent === "remove-facet-signal") {
		const facetAccountId = formData.get("facet_account_id") as string | null
		if (!facetAccountId) {
			return { facet: { error: "Facet is required" } }
		}

		const { error } = await supabase
			.from("person_facet")
			.delete()
			.eq("person_id", personId)
			.eq("facet_account_id", Number.parseInt(facetAccountId, 10))

		if (error) {
			consola.error("Failed to remove facet signal:", error)
			return { facet: { error: "Failed to remove facet signal" } }
		}

		return redirect(routes.people.detail(personId))
	}

	if (intent === "delete") {
		try {
			await deletePerson({
				supabase,
				id: personId,
				accountId,
				projectId,
			})
			return redirect(routes.people.index())
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to delete person"
			consola.error("Failed to delete person:", error)
			return { delete: { error: message } }
		}
	}

	if (intent === "create-and-link-organization") {
		const name = (formData.get("name") as string | null)?.trim()
		if (!name) {
			return { organization: { error: "Organization name is required" } }
		}

		const headquartersLocation = (formData.get("headquarters_location") as string | null)?.trim() || null
		const role = (formData.get("role") as string | null)?.trim() || null

		// Create the organization
		const { data: newOrg, error: createError } = await supabase
			.from("organizations")
			.insert({
				account_id: accountId,
				project_id: projectId,
				name,
				headquarters_location: headquartersLocation,
			})
			.select()
			.single()

		if (createError || !newOrg) {
			return { organization: { error: "Failed to create organization" } }
		}

		// Link the person to the new organization
		const { error: linkError } = await linkPersonToOrganization({
			supabase,
			accountId,
			projectId,
			personId,
			organizationId: newOrg.id,
			role,
			relationshipStatus: null,
			notes: null,
		})

		if (linkError) {
			return { organization: { error: "Organization created but failed to link" } }
		}

		return redirect(routes.people.detail(personId))
	}

	return redirect(routes.people.detail(personId))
}

export default function PersonDetail() {
	const { person, catalog, organizations } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const _organizationActionData = actionData?.organization
	const refreshError = actionData?.refresh?.error
	const { projectPath } = useCurrentProject()
	const { accountId, projectId } = useParams()
	const navigate = useNavigate()
	const _navigation = useNavigation()
	const refreshFetcher = useFetcher<typeof action>()
	const routesByIds = useProjectRoutesFromIds(accountId ?? "", projectId ?? "")
	const routesByPath = useProjectRoutes(projectPath || "")
	const routes = accountId && projectId ? routesByIds : routesByPath

	const interviewLinks = (person.interview_people || []).filter((ip) => ip.interviews?.id)
	const peoplePersonas = person.people_personas || []
	const primaryPersona = peoplePersonas.length > 0 ? peoplePersonas[0] : null
	const persona = primaryPersona?.personas
	const themeColor = persona?.color_hex || "#6366f1"
	const name = person.name || "Unnamed Person"
	const _descriptionText =
		person.description ||
		[person.title, person.segment, persona?.name].filter(Boolean).join(" • ") ||
		"Interview participant profile"
	const initials =
		(name || "?")
			.split(" ")
			.map((w) => w[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "?"
	const relatedInsights = useMemo(() => {
		const collected = new Map<string, Insight>()
		for (const link of interviewLinks) {
			const interviewInsights = Array.isArray(link.interviews?.insights) ? (link.interviews?.insights as Insight[]) : []
			for (const insight of interviewInsights) {
				if (insight?.id && !collected.has(insight.id)) {
					collected.set(insight.id, insight)
				}
			}
		}
		return Array.from(collected.values())
	}, [interviewLinks])

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

	const facetSummaryMap = useMemo(() => {
		const map = new Map<string, { summary: string; generated_at: string | null }>()
		for (const row of person.person_facet_summaries ?? []) {
			map.set(row.kind_slug, {
				summary: row.summary,
				generated_at: row.generated_at ?? null,
			})
		}
		return map
	}, [person.person_facet_summaries])

	const personFacets = useMemo(() => {
		return (person.person_facet ?? []).map((row) => {
			const meta = facetsById.get(row.facet_account_id)
			const joinedFacet = row.facet as {
				label?: string | null
				facet_kind_global?: { slug?: string | null } | null
			} | null
			const fallbackLabel = joinedFacet?.label ?? null
			const fallbackKindSlug = joinedFacet?.facet_kind_global?.slug ?? ""

			return {
				facet_account_id: row.facet_account_id,
				label: meta?.alias || meta?.label || fallbackLabel || `ID:${row.facet_account_id}`,
				kind_slug: meta?.kind_slug || fallbackKindSlug || "",
				source: row.source || null,
				confidence: row.confidence ?? null,
			}
		})
	}, [person.person_facet, facetsById])

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

	const facetLensGroups = useMemo(() => {
		return facetsGrouped.map((group) => ({
			...group,
			summary: facetSummaryMap.get(group.kind_slug)?.summary ?? null,
		}))
	}, [facetsGrouped, facetSummaryMap])

	const availableFacetsByKind = useMemo(() => {
		const grouped: Record<string, Array<{ id: number; label: string; slug: string }>> = {}
		for (const facet of catalog.facets) {
			const kindSlug = facet.kind_slug
			if (!grouped[kindSlug]) {
				grouped[kindSlug] = []
			}
			grouped[kindSlug].push({
				id: facet.facet_account_id,
				label: facet.label,
				slug: facet.slug || facet.label.toLowerCase().replace(/\s+/g, "-"),
			})
		}
		return grouped
	}, [catalog.facets])

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

	// Organization linking is now handled by LinkOrganizationDialog modal

	const handleAttachRecording = () => {
		if (!person.id) return
		const destination = `${routes.interviews.upload()}?personId=${person.id}`
		navigate(destination)
	}

	const metadataNode = (
		<>
			<InlineEditableField
				value={person.title}
				table="people"
				id={person.id}
				field="title"
				placeholder="Add job title"
				className="font-medium text-muted-foreground text-sm"
			/>
			{person.segment && <span className="font-medium text-muted-foreground text-sm">{person.segment}</span>}
			{person.age && <span className="font-medium text-muted-foreground text-sm">{person.age} yrs old</span>}
		</>
	)
	const avatarNode = (
		<Avatar className="h-20 w-20 border-2" style={{ borderColor: themeColor }}>
			{person.image_url && <AvatarImage src={person.image_url} alt={name} />}
			<AvatarFallback style={{ backgroundColor: `${themeColor}33`, color: themeColor }}>{initials}</AvatarFallback>
		</Avatar>
	)
	const personaBadgeNode = persona?.name ? (
		<div className="mb-3 flex justify-start">
			<Link to={routes.personas.detail(persona.id)}>
				<Badge
					variant="secondary"
					className="font-medium text-xs"
					style={{ backgroundColor: `${themeColor}1a`, color: themeColor, borderColor: themeColor }}
				>
					Persona: {persona.name}
				</Badge>
			</Link>
		</div>
	) : null
	const quickFacts: Array<{ label: string; value: string }> = [
		person.segment ? { label: "Segment", value: person.segment } : null,
		person.title ? { label: "Role", value: person.title } : null,
		person.email ? { label: "Email", value: person.email } : null,
		person.phone ? { label: "Phone", value: person.phone } : null,
		person.created_at ? { label: "Added", value: new Date(person.created_at).toLocaleDateString() } : null,
		person.updated_at ? { label: "Updated", value: new Date(person.updated_at).toLocaleDateString() } : null,
		peoplePersonas.length ? { label: "Persona Links", value: String(peoplePersonas.length) } : null,
		{ label: "Interviews", value: String(interviewLinks.length) },
	].filter((fact): fact is { label: string; value: string } => Boolean(fact?.value))
	const isRefreshingDescription = refreshFetcher.state === "submitting" || refreshFetcher.state === "loading"
	const fetcherRefreshError = refreshFetcher.data?.refresh?.error
	const isFacetSummaryPending = facetLensGroups.some((group) => !group.summary)

	return (
		<div className="relative min-h-screen bg-muted/20">
			<PersonaPeopleSubnav />
			<PageContainer className="space-y-8 pb-16">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<BackButton />
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="gap-2">
								<MoreVertical className="h-4 w-4" />
								Actions
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={handleAttachRecording}>
								<Paperclip className="mr-2 h-4 w-4" />
								Attach Recording
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to={`${routes.evidence.index()}?person_id=${person.id}`}>
									<FileText className="mr-2 h-4 w-4" />
									View Evidence
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link to={routes.people.edit(person.id)}>
									<Edit2 className="mr-2 h-4 w-4" />
									Edit Person
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									refreshFetcher.submit({ _action: "refresh-description" }, { method: "post" })
								}}
								disabled={isRefreshingDescription}
							>
								<RefreshCw className="mr-2 h-4 w-4" />
								{isRefreshingDescription ? "Refreshing..." : "Refresh Description"}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => {
									if (
										window.confirm(
											`Are you sure you want to delete ${person.name || "this person"}? This action cannot be undone.`
										)
									) {
										refreshFetcher.submit({ _action: "delete" }, { method: "post" })
									}
								}}
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete Person
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{(refreshError || fetcherRefreshError) && (
					<div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm">
						{refreshError || fetcherRefreshError}
					</div>
				)}

				<DetailPageHeader
					icon={UserCircle}
					typeLabel="Person"
					title={
						<InlineEditableField
							value={person.name}
							table="people"
							id={person.id}
							field="name"
							placeholder="Enter name"
							className="font-bold text-3xl text-foreground"
						/>
					}
					description={
						<InlineEditableField
							value={person.description}
							table="people"
							id={person.id}
							field="description"
							placeholder="Add a description"
							multiline
							rows={3}
							className="text-foreground"
						/>
					}
					metadata={metadataNode}
					avatar={avatarNode}
					aboveDescription={personaBadgeNode}
					organizations={{
						personId: person.id,
						sortedLinkedOrganizations,
						availableOrganizations,
						routes,
					}}
				/>

				<div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
					<div className="space-y-6">
						{facetLensGroups.length > 0 && (
							<PersonFacetLenses
								groups={facetLensGroups}
								personId={person.id}
								availableFacetsByKind={availableFacetsByKind}
								isGenerating={isRefreshingDescription || isFacetSummaryPending}
							/>
						)}

						{relatedInsights.length > 0 && (
							<section className="space-y-3">
								<h2 className="font-semibold text-foreground text-lg">Related Insights</h2>
								<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
									{relatedInsights.map((insight) => (
										<InsightCardV3 key={insight.id} insight={insight} />
									))}
								</div>
							</section>
						)}

						{interviewLinks.length > 0 && (
							<section className="space-y-3">
								<h2 className="font-semibold text-foreground text-lg">Interviews</h2>
								<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
									{interviewLinks.map((link) => (
										<Card key={link.id} className="transition-shadow hover:shadow-md">
											<CardContent className="p-4">
												<Link to={routes.interviews.detail(link.interviews?.id || "")} className="block space-y-2">
													<h3 className="font-medium text-foreground transition-colors hover:text-primary">
														{link.interviews?.title || `Interview ${link.interviews?.id?.slice(0, 8) || "Unknown"}`}
													</h3>
													<p className="text-muted-foreground text-sm">
														{link.interviews?.created_at && new Date(link.interviews.created_at).toLocaleDateString()}
													</p>
												</Link>
											</CardContent>
										</Card>
									))}
								</div>
							</section>
						)}
					</div>

					<div className="space-y-6">
						<div className="grid gap-4 md:grid-cols-2">
							<Card className="max-w-sm">
								<CardHeader>
									<CardTitle>Quick Facts</CardTitle>
								</CardHeader>
								<CardContent className="space-y-3">
									{quickFacts.map((fact) => (
										<div key={fact.label}>
											<div className="text-muted-foreground text-xs uppercase tracking-wide">{fact.label}</div>
											<div className="font-medium text-foreground text-sm">{fact.value}</div>
										</div>
									))}
								</CardContent>
							</Card>
						</div>
					</div>
				</div>
			</PageContainer>
		</div>
	)
}
