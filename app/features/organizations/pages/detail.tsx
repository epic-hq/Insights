import { Building2, Globe, LinkIcon, Mail, MapPin, Phone, UserMinus, Users } from "lucide-react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router-dom"
import PageContainer from "~/components/layout/PageContainer"
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
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Organization, PeopleOrganization, Person } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

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
			<div className="mx-auto max-w-5xl px-4 py-10">
				<Card className="mb-8 border border-border/80">
					<CardHeader className="space-y-3">
						<Badge variant="secondary" className="w-fit gap-1 text-xs">
							<Building2 className="h-3.5 w-3.5" /> Organization
						</Badge>
						<CardTitle className="font-bold text-3xl text-foreground">{organization.name}</CardTitle>
						<div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
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
						</div>
						{(organization.industry || organization.size_range || organization.company_type) && (
							<div className="flex flex-wrap gap-2 text-muted-foreground text-xs">
								{organization.industry && <Badge variant="outline">{organization.industry}</Badge>}
								{organization.company_type && <Badge variant="outline">{organization.company_type}</Badge>}
								{organization.size_range && <Badge variant="outline">Size: {organization.size_range}</Badge>}
							</div>
						)}
					</CardHeader>
					{organization.description && (
						<CardContent>
							<p className="text-muted-foreground">{organization.description}</p>
						</CardContent>
					)}
				</Card>

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
															{link.relationship_status && <Badge variant="secondary">{link.relationship_status}</Badge>}
														</div>
														{link.notes && <p className="mt-1 text-muted-foreground text-xs">{link.notes}</p>}
													</div>
												</div>
												<Form method="post">
													<input type="hidden" name="_action" value="unlink-person" />
													<input type="hidden" name="person_id" value={person.id} />
													<Button variant="ghost" size="icon" className="text-muted-foreground" title="Remove link">
														<UserMinus className="h-4 w-4" />
													</Button>
												</Form>
											</div>
										)
									})}
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="border border-border/80">
						<CardHeader>
							<CardTitle className="text-xl">Link a person</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							{actionData?.error && (
								<div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
									{actionData.error}
								</div>
							)}
							<Form method="post" className="space-y-4">
								<input type="hidden" name="_action" value="link-person" />
								<div className="space-y-2">
									<Label htmlFor="person_id">Person</Label>
									<Select
										name="person_id"
										defaultValue={availablePeople[0]?.id ?? ""}
										disabled={availablePeople.length === 0}
									>
										<SelectTrigger id="person_id">
											<SelectValue placeholder={availablePeople.length ? "Select a person" : "No available people"} />
										</SelectTrigger>
										<SelectContent>
											{availablePeople.length === 0 ? (
												<SelectItem value="" disabled>
													No people available
												</SelectItem>
											) : (
												availablePeople.map((person) => (
													<SelectItem key={person.id} value={person.id}>
														{person.name || "Unnamed"}
													</SelectItem>
												))
											)}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="role">Role</Label>
									<Input id="role" name="role" placeholder="e.g., Decision Maker" />
								</div>
								<div className="space-y-2">
									<Label htmlFor="relationship_status">Relationship Status</Label>
									<Input id="relationship_status" name="relationship_status" placeholder="e.g., Champion, Prospect" />
								</div>
								<div className="space-y-2">
									<Label htmlFor="notes">Notes</Label>
									<Textarea id="notes" name="notes" rows={3} placeholder="Any context about this connection" />
								</div>
								<Button type="submit" disabled={availablePeople.length === 0}>
									Link person
								</Button>
							</Form>
							{availablePeople.length === 0 && people.length > 0 && (
								<p className="text-muted-foreground text-xs">All people in this project are already linked.</p>
							)}
							{people.length === 0 && (
								<p className="text-muted-foreground text-xs">
									Add people to your project to link them with this organization.
								</p>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</PageContainer>
	)
}
