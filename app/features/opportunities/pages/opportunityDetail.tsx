import { Briefcase, Calendar, DollarSign, TrendingUp } from "lucide-react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getOpportunityById } from "~/features/opportunities/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.opportunity?.title || "Opportunity"} | Insights` },
		{ name: "description", content: "Opportunity details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId
	const { opportunityId } = params

	if (!accountId || !projectId || !opportunityId) {
		throw new Response("Account ID, Project ID, and Opportunity ID are required", { status: 400 })
	}

	try {
		const { data: opportunity, error } = await getOpportunityById({
			supabase,
			accountId,
			projectId,
			id: opportunityId,
		})

		if (error || !opportunity) {
			throw new Response("Opportunity not found", { status: 404 })
		}

		return { opportunity }
	} catch (_error) {
		throw new Response("Failed to load opportunity", { status: 500 })
	}
}

const getKanbanStatusColor = (kanbanStatus: string | null) => {
	switch (kanbanStatus) {
		case "Explore":
			return "bg-blue-50 text-blue-700 border-blue-200"
		case "Validate":
			return "bg-yellow-50 text-yellow-700 border-yellow-200"
		case "Build":
			return "bg-green-50 text-green-700 border-green-200"
		default:
			return "bg-muted text-muted-foreground border-border"
	}
}

export default function OpportunityDetail() {
	const { opportunity } = useLoaderData<typeof loader>()
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)

	return (
		<div className="container mx-auto max-w-5xl px-4 py-8">
			{/* Back Button */}
			<BackButton />

			{/* Header */}
			<div className="mb-8 flex items-start justify-between">
				<div className="flex-1">
					<div className="mb-3 flex items-center gap-3">
						<Briefcase className="h-8 w-8 text-primary" />
						<h1 className="text-balance font-bold text-4xl tracking-tight">{opportunity.title}</h1>
					</div>
					{opportunity.description && (
						<p className="text-lg text-muted-foreground">{opportunity.description}</p>
					)}
					<div className="mt-3 flex items-center gap-2">
						<Badge variant="outline" className={getKanbanStatusColor(opportunity.kanban_status)}>
							{opportunity.kanban_status || "Unknown"}
						</Badge>
						{opportunity.stage && (
							<Badge variant="outline" className="bg-muted text-muted-foreground">
								{opportunity.stage}
							</Badge>
						)}
					</div>
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline" size="sm">
						<Link to={routes.opportunities.edit(opportunity.id)}>Edit</Link>
					</Button>
				</div>
			</div>

			{/* Key Metrics */}
			<div className="mb-8 grid gap-4 md:grid-cols-3">
				{opportunity.amount && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Deal Value</CardTitle>
							<DollarSign className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">${Number(opportunity.amount).toLocaleString()}</div>
						</CardContent>
					</Card>
				)}
				{opportunity.close_date && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Expected Close</CardTitle>
							<Calendar className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">
								{new Date(opportunity.close_date).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
									year: "numeric",
								})}
							</div>
						</CardContent>
					</Card>
				)}
				{opportunity.stage && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">Sales Stage</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="font-bold text-2xl">{opportunity.stage}</div>
						</CardContent>
					</Card>
				)}
			</div>

			{/* Description Section */}
			{opportunity.description && (
				<Card className="mb-8">
					<CardHeader>
						<CardTitle>Description</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-muted-foreground">{opportunity.description}</p>
					</CardContent>
				</Card>
			)}

			{/* Metadata */}
			<Card>
				<CardHeader>
					<CardTitle>Details</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 md:grid-cols-2">
					<div>
						<label className="font-medium text-muted-foreground text-sm">Created</label>
						<div className="mt-1 text-sm">
							{new Date(opportunity.created_at).toLocaleDateString("en-US", {
								month: "long",
								day: "numeric",
								year: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})}
						</div>
					</div>
					{opportunity.updated_at && (
						<div>
							<label className="font-medium text-muted-foreground text-sm">Last Updated</label>
							<div className="mt-1 text-sm">
								{new Date(opportunity.updated_at).toLocaleDateString("en-US", {
									month: "long",
									day: "numeric",
									year: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})}
							</div>
						</div>
					)}
					{opportunity.metadata && Object.keys(opportunity.metadata).length > 0 && (
						<div className="md:col-span-2">
							<label className="font-medium text-muted-foreground text-sm">Additional Information</label>
							<div className="mt-1 text-sm">
								<pre className="rounded bg-muted p-2 text-xs">
									{JSON.stringify(opportunity.metadata, null, 2)}
								</pre>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	)
}
