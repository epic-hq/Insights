import { type LoaderFunctionArgs, type MetaFunction, useLoaderData } from "react-router"
import { Link } from "react-router-dom"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { getOpportunities } from "~/features/opportunities/db"
import { getServerClient } from "~/lib/supabase/server"

export const meta: MetaFunction = () => {
	return [{ title: "Opportunities" }, { name: "description", content: "Manage business opportunities" }]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const { client: supabase } = getServerClient(request)
	const { data: jwt } = await supabase.auth.getClaims()
	const accountId = jwt?.claims.sub

	if (!accountId) {
		throw new Response("Unauthorized", { status: 401 })
	}

	const { data: opportunities, error } = await getOpportunities({ supabase, accountId })

	if (error) {
		throw new Response("Error loading opportunities", { status: 500 })
	}

	return { opportunities: opportunities || [] }
}

export default function OpportunitiesIndexPage() {
	const { opportunities } = useLoaderData<typeof loader>()

	const getStatusColor = (status: string) => {
		switch (status) {
			case "identified":
				return "bg-blue-100 text-blue-800"
			case "in_progress":
				return "bg-yellow-100 text-yellow-800"
			case "completed":
				return "bg-green-100 text-green-800"
			case "cancelled":
				return "bg-red-100 text-red-800"
			default:
				return "bg-gray-100 text-gray-800"
		}
	}

	const getPriorityColor = (priority: string) => {
		switch (priority) {
			case "high":
				return "bg-red-100 text-red-800"
			case "medium":
				return "bg-yellow-100 text-yellow-800"
			case "low":
				return "bg-green-100 text-green-800"
			default:
				return "bg-gray-100 text-gray-800"
		}
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Opportunities</h1>
					<p className="text-muted-foreground">
						Manage and track business opportunities from your research insights.
					</p>
				</div>
				<Button asChild>
					<Link to="/opportunities/new">Create Opportunity</Link>
				</Button>
			</div>

			{opportunities.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center py-12">
						<h3 className="text-lg font-semibold mb-2">No opportunities yet</h3>
						<p className="text-muted-foreground mb-4">
							Create your first opportunity to start tracking business potential.
						</p>
						<Button asChild>
							<Link to="/opportunities/new">Create Opportunity</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{opportunities.map((opportunity) => (
						<Card key={opportunity.id} className="hover:shadow-md transition-shadow">
							<CardHeader>
								<div className="flex items-start justify-between">
									<CardTitle className="text-lg">
										<Link
											to={`/opportunities/${opportunity.id}`}
											className="hover:underline"
										>
											{opportunity.title}
										</Link>
									</CardTitle>
									<div className="flex gap-2">
										<Badge className={getStatusColor(opportunity.status || "")}>
											{opportunity.status}
										</Badge>
										<Badge className={getPriorityColor(opportunity.priority || "")}>
											{opportunity.priority}
										</Badge>
									</div>
								</div>
								<CardDescription className="line-clamp-2">
									{opportunity.description}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									{opportunity.estimated_value && (
										<div className="text-sm">
											<span className="font-medium">Estimated Value:</span>{" "}
											${opportunity.estimated_value.toLocaleString()}
										</div>
									)}
									<div className="text-sm text-muted-foreground">
										Created {new Date(opportunity.created_at).toLocaleDateString()}
									</div>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
