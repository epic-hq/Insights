import consola from "consola"
import { UserCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, Link, redirect, useActionData, useLoaderData, useNavigate, useParams } from "react-router-dom"
import { DetailPageHeader } from "~/components/layout/DetailPageHeader"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getOrganizations, linkPersonToOrganization, unlinkPersonFromOrganization } from "~/features/organizations/db"
import { getPersonById } from "~/features/people/db"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { InsightCardV3 } from "~/features/insights/components/InsightCardV3"
import { useProjectRoutes, useProjectRoutesFromIds } from "~/hooks/useProjectRoutes"
import { getFacetCatalog } from "~/lib/database/facets.server"
import { userContext } from "~/server/user-context"
import { createProjectRoutes } from "~/utils/routes.server"
import type { Insight } from "~/types"

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
	const navigate = useNavigate()
	const routesByIds = useProjectRoutesFromIds(accountId ?? "", projectId ?? "")
	const routesByPath = useProjectRoutes(projectPath || "")
	const routes = accountId && projectId ? routesByIds : routesByPath

	const interviewLinks = (person.interview_people || []).filter((ip) => ip.interviews?.id)
	const peoplePersonas = person.people_personas || []
	const primaryPersona = peoplePersonas.length > 0 ? peoplePersonas[0] : null
	const persona = primaryPersona?.personas
	const themeColor = persona?.color_hex || "#6366f1"
	const name = person.name || "Unnamed Person"
	const descriptionText =
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
			const interviewInsights = (link.interviews as any)?.insights || []
			for (const insight of interviewInsights) {
				if (insight?.id && !collected.has(insight.id)) {
					collected.set(insight.id, insight as Insight)
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

	const personFacets = useMemo(() => {
		return (person.person_facet ?? []).map((row) => {
			const meta = facetsById.get(row.facet_account_id)
			return {
				facet_account_id: row.facet_account_id,
				label: meta?.alias || meta?.label || `ID:${row.facet_account_id}`,
				kind_slug: meta?.kind_slug || "",
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

	const handleAttachRecording = () => {
		if (!person.id) return
		const destination = `${routes.interviews.upload()}?personId=${person.id}`
		navigate(destination)
	}

	const metadataItems = [person.title, person.segment, person.age ? `${person.age} yrs old` : null].filter(
		Boolean
	) as string[]
	const metadataNode =
		metadataItems.length > 0
			? metadataItems.map((item) => (
					<span key={item} className="font-medium text-sm text-muted-foreground">
						{item}
					</span>
				))
			: undefined
	const badgeNode = persona?.name ? (
		<Link to={routes.personas.detail(persona.id)}>
			<Badge
				variant="secondary"
				className="text-xs font-medium"
				style={{ backgroundColor: `${themeColor}1a`, color: themeColor, borderColor: themeColor }}
			>
				Persona: {persona.name}
			</Badge>
		</Link>
	) : undefined
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

return (
	<div className="relative min-h-screen bg-muted/20">
		<PersonaPeopleSubnav />
		<PageContainer className="space-y-8 pb-16">
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<BackButton />
				<div className="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" onClick={handleAttachRecording}>
						Attach Recording
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={`${routes.evidence.index()}?person_id=${person.id}`}>View Evidence</Link>
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={routes.people.edit(person.id)}>Edit Person</Link>
					</Button>
				</div>
			</div>

			<DetailPageHeader
				icon={UserCircle}
				typeLabel="Person"
				title={name}
				description={descriptionText}
				metadata={metadataNode}
				badges={badgeNode}
			/>

			<div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
				<div className="space-y-6">
					<Card>
						<CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
							<Avatar className="h-20 w-20 border-2" style={{ borderColor: themeColor }}>
								{person.image_url && <AvatarImage src={person.image_url} alt={name} />}
								<AvatarFallback style={{ backgroundColor: `${themeColor}33`, color: themeColor }}>
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="space-y-3">
								<div className="flex flex-wrap gap-2">
									{person.segment && (
										<Badge variant="outline" className="text-xs">
											Segment: {person.segment}
										</Badge>
									)}
									{person.title && (
										<Badge variant="outline" className="text-xs">
											Role: {person.title}
										</Badge>
									)}
								</div>
								{person.description && <p className="text-sm text-muted-foreground">{person.description}</p>}
							</div>
						</CardContent>
					</Card>

					{facetsGrouped.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Key Attributes</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								{facetsGrouped.map((group) => (
									<div key={group.kind_slug} className="space-y-2">
										<h4 className="font-medium text-sm">{group.label}</h4>
										<div className="flex flex-wrap gap-2">
											{group.facets.map((facet) => (
												<Badge key={facet.facet_account_id} variant="secondary" className="text-xs">
													{facet.label}
												</Badge>
											))}
										</div>
									</div>
								))}
							</CardContent>
						</Card>
					)}

					<Card>
						<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
							<div>
								<CardTitle>Organizations</CardTitle>
								<p className="text-sm text-muted-foreground">Accounts linked to this participant.</p>
							</div>
							{availableOrganizations.length > 0 && !showLinkForm && (
								<Button variant="outline" size="sm" onClick={() => setShowLinkForm(true)}>
									Link organization
								</Button>
							)}
						</CardHeader>
						<CardContent className="space-y-4">
							{sortedLinkedOrganizations.length > 0 ? (
								<div className="space-y-3">
									{sortedLinkedOrganizations.map((link) => {
										const organization = link.organization
										if (!organization) return null
										return (
											<div
												key={link.id}
												className="flex items-center justify-between rounded-lg border border-border/60 bg-background p-3"
											>
												<div>
													<Link
														to={routes.organizations.detail(organization.id)}
														className="font-medium text-sm text-foreground hover:text-primary"
													>
														{organization.name}
													</Link>
													<div className="text-xs text-muted-foreground">
														{link.role || "Linked participant"}
													</div>
												</div>
												<Form method="post">
													<input type="hidden" name="_action" value="unlink-organization" />
													<input type="hidden" name="organization_id" value={organization.id} />
													<Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
														Remove
													</Button>
												</Form>
											</div>
										)
									})}
								</div>
							) : (
								<div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
									No organizations linked yet
								</div>
							)}

							{actionData?.error && (
								<div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{actionData.error}</div>
							)}

							{showLinkForm && availableOrganizations.length > 0 && (
								<Form method="post" className="space-y-3 rounded-lg border border-dashed p-4">
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
									<Input name="role" placeholder="Role or relationship" />
									<div className="flex gap-2">
										<Button type="submit" size="sm">
											Link
										</Button>
										<Button type="button" variant="ghost" size="sm" onClick={() => setShowLinkForm(false)}>
											Cancel
										</Button>
									</div>
								</Form>
							)}
						</CardContent>
					</Card>

					{relatedInsights.length > 0 && (
						<section className="space-y-3">
							<h2 className="font-semibold text-lg text-foreground">Related Insights</h2>
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
								{relatedInsights.map((insight) => (
									<InsightCardV3 key={insight.id} insight={insight} />
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
										<div className="text-xs uppercase tracking-wide text-muted-foreground">{fact.label}</div>
										<div className="font-medium text-sm text-foreground">{fact.value}</div>
									</div>
								))}
							</CardContent>
						</Card>

						<Card className="max-w-sm">
							<CardHeader>
								<CardTitle>Interview History</CardTitle>
							</CardHeader>
							<CardContent>
								{interviewLinks.length > 0 ? (
									<div className="space-y-3">
										{interviewLinks.slice(0, 4).map((link) => (
											<div
												key={link.id}
												className="rounded-lg border border-border/60 bg-background p-3 hover:border-primary/40"
											>
												<Link
													to={routes.interviews.detail(link.interviews?.id || "")}
													className="font-medium text-foreground hover:text-primary"
												>
													{link.interviews?.title || `Interview ${link.interviews?.id?.slice(0, 8) || "Unknown"}`}
												</Link>
												<p className="text-xs text-muted-foreground">
													{link.interviews?.created_at &&
														new Date(link.interviews.created_at).toLocaleDateString()}
												</p>
											</div>
										))}
										{interviewLinks.length > 4 && (
											<p className="text-center text-xs text-muted-foreground">
												+{interviewLinks.length - 4} more interviews
											</p>
										)}
									</div>
								) : (
									<p className="text-sm text-muted-foreground">No interviews yet</p>
								)}
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</PageContainer>
	</div>
)
}
