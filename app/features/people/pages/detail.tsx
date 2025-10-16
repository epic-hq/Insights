import { motion } from "framer-motion"
import { useMemo } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getOrganizations, linkPersonToOrganization, unlinkPersonFromOrganization } from "~/features/organizations/db"
import { getPersonById } from "~/features/people/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
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

	if (!accountId || !projectId || !personId) {
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
			throw new Response("Person not found", { status: 404 })
		}
		if (organizations.error) {
			throw new Response("Failed to load organizations", { status: 500 })
		}
		return { person, catalog, organizations: organizations.data ?? [] }
	} catch {
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
	const routes = useProjectRoutes(projectPath || "")

	const interviews = person.interview_people || []
	const people_personas = person.people_personas || []
	const primaryPersona = people_personas.length > 0 ? people_personas[0] : null
	const persona = primaryPersona?.personas
	const themeColor = persona?.color_hex || "#6366f1"
	const name = person.name || "Unnamed Person"
	const initials =
		name
			.split(" ")
			.map((word) => word[0])
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

	const personScales = useMemo(() => {
		return (person.person_scale ?? []).map((row) => ({
			kind_slug: row.kind_slug,
			score: row.score,
			band: row.band || null,
			confidence: row.confidence ?? null,
			source: row.source || null,
		}))
	}, [person.person_scale])

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

	return (
		<div className="mx-auto max-w-4xl py-8">
			<motion.div
				className="relative mb-8 flex flex-col items-center rounded-xl border border-border bg-background p-8 shadow-md"
				style={{ borderColor: themeColor }}
				initial={{ opacity: 0, y: 16 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				{/* Persona color accent bar */}
				<div className="absolute top-0 left-0 h-1 w-full rounded-t-xl" style={{ backgroundColor: themeColor }} />
				<div className="flex w-full items-center justify-between">
					<div className="flex items-center gap-6">
						<Avatar className="h-20 w-20 border-2" style={{ borderColor: themeColor }}>
							{person.image_url && <AvatarImage src={person.image_url} alt={name} />}
							<AvatarFallback className="bg-primary text-primary-foreground" style={{ backgroundColor: themeColor }}>
								{initials}
							</AvatarFallback>
						</Avatar>
						<div>
							<h1 className="mb-2 font-bold text-3xl text-foreground">{name}</h1>
							{persona?.name && (
								<span
									className="inline-block rounded-full px-3 py-1 font-semibold text-xs"
									style={{ backgroundColor: `${themeColor}22`, color: themeColor }}
								>
									{persona.name}
								</span>
							)}
							{person.segment && <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">{person.segment}</span>}
						</div>
					</div>
					<Button asChild variant="outline">
						<Link to={routes.people.edit(person.id)}>Edit</Link>
					</Button>
				</div>
				{person.description && (
					<p className="mt-4 w-full max-w-2xl whitespace-pre-wrap text-base text-foreground">{person.description}</p>
				)}
			</motion.div>
			{/* Persona Section (optional, could be expanded for more personas) */}
			{/* Interview History & Stats */}
			<div className="grid gap-8 lg:grid-cols-3">
				<div className="space-y-4 lg:col-span-2">
					<motion.div
						className="rounded-xl border bg-background p-6"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
					>
						<div className="flex items-start justify-between">
							<div>
								<h3 className="mb-1 font-semibold text-xl">Organizations</h3>
								<p className="text-muted-foreground text-sm">
									Link this person to companies they belong to for better account context.
								</p>
								{organizations.length === 0 && (
									<p className="mt-2 text-muted-foreground text-xs">
										No organizations yet. Create one to link this person.
									</p>
								)}
							</div>
							<Button asChild variant="outline" className="hidden sm:inline-flex">
								<Link to={routes.organizations.new()}>New organization</Link>
							</Button>
						</div>
						<Button asChild variant="outline" className="mt-4 w-full sm:hidden">
							<Link to={routes.organizations.new()}>New organization</Link>
						</Button>

						<div className="mt-4 space-y-3">
							{sortedLinkedOrganizations.length === 0 ? (
								<div className="rounded-lg border border-muted-foreground/30 border-dashed p-4 text-muted-foreground text-sm">
									No organizations linked yet.
								</div>
							) : (
								sortedLinkedOrganizations.map((link) => (
									<div
										key={link.id}
										className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
									>
										<div>
											<Link
												to={routes.organizations.detail(link.organization!.id)}
												className="font-medium text-foreground text-sm hover:text-primary"
											>
												{link.organization?.name}
											</Link>
											<div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
												{link.organization?.domain && <span>{link.organization?.domain}</span>}
												{link.role && <Badge variant="outline">{link.role}</Badge>}
												{link.relationship_status && <Badge variant="secondary">{link.relationship_status}</Badge>}
											</div>
											{link.notes && <p className="mt-1 text-muted-foreground text-xs">{link.notes}</p>}
										</div>
										<Form method="post" className="flex justify-end">
											<input type="hidden" name="_action" value="unlink-organization" />
											<input type="hidden" name="organization_id" value={link.organization!.id} />
											<Button variant="ghost" size="sm">
												Remove
											</Button>
										</Form>
									</div>
								))
							)}
						</div>

						<div className="mt-6 border-border/70 border-t pt-6">
							{actionData?.error && (
								<div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
									{actionData.error}
								</div>
							)}
							<Form method="post" className="grid gap-4 sm:grid-cols-2">
								<input type="hidden" name="_action" value="link-organization" />
								<div className="sm:col-span-2">
									<Label htmlFor="organization_id">Organization</Label>
									<Select
										name="organization_id"
										defaultValue={availableOrganizations[0]?.id ?? ""}
										disabled={availableOrganizations.length === 0}
									>
										<SelectTrigger id="organization_id" className="mt-1">
											<SelectValue
												placeholder={
													availableOrganizations.length ? "Select an organization" : "No available organizations"
												}
											/>
										</SelectTrigger>
										<SelectContent>
											{availableOrganizations.length === 0 ? (
												<SelectItem value="" disabled>
													No organizations available
												</SelectItem>
											) : (
												availableOrganizations.map((organization) => (
													<SelectItem key={organization.id} value={organization.id}>
														{organization.name}
													</SelectItem>
												))
											)}
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label htmlFor="role">Role</Label>
									<Input id="role" name="role" placeholder="e.g., Buyer" className="mt-1" />
								</div>
								<div>
									<Label htmlFor="relationship_status">Relationship Status</Label>
									<Input
										id="relationship_status"
										name="relationship_status"
										placeholder="e.g., Champion"
										className="mt-1"
									/>
								</div>
								<div className="sm:col-span-2">
									<Label htmlFor="notes">Notes</Label>
									<Textarea
										id="notes"
										name="notes"
										rows={3}
										placeholder="Add context about this relationship"
										className="mt-1"
									/>
								</div>
								<div className="flex justify-end sm:col-span-2">
									<Button type="submit" disabled={availableOrganizations.length === 0}>
										Link organization
									</Button>
								</div>
							</Form>
							{availableOrganizations.length === 0 && organizations.length > 0 && (
								<p className="mt-3 text-muted-foreground text-xs">
									All organizations are already linked to this person.
								</p>
							)}
						</div>
					</motion.div>

					{facetsGrouped.length > 0 ? (
						<motion.div
							className="rounded-xl border bg-background p-6"
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2, duration: 0.4 }}
						>
							<h3 className="mb-4 font-semibold">Facets</h3>
							<div className="space-y-3">
								{facetsGrouped.map((group) => (
									<div key={group.kind_slug}>
										<div className="mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
											{group.label}
										</div>
										<div className="flex flex-wrap gap-2">
											{group.facets.map((facet) => (
												<Badge key={`${person.id}-${facet.facet_ref}`} variant="secondary" className="capitalize">
													{facet.label}
												</Badge>
											))}
										</div>
									</div>
								))}
							</div>
						</motion.div>
					) : (
						<motion.div
							className="rounded-xl border bg-background p-6"
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2, duration: 0.4 }}
						>
							<h3 className="mb-4 font-semibold">Facets</h3>
							<p className="text-muted-foreground text-sm">No facets assigned yet.</p>
						</motion.div>
					)}
					<div className="h-4">
						{personScales.length > 0 && (
							<motion.div
								className="rounded-xl border bg-background p-6"
								initial={{ opacity: 0, y: 16 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.25, duration: 0.4 }}
							>
								<h3 className="mb-4 font-semibold">Scales</h3>
								<div className="space-y-3">
									{personScales.map((scale) => (
										<div key={`${person.id}-${scale.kind_slug}`} className="rounded border px-3 py-2">
											<div className="font-medium text-sm capitalize">{scale.kind_slug.replace(/_/g, " ")}</div>
											<div className="text-muted-foreground text-xs">
												Score: {Math.round((Number(scale.score) || 0) * 100)}%
												{scale.band && <span className="ml-2 uppercase">({scale.band})</span>}
											</div>
										</div>
									))}
								</div>
							</motion.div>
						)}
					</div>
				</div>

				{/* Right Sidebar */}
				<div className="space-y-6">
					{interviews.length > 0 && (
						<motion.div
							className="rounded-xl border bg-background p-6"
							initial={{ opacity: 0, y: 16 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.4 }}
						>
							<h2 className="mb-4 font-semibold text-xl">Interview History</h2>
							<div className="space-y-4">
								{interviews.map((interviewPerson) => (
									<motion.div
										key={interviewPerson.interviews.id}
										className="border-l-4 pl-4"
										style={{ borderColor: themeColor }}
										whileHover={{ scale: 1.01, backgroundColor: `${themeColor}0A` }}
									>
										<Link
											to={routes.interviews.detail(interviewPerson.interviews.id)}
											className="font-medium text-blue-600 hover:text-blue-800"
										>
											{interviewPerson.interviews.title}
										</Link>
										{interviewPerson.interviews.interview_date && (
											<div className="text-muted-foreground text-sm">
												{new Date(interviewPerson.interviews.interview_date).toLocaleDateString()}
											</div>
										)}
										{interviewPerson.interviews.duration_sec && (
											<div className="text-muted-foreground text-sm">
												Duration: {interviewPerson.interviews.duration_sec / 60} minutes
											</div>
										)}
									</motion.div>
								))}
							</div>
						</motion.div>
					)}
					<motion.div
						className="rounded-xl border bg-background p-6"
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.15, duration: 0.4 }}
					>
						<h3 className="mb-4 font-semibold">Statistics</h3>
						<div className="space-y-3">
							<div>
								<label className="font-medium text-muted-foreground text-sm">Added</label>
								<div className="mt-1 text-foreground text-sm">{new Date(person.created_at).toLocaleDateString()}</div>
							</div>
							{person.updated_at && (
								<div>
									<label className="font-medium text-muted-foreground text-sm">Last Updated</label>
									<div className="mt-1 text-foreground text-sm">{new Date(person.updated_at).toLocaleDateString()}</div>
								</div>
							)}
						</div>
					</motion.div>
				</div>
			</div>
		</div>
	)
}
