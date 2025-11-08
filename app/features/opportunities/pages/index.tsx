import { Briefcase } from "lucide-react"
import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { BackButton } from "~/components/ui/back-button"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { useCurrentProject } from "~/contexts/current-project-context"
import { getOpportunities } from "~/features/opportunities/db"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction = () => {
	return [{ title: "Opportunities" }, { name: "description", content: "Manage business opportunities" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	// Both from URL params - consistent, explicit, RESTful
	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { data: opportunities, error } = await getOpportunities({ supabase, accountId, projectId })

	if (error) {
		throw new Response("Error loading opportunities", { status: 500 })
	}

	return { opportunities: opportunities || [] }
}

export default function OpportunitiesIndexPage() {
	const { opportunities } = useLoaderData<typeof loader>()
	const currentProjectContext = useCurrentProject()
	const routes = useProjectRoutes(currentProjectContext?.projectPath)

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

	return (
		<div className="container mx-auto max-w-6xl px-4 py-8">
			{/* Back Button */}
			<BackButton />

			{/* Header */}
			<div className="mb-8">
				<div className="mb-3 flex items-center gap-3">
					<Briefcase className="h-8 w-8 text-primary" />
					<h1 className="text-balance font-bold text-4xl tracking-tight">Opportunities</h1>
				</div>
				<p className="text-lg text-muted-foreground">
					Track business opportunities and link them to customer interviews for BANT qualification
				</p>
			</div>

			{/* Action Bar */}
			<div className="mb-6 flex items-center justify-between">
				<div className="text-muted-foreground text-sm">
					{opportunities.length} {opportunities.length === 1 ? "opportunity" : "opportunities"}
				</div>
				<Button asChild>
					<Link to={routes.opportunities.new()}>Create Opportunity</Link>
				</Button>
			</div>

			{/* Empty State */}
			{opportunities.length === 0 ? (
				<Card className="border-dashed">
					<CardContent className="flex flex-col items-center justify-center py-12">
						<Briefcase className="mb-4 h-12 w-12 text-muted-foreground" />
						<h3 className="mb-2 font-semibold text-lg">No opportunities yet</h3>
						<p className="mb-4 text-center text-muted-foreground">
							Create your first opportunity to start tracking your sales pipeline
						</p>
						<Button asChild>
							<Link to={routes.opportunities.new()}>Create Opportunity</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				/* Opportunities Grid */
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{opportunities.map((opportunity) => (
						<Link key={opportunity.id} to={routes.opportunities.detail(opportunity.id)}>
							<Card className="transition-all hover:border-primary/50 hover:shadow-md">
								<CardHeader>
									<div className="mb-2 flex items-start justify-between gap-2">
										<CardTitle className="text-base leading-snug">{opportunity.title}</CardTitle>
										{opportunity.kanban_status && (
											<Badge variant="outline" className={getKanbanStatusColor(opportunity.kanban_status)}>
												{opportunity.kanban_status}
											</Badge>
										)}
									</div>
									{opportunity.description && (
										<p className="line-clamp-2 text-muted-foreground text-sm">{opportunity.description}</p>
									)}
								</CardHeader>
								<CardContent>
									<div className="space-y-2 text-sm">
										{opportunity.amount && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Amount</span>
												<span className="font-medium">${Number(opportunity.amount).toLocaleString()}</span>
											</div>
										)}
										{opportunity.stage && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Stage</span>
												<span className="font-medium">{opportunity.stage}</span>
											</div>
										)}
										{opportunity.close_date && (
											<div className="flex justify-between">
												<span className="text-muted-foreground">Close Date</span>
												<span className="font-medium">{new Date(opportunity.close_date).toLocaleDateString()}</span>
											</div>
										)}
										<div className="flex justify-between border-t pt-2">
											<span className="text-muted-foreground text-xs">Created</span>
											<span className="text-muted-foreground text-xs">
												{new Date(opportunity.created_at).toLocaleDateString()}
											</span>
										</div>
									</div>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			)}
		</div>
	)
}
