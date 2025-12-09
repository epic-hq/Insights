import {
	ArrowRight,
	Building2,
	Calendar,
	CircleDollarSign,
	Globe,
	LinkIcon,
	Mail,
	MapPin,
	MessageSquare,
	Pencil,
	Phone,
	Trash2,
	Users,
} from "lucide-react"
import { useState } from "react"
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router"
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router-dom"
import { LinkPersonDialog } from "~/components/dialogs/LinkPersonDialog"
import { DetailPageHeader } from "~/components/layout/DetailPageHeader"
import { PageContainer } from "~/components/layout/PageContainer"
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "~/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { DEFAULT_OPPORTUNITY_STAGES } from "~/features/opportunities/stage-config"
import {
	deleteOrganization,
	getOrganizationById,
	getProjectPeopleSummary,
	linkPersonToOrganization,
	unlinkPersonFromOrganization,
} from "~/features/organizations/db"
import { syncTitleToJobFunctionFacet } from "~/features/people/syncTitleToFacet.server"
import { PersonaPeopleSubnav } from "~/features/personas/components/PersonaPeopleSubnav"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"
import type { Database, Interview, Opportunity, Organization, Person } from "~/types"
import { createProjectRoutes } from "~/utils/routes.server"

type PeopleOrganization = Database["public"]["Tables"]["people_organizations"]["Row"]

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

	const [{ data, error }, { data: people }, { data: opportunities }, { data: conversations }] = await Promise.all([
		getOrganizationById({ supabase, accountId, projectId, id: organizationId }),
		getProjectPeopleSummary({ supabase, accountId, projectId }),
		// Get opportunities linked to this organization
		supabase
			.from("opportunities")
			.select("id, title, stage, amount, currency, next_step, next_step_due, close_date, description")
			.eq("project_id", projectId)
			.eq("organization_id", organizationId)
			.order("updated_at", { ascending: false }),
		// Get interviews linked to people in this organization
		supabase
			.from("interviews")
			.select(`
				id,
				title,
				interview_date,
				status,
				interview_people!inner (
					people!inner (
						people_organizations!inner (
							organization_id
						)
					)
				)
			`)
			.eq("project_id", projectId)
			.eq("interview_people.people.people_organizations.organization_id", organizationId)
			.order("interview_date", { ascending: false }),
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
		opportunities:
			(opportunities as Array<
				Pick<
					Opportunity,
					| "id"
					| "title"
					| "stage"
					| "amount"
					| "currency"
					| "next_step"
					| "next_step_due"
					| "close_date"
					| "description"
				>
			>) ?? [],
		conversations: (conversations as Array<Pick<Interview, "id" | "title" | "interview_date" | "status">>) ?? [],
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

	if (intent === "delete") {
		const { error } = await deleteOrganization({
			supabase,
			accountId,
			projectId,
			id: organizationId,
		})

		if (error) {
			return { error: "Failed to delete organization" }
		}

		return redirect(routes.organizations.index())
	}

	return redirect(routes.organizations.detail(organizationId))
}

export default function OrganizationDetailPage() {
	const { organization, people, opportunities, conversations } = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || `/a/${organization.account_id ?? ""}/${organization.project_id ?? ""}`)
	const [isDeleting, setIsDeleting] = useState(false)

	const linkedPersonIds = new Set((organization.people_organizations || []).map((link) => link.person.id))
	const availablePeople = people.filter((person) => !linkedPersonIds.has(person.id))

	// Format currency amount
	const formatAmount = (amount: number | null, currency: string | null) => {
		if (amount == null) return null
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency || "USD",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount)
	}

	// Get stage display info
	const getStageInfo = (stage: string | null) => {
		if (!stage) return { label: "Unknown", color: "bg-gray-100 text-gray-700" }
		const stageConfig = DEFAULT_OPPORTUNITY_STAGES.find((s) => s.id === stage)
		if (stageConfig) {
			// Color based on stage type
			const stageColors: Record<string, string> = {
				prospect: "bg-blue-100 text-blue-700",
				discovery: "bg-purple-100 text-purple-700",
				evaluation: "bg-indigo-100 text-indigo-700",
				proposal: "bg-amber-100 text-amber-700",
				negotiation: "bg-orange-100 text-orange-700",
				commit: "bg-emerald-100 text-emerald-700",
				"closed-won": "bg-green-100 text-green-700",
				"closed-lost": "bg-red-100 text-red-700",
			}
			return { label: stageConfig.label, color: stageColors[stageConfig.id] || "bg-gray-100 text-gray-700" }
		}
		return { label: stage, color: "bg-gray-100 text-gray-700" }
	}

	return (
		<PageContainer>
			<PersonaPeopleSubnav />
			<div className="mx-auto max-w-5xl px-4 py-10">
				{/* Action buttons */}
				<div className="mb-4 flex justify-end gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link to={routes.organizations.edit(organization.id)}>
							<Pencil className="mr-2 h-4 w-4" />
							Edit
						</Link>
					</Button>
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
							>
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Delete Organization</AlertDialogTitle>
								<AlertDialogDescription>
									Are you sure you want to delete "{organization.name}"? This will also remove all links to people
									associated with this organization. This action cannot be undone.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<Form method="post">
									<input type="hidden" name="_action" value="delete" />
									<AlertDialogAction
										type="submit"
										className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
										disabled={isDeleting}
										onClick={() => setIsDeleting(true)}
									>
										{isDeleting ? "Deleting..." : "Delete"}
									</AlertDialogAction>
								</Form>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>

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

				{/* Sales Opportunities */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-lg">
							<CircleDollarSign className="h-5 w-5" />
							Sales Opportunities
						</CardTitle>
						<CardDescription>
							{opportunities.length} opportunit{opportunities.length === 1 ? "y" : "ies"} associated with this
							organization
						</CardDescription>
					</CardHeader>
					<CardContent>
						{opportunities.length === 0 ? (
							<div className="rounded-lg border border-muted-foreground/30 border-dashed p-6 text-center text-muted-foreground text-sm">
								No opportunities linked to this organization yet.
							</div>
						) : (
							<div className="space-y-3">
								{opportunities.map((opp) => {
									const stageInfo = getStageInfo(opp.stage)
									const amount = formatAmount(opp.amount, opp.currency)
									return (
										<Link
											key={opp.id}
											to={routes.opportunities.detail(opp.id)}
											className="flex items-start justify-between rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
										>
											<div className="flex-1 space-y-2">
												<div className="flex items-center gap-2">
													<span className="font-medium">{opp.title}</span>
													<Badge className={stageInfo.color}>{stageInfo.label}</Badge>
												</div>
												{amount && (
													<div className="flex items-center gap-1 text-muted-foreground text-sm">
														<CircleDollarSign className="h-4 w-4" />
														{amount}
													</div>
												)}
												{opp.next_step && (
													<div className="text-sm">
														<span className="font-medium text-muted-foreground">Next Step:</span> {opp.next_step}
														{opp.next_step_due && (
															<span className="ml-2 text-muted-foreground">
																(due {new Date(opp.next_step_due).toLocaleDateString()})
															</span>
														)}
													</div>
												)}
												{opp.close_date && (
													<div className="flex items-center gap-1 text-muted-foreground text-xs">
														<Calendar className="h-3 w-3" />
														Expected close: {new Date(opp.close_date).toLocaleDateString()}
													</div>
												)}
											</div>
											<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
										</Link>
									)
								})}
							</div>
						)}
					</CardContent>
				</Card>

				{/* Conversations */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-lg">
							<MessageSquare className="h-5 w-5" />
							Conversations
						</CardTitle>
						<CardDescription>
							{conversations.length} conversation{conversations.length !== 1 ? "s" : ""} with people from this
							organization
						</CardDescription>
					</CardHeader>
					<CardContent>
						{conversations.length === 0 ? (
							<div className="rounded-lg border border-muted-foreground/30 border-dashed p-6 text-center text-muted-foreground text-sm">
								No conversations found with people from this organization.
							</div>
						) : (
							<div className="space-y-2">
								{conversations.map((conv) => (
									<Link
										key={conv.id}
										to={routes.interviews.detail(conv.id)}
										className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
									>
										<div className="min-w-0 flex-1">
											<div className="truncate font-medium text-sm">{conv.title || "Untitled Conversation"}</div>
											<div className="flex items-center gap-2 text-muted-foreground text-xs">
												{conv.interview_date && <span>{new Date(conv.interview_date).toLocaleDateString()}</span>}
												{conv.status && (
													<Badge variant="outline" className="text-xs">
														{conv.status}
													</Badge>
												)}
											</div>
										</div>
										<ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
									</Link>
								))}
							</div>
						)}
					</CardContent>
				</Card>

				{/* People and Link Person Form */}
				<div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
					<Card className="border border-border/80">
						<CardHeader className="flex flex-col gap-2">
							<CardTitle className="flex items-center gap-2 text-xl">
								<Users className="h-5 w-5" /> People
							</CardTitle>
							<CardDescription>
								{(organization.people_organizations || []).length} people associated with this organization
							</CardDescription>
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
