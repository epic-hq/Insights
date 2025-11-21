import { Building2, Globe, LinkIcon, Mail, MapPin, Phone, Trash2, Users } from "lucide-react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router-dom"
import { LinkPersonDialog } from "~/components/dialogs/LinkPersonDialog"
import { DetailPageHeader } from "~/components/layout/DetailPageHeader"
import { PageContainer } from "~/components/layout/PageContainer"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select"
import { Textarea } from "~/components/ui/textarea"
import { useCurrentProject } from "~/contexts/current-project-context"
import {
	getOrganizationById,
	getProjectPeopleSummary,
	linkPersonToOrganization,
	unlinkPersonFromOrganization,
} from "~/features/organizations/db"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { syncTitleToJobFunctionFacet } from "~/features/people/syncTitleToFacet.server"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Organization, PeopleOrganization, Person } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

// Helper to parse full name into first and last
function parseFullName(fullName: string): { firstname: string; lastname: string | null } {
	const trimmed = fullName.trim()
	if (!trimmed) return { firstname: "", lastname: null }
	const parts = trimmed.split(/\s+/)
	if (parts.length === 1) {
		return { firstname: parts[0], lastname: null }
	}
	return {
		firstname: parts[0],
		lastname: parts.slice(1).join(" "),
	}
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	const title = data?.organization?.name ? `${data.organization.name} | Organizations` : "Organization"
	return [{ title }, { name: "description", content: "Organization details and linked people" }]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId
	const organizationId = params.organizationId

	if (!accountId || !projectId || !organizationId) {
		throw new Response("Account ID, Project ID, and Organization ID are required", { status: 400 })
	}

	const [{ data, error }, { data: people }] = await Promise.all([
		getOrganizationById({ supabase, accountId, projectId, id: organizationId }),
		getProjectPeopleSummary({ supabase, accountId, projectId }),
	])

	if (error || !data) {
		throw new Response("Failed to load organization", { status: 500 })
	}

	return {
		organization: data as Organization & {
			people_organizations: Array<
				PeopleOrganization & {
					person: Pick<Person, "id" | "name" | "image_url" | "segment" | "title">
				}
			>
		},
		people: (people as Array<Pick<Person, "id" | "name" | "image_url" | "segment" | "title">>) ?? [],
	}
}

export async function action({ request, params, context }: ActionFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase
	const accountId = params.accountId
	const projectId = params.projectId
	const organizationId = params.organizationId

	if (!accountId || !projectId || !organizationId) {
		throw new Response("Account ID, Project ID, and Organization ID are required", { status: 400 })
	}

	const routes = createProjectRoutes(accountId, projectId)
	const formData = await request.formData()
	const intent = formData.get("_action")

	if (intent === "link-person") {
		const personId = (formData.get("person_id") as string | null)?.trim()
		if (!personId) {
			return { error: "Person is required" }
		}

		const role = (formData.get("role") as string | null)?.trim() || null
		const relationshipStatus = (formData.get("relationship_status") as string | null)?.trim() || null
		const notes = (formData.get("notes") as string | null)?.trim() || null

		const { error } = await linkPersonToOrganization({
			supabase,
			accountId,
			projectId,
			organizationId,
			personId,
			role,
			relationshipStatus,
			notes,
		})

		if (error) {
			return { error: "Failed to link person" }
		}

		return redirect(routes.organizations.detail(organizationId))
	}

	if (intent === "unlink-person") {
		const personId = formData.get("person_id") as string | null
		if (!personId) {
			return { error: "Person is required" }
		}

		const { error } = await unlinkPersonFromOrganization({
			supabase,
			accountId,
			projectId,
			organizationId,
			personId,
		})

		if (error) {
			return { error: "Failed to unlink person" }
		}

		return redirect(routes.organizations.detail(organizationId))
	}

	if (intent === "create-and-link-person") {
		const name = (formData.get("name") as string | null)?.trim()
		if (!name) {
			return { error: "Person name is required" }
		}

		const { firstname, lastname } = parseFullName(name)
		const primaryEmail = (formData.get("primary_email") as string | null)?.trim() || null
		const title = (formData.get("title") as string | null)?.trim() || null
		const role = (formData.get("role") as string | null)?.trim() || null
		const relationshipStatus = (formData.get("relationship_status") as string | null)?.trim() || null
		const notes = (formData.get("notes") as string | null)?.trim() || null

		// Create the person
		const { data: newPerson, error: createError } = await supabase
			.from("people")
			.insert({
				account_id: accountId,
				project_id: projectId,
				firstname,
				lastname,
				primary_email: primaryEmail,
				title,
			})
			.select()
			.single()

		if (createError || !newPerson) {
			return { error: "Failed to create person" }
		}

		// Link person to project
		await supabase.from("project_people").insert({
			project_id: projectId,
			person_id: newPerson.id,
		})

		// If title was provided, sync it to job_function facet
		if (title) {
			await syncTitleToJobFunctionFacet({
				supabase,
				personId: newPerson.id,
				accountId,
				title,
			})
		}

		// Link the person to the organization
		const { error: linkError } = await linkPersonToOrganization({
			supabase,
			accountId,
			projectId,
			organizationId,
			personId: newPerson.id,
			role,
			relationshipStatus,
			notes,
		})

		if (linkError) {
			return { error: "Person created but failed to link" }
		}

		return redirect(routes.organizations.detail(organizationId))
	}

	return redirect(routes.organizations.detail(organizationId))
}

export default function OrganizationDetailPage() {
	const { organization, people } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || `/a/${organization.account_id ?? ""}/${organization.project_id ?? ""}`)

	const linkedPersonIds = new Set((organization.people_organizations || []).map((link) => link.person.id))
	const availablePeople = people.filter((person) => !linkedPersonIds.has(person.id))

	return (
		<PageContainer>
			<PersonaPeopleSubnav />
			<div className="mx-auto max-w-5xl px-4 py-10">
				<DetailPageHeader
					icon={Building2}
					typeLabel="Organization"
					title={organization.name}
					metadata={
						<>
							{organization.website_url && (
								<a
									href={organization.website_url}
									target="_blank"
									rel="noreferrer"
									className="flex items-center gap-1 text-primary transition-colors hover:underline"
								>
									<Globe className="h-4 w-4" /> {organization.website_url}
								</a>
							)}
							{organization.domain && !organization.website_url && (
								<span className="flex items-center gap-1">
									<LinkIcon className="h-4 w-4" />
									{organization.domain}
								</span>
							)}
							{organization.headquarters_location && (
								<span className="flex items-center gap-1">
									<MapPin className="h-4 w-4" />
									{organization.headquarters_location}
								</span>
							)}
							{organization.phone && (
								<span className="flex items-center gap-1">
									<Phone className="h-4 w-4" /> {organization.phone}
								</span>
							)}
							{organization.email && (
								<span className="flex items-center gap-1">
									<Mail className="h-4 w-4" /> {organization.email}
								</span>
							)}
						</>
					}
					badges={
						(organization.industry || organization.size_range || organization.company_type) && (
							<>
								{organization.industry && <Badge variant="outline">{organization.industry}</Badge>}
								{organization.company_type && <Badge variant="outline">{organization.company_type}</Badge>}
								{organization.size_range && <Badge variant="outline">Size: {organization.size_range}</Badge>}
							</>
						)
					}
					description={organization.description}
				/>

				<div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
					<Card className="border border-border/80">
						<CardHeader className="flex flex-col gap-2">
							<CardTitle className="flex items-center gap-2 text-xl">
								<Users className="h-5 w-5" /> Linked People
							</CardTitle>
							<p className="text-muted-foreground text-sm">
								Track everyone associated with this organization and their roles.
							</p>
						</CardHeader>
						<CardContent className="space-y-4">
							{(organization.people_organizations || []).length === 0 ? (
								<div className="rounded-lg border border-muted-foreground/30 border-dashed p-6 text-center text-muted-foreground text-sm">
									No people linked yet. Use the form to link existing people.
								</div>
							) : (
								<div className="space-y-3">
									{organization.people_organizations.map((link) => {
										const person = link.person
										const initials = (person.name || "?")
											.split(" ")
											.map((part) => part[0])
											.join("")
											.slice(0, 2)
											.toUpperCase()
										return (
											<div
												key={link.id}
												className="flex items-center justify-between rounded-lg border border-border/80 bg-card px-4 py-3"
											>
												<div className="flex items-center gap-3">
													<Avatar className="h-10 w-10">
														{person.image_url && <AvatarImage src={person.image_url} alt={person.name ?? "Person"} />}
														<AvatarFallback>{initials}</AvatarFallback>
													</Avatar>
													<div>
														<Link
															to={routes.people.detail(person.id)}
															className="font-medium text-foreground text-sm hover:text-primary"
														>
															{person.name}
														</Link>
														<div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
															{person.title && <span>{person.title}</span>}
															{person.segment && <span>{person.segment}</span>}
															{link.role && <Badge variant="outline">{link.role}</Badge>}
															{link.relationship_status && (
																<Badge variant="secondary">{link.relationship_status}</Badge>
															)}
														</div>
														{link.notes && <p className="mt-1 text-muted-foreground text-xs">{link.notes}</p>}
													</div>
												</div>
												<Form method="post">
													<input type="hidden" name="_action" value="unlink-person" />
													<input type="hidden" name="person_id" value={person.id} />
													<Button
														variant="ghost"
														size="icon"
														className="text-muted-foreground hover:text-destructive"
														title="Remove link"
													>
														<Trash2 className="h-4 w-4" />
													</Button>
												</Form>
											</div>
										)
									})}
								</div>
							)}
						</CardContent>
					</Card>

					{actionData?.error && (
						<div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
							{actionData.error}
						</div>
					)}
					<LinkPersonDialog entityId={organization.id} entityType="organization" availablePeople={availablePeople} />
				</div>
			</div>
		</PageContainer>
	)
}
