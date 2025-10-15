import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { PageContainer } from "~/components/layout/PageContainer"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
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

export default function OpportunityDetail() {
	const { opportunity } = useLoaderData<typeof loader>()
	const { projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath)

	const getStatusColor = (status: string) => {
		switch (status) {
			case "completed":
				return "bg-green-100 text-green-800"
			case "in_progress":
				return "bg-blue-100 text-blue-800"
			case "planning":
				return "bg-yellow-100 text-yellow-800"
			case "on_hold":
				return "bg-gray-100 text-gray-800"
			default:
				return "bg-gray-100 text-gray-800"
		}
	}

	return (
		<PageContainer size="lg" padded={false} className="max-w-4xl">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<div className="mb-2 flex items-center gap-2">
						<Link to="/opportunities" className="text-blue-600 hover:text-blue-800">
							Opportunities
						</Link>
						<span className="text-gray-500">/</span>
						<span className="text-gray-900">{opportunity.title}</span>
					</div>
					<h1 className="font-bold text-3xl text-gray-900">{opportunity.title}</h1>
				</div>
				<div className="flex gap-2">
					<Button asChild variant="outline">
						<Link to={`/opportunities/${opportunity.id}/edit`}>Edit</Link>
					</Button>
					<Button asChild variant="outline">
						<Link to="/opportunities">Back to Opportunities</Link>
					</Button>
				</div>
			</div>

			<div className="grid gap-8 lg:grid-cols-3">
				<div className="lg:col-span-2">
					{opportunity.opportunity_insights && opportunity.opportunity_insights.length > 0 && (
						<div className="rounded-lg border bg-white p-6">
							<h2 className="mb-4 font-semibold text-xl">Related Insights</h2>
							<div className="space-y-3">
								{opportunity.opportunity_insights.map((opportunityInsight) => (
									<div key={opportunityInsight.insights.id} className="border-blue-500 border-l-4 pl-4">
										<Link
											to={routes.insights.detail(opportunityInsight.insights.id)}
											className="font-medium text-blue-600 hover:text-blue-800"
										>
											{opportunityInsight.insights.name}
										</Link>
										{opportunityInsight.insights.category && (
											<Badge variant="secondary" className="ml-2">
												{opportunityInsight.insights.category}
											</Badge>
										)}
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				<div className="space-y-6">
					<div className="rounded-lg border bg-white p-6">
						<h3 className="mb-4 font-semibold">Details</h3>
						<div className="space-y-3">
							<div>
								<label className="font-medium text-gray-500 text-sm">Status</label>
								<div className="mt-1">
									<Badge className={getStatusColor(opportunity.kanban_status || "")}>
										{opportunity.kanban_status || "Unknown"}
									</Badge>
								</div>
							</div>

							<div>
								<label className="font-medium text-gray-500 text-sm">Created</label>
								<div className="mt-1 text-gray-900 text-sm">
									{new Date(opportunity.created_at).toLocaleDateString()}
								</div>
							</div>

							{opportunity.updated_at && (
								<div>
									<label className="font-medium text-gray-500 text-sm">Last Updated</label>
									<div className="mt-1 text-gray-900 text-sm">
										{new Date(opportunity.updated_at).toLocaleDateString()}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</PageContainer>
	)
}
