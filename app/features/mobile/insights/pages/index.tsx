import consola from "consola"
import { Plus, Search } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { Input } from "~/components/ui/input"
import { getInsights } from "~/features/insights/db"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Mobile Insights | Insights" }, { name: "description", content: "Mobile insights interface" }]
}

export async function loader({ context, params }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const accountId = params.accountId
	const projectId = params.projectId

	if (!accountId || !projectId) {
		throw new Response("Account ID and Project ID are required", { status: 400 })
	}

	const { data: insights, error } = await getInsights({
		supabase,
		accountId,
		projectId,
	})

	if (error) {
		consola.error("Insights query error:", error)
		throw new Response(`Error fetching insights: ${error.message}`, { status: 500 })
	}

	consola.log(`Found ${insights?.length || 0} insights`)

	return {
		insights: insights || [],
	}
}

export default function InsightsRoute() {
	const { insights } = useLoaderData<typeof loader>()
	const [searchQuery, setSearchQuery] = useState("")
	const [selected, setSelected] = useState<Insight | null>(null)

	const filtered = insights.filter(
		(insight: Insight) =>
			insight.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			insight.details?.toLowerCase().includes(searchQuery.toLowerCase())
	)

	return (
		<div className="min-h-screen bg-gray-50 p-4">
			<div className="mb-4 flex items-center">
				<Search className="mr-2 h-5 w-5 text-gray-500" />
				<Input placeholder="Search insights…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
			</div>

			{filtered.length === 0 ? (
				<div className="py-8 text-center text-gray-500">
					<p>No insights found</p>
					{searchQuery && <p className="mt-1 text-sm">Try adjusting your search</p>}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filtered.map((insight) => (
						<Card
							key={insight.id}
							className="cursor-pointer transition-shadow hover:shadow-md"
							onClick={() => setSelected(insight)}
						>
							<CardContent className="p-4">
								<h3 className="mb-2 font-semibold text-gray-900">{insight.name || "Untitled Insight"}</h3>
								{insight.details && <p className="mb-3 line-clamp-2 text-gray-600 text-sm">{insight.details}</p>}
								{insight.desired_outcome && (
									<p className="mb-3 font-medium text-blue-600 text-sm">{insight.desired_outcome}</p>
								)}
								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-2">
										{insight.category && (
											<Badge variant="outline" className="text-xs">
												{insight.category}
											</Badge>
										)}
										{insight.impact && (
											<Badge variant="secondary" className="text-xs">
												Impact: {insight.impact}/10
											</Badge>
										)}
									</div>
									{insight.emotional_response && (
										<span className="text-gray-500 text-sm capitalize">{insight.emotional_response}</span>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Button className="fixed right-6 bottom-6 h-16 w-16 rounded-full" onClick={() => {}}>
				<Plus className="h-6 w-6" />
			</Button>

			{selected && (
				<Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
					<DialogContent className="mx-auto max-w-md">
						<DialogHeader>
							<DialogTitle className="text-left">{selected.name || "Insight Details"}</DialogTitle>
						</DialogHeader>
						<div className="space-y-4">
							{selected.details && (
								<div>
									<h4 className="mb-2 font-medium text-gray-700 text-sm">Details</h4>
									<p className="text-gray-600 text-sm">{selected.details}</p>
								</div>
							)}

							{selected.desired_outcome && (
								<div>
									<h4 className="mb-2 font-medium text-gray-700 text-sm">Desired Outcome</h4>
									<p className="text-gray-600 text-sm">{selected.desired_outcome}</p>
								</div>
							)}

							{selected.evidence && (
								<div>
									<h4 className="mb-2 font-medium text-gray-700 text-sm">Evidence</h4>
									<p className="text-gray-600 text-sm">{selected.evidence}</p>
								</div>
							)}

							{selected.jtbd && (
								<div>
									<h4 className="mb-2 font-medium text-gray-700 text-sm">Job to be Done</h4>
									<p className="text-gray-600 text-sm">{selected.jtbd}</p>
								</div>
							)}

							<div className="flex items-center justify-between border-t pt-2">
								<div className="flex items-center space-x-4 text-gray-500 text-xs">
									{selected.impact && <span>Impact: {selected.impact}/10</span>}
									{selected.pain && <span>Pain: {selected.pain}/10</span>}
									{selected.category && (
										<Badge variant="outline" className="text-xs">
											{selected.category}
										</Badge>
									)}
								</div>
								{selected.emotional_response && (
									<span className="text-gray-500 text-sm capitalize">{selected.emotional_response}</span>
								)}
							</div>
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
