import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { Link, useLoaderData } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { getOpportunityById } from "~/features/opportunities/db"
import { userContext } from "~/server/user-context"

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: `${data?.opportunity?.title || "Opportunity"} | Insights` },
		{ name: "description", content: "Opportunity details" },
	]
}

export async function loader({ params, context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const accountId = ctx.account_id
	const supabase = ctx.supabase
	const { opportunityId } = params

	if (!opportunityId) {
		throw new Response("Opportunity ID is required", { status: 400 })
	}

	try {
		const { data: opportunity, error } = await getOpportunityById({
			supabase,
			accountId,
			id: opportunityId,
		})

		if (error || !opportunity) {
			throw new Response("Opportunity not found", { status: 404 })
		}

		return { opportunity }
	} catch (error) {
		console.error("Error loading opportunity:", error)
		throw new Response("Failed to load opportunity", { status: 500 })
	}
}

export default function OpportunityDetail() {
	const { opportunity } = useLoaderData<typeof loader>()

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

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "critical":
				return "bg-red-100 text-red-800"
			case "high":
				return "bg-orange-100 text-orange-800"
			case "medium":
				return "bg-yellow-100 text-yellow-800"
			case "low":
				return "bg-green-100 text-green-800"
			default:
				return "bg-gray-100 text-gray-800"
		}
	}

	return (
		<div className="mx-auto max-w-4xl">
			<div className="mb-8 flex items-center justify-between">
				<div>
					<div className="mb-2 flex items-center gap-2">
						<Link to="/opportunities" className="text-blue-600 hover:text-blue-800">
							Opportunities
						</Link>
						<span className="text-gray-500">/</span>
						<span className="text-gray-900">{opportunity.title}</span>
					</div>
					<h1 className="text-3xl font-bold text-gray-900">{opportunity.title}</h1>
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
					<div className="rounded-lg border bg-white p-6">
						<h2 className="mb-4 text-xl font-semibold">Description</h2>
						{opportunity.description ? (
							<p className="text-gray-700 whitespace-pre-wrap">{opportunity.description}</p>
						) : (
							<p className="text-gray-500 italic">No description provided</p>
						)}
					</div>

					{opportunity.insights && opportunity.insights.length > 0 && (
						<div className="mt-8 rounded-lg border bg-white p-6">
							<h2 className="mb-4 text-xl font-semibold">Related Insights</h2>
							<div className="space-y-3">
								{opportunity.insights.map((insight) => (
									<div key={insight.id} className="border-l-4 border-blue-500 pl-4">
										<Link
											to={`/insights/${insight.id}`}
											className="font-medium text-blue-600 hover:text-blue-800"
										>
											{insight.title}
										</Link>
										{insight.category && (
											<Badge variant="secondary" className="ml-2">
												{insight.category}
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
								<label className="text-sm font-medium text-gray-500">Status</label>
								<div className="mt-1">
									<Badge className={getStatusColor(opportunity.status || "")}>
										{opportunity.status || "Unknown"}
									</Badge>
								</div>
							</div>

							<div>
								<label className="text-sm font-medium text-gray-500">Priority</label>
								<div className="mt-1">
									<Badge className={getPriorityColor(opportunity.priority || "")}>
										{opportunity.priority || "Unknown"}
									</Badge>
								</div>
							</div>

							{opportunity.estimated_value && (
								<div>
									<label className="text-sm font-medium text-gray-500">Estimated Value</label>
									<div className="mt-1 text-sm text-gray-900">
										${opportunity.estimated_value.toLocaleString()}
									</div>
								</div>
							)}

							<div>
								<label className="text-sm font-medium text-gray-500">Created</label>
								<div className="mt-1 text-sm text-gray-900">
									{new Date(opportunity.created_at).toLocaleDateString()}
								</div>
							</div>

							{opportunity.updated_at && (
								<div>
									<label className="text-sm font-medium text-gray-500">Last Updated</label>
									<div className="mt-1 text-sm text-gray-900">
										{new Date(opportunity.updated_at).toLocaleDateString()}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
