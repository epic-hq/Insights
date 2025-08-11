import consola from "consola"
import { Search } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel"
import { StyledTag } from "~/components/TagDisplay"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { EmotionBadge } from "~/components/ui/emotion-badge"
import { Input } from "~/components/ui/input"
import { getInsights } from "~/features/insights/db"
import { currentProjectContext } from "~/server/current-project-context"
import { userContext } from "~/server/user-context"
import type { Insight } from "~/types"

export const meta: MetaFunction = () => {
	return [{ title: "Quick Insights | Pain points" }, { name: "description", content: "Quick insights interface" }]
}

export async function loader({ context }: LoaderFunctionArgs) {
	const ctx = context.get(userContext)
	const supabase = ctx.supabase

	const ctx_project = context.get(currentProjectContext)
	const projectId = ctx_project.projectId || ""
	const accountId = ctx_project.accountId || ""

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

export default function QuickInsights() {
	const { insights } = useLoaderData<typeof loader>()
	const [searchQuery, setSearchQuery] = useState("")
	const [selected, setSelected] = useState<Insight | null>(null)

	const filtered = insights.filter(
		(insight: Insight) =>
			insight.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			insight.details?.toLowerCase().includes(searchQuery.toLowerCase())
	)

	// consola.log("Selected insight:", selected)
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
								<div className="pt-0 font-light text-gray-500 text-xs">Category: {insight.category}</div>
								<h3 className="mb-2 font-semibold text-gray-900">{insight.pain || "Untitled"}</h3>
								{insight.details && <p className="mb-4 line-clamp-4 text-gray-600 text-sm">{insight.details}</p>}
								{/* {insight.desired_outcome && (
									<p className="mb-3 font-medium text-blue-600 text-sm">{insight.desired_outcome}</p>
								)} */}
								<div className="flex flex-wrap items-center justify-between">
									<div className="flex items-center space-x-2">
										{insight.journey_stage && (
											<Badge variant="outline" className="text-xs">
												{insight.journey_stage} stage
											</Badge>
										)}
										{/* {insight.impact && (
											<Badge variant="secondary" className="text-xs">
												Impact: {insight.impact}/10
											</Badge>
										)} */}
									</div>

									{insight.emotional_response && <EmotionBadge emotion_string={insight.emotional_response} muted />}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{selected && (
				<Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
					<DialogContent className="max-h-[90vh] w-full max-w-full overflow-y-auto md:h-4/5 md:max-h-4/5 md:w-4/5 md:max-w-4xl">
						<DialogHeader>
							<DialogTitle>
								<div className="pt-0 font-light text-gray-500 text-xs">{selected.name}</div>
								<div className="flex items-center justify-between border-b pt-2 pb-2 font-semibold">
									{selected.pain}
								</div>
							</DialogTitle>
						</DialogHeader>
						<div className="-mt-2 space-y-3 overflow-y-auto">
							{selected.category && (
								<Badge variant="outline" className="text-xs">
									{selected.category}
								</Badge>
							)}
							{(selected.details || selected.evidence) && (
								<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
									{selected.details && (
										<div>
											<h4 className="mb-2 font-medium text-gray-700 text-sm">Details</h4>
											<p className="text-gray-600 text-sm">{selected.details}</p>
										</div>
									)}
									{selected.evidence && (
										<div className="bg-slate-100 p-2">
											<h4 className="mb-2 font-medium text-gray-700 text-sm">Evidence</h4>
											<p className="text-gray-600 text-sm">{selected.evidence}</p>
										</div>
									)}
								</div>
							)}

							{selected.desired_outcome && (
								<div>
									<h4 className="mb-2 font-medium text-gray-700 text-sm">Desired Outcome</h4>
									<p className="text-gray-600 text-sm">{selected.desired_outcome}</p>
								</div>
							)}

							{selected.jtbd && (
								<div>
									<h4 className="mb-2 font-medium text-gray-700 text-sm">Job to be Done</h4>
									<p className="text-gray-600 text-sm">{selected.jtbd}</p>
								</div>
							)}
							{/* TODO: Add tags */}
							{selected.insight_tags && (
								<div>
									<h4 className="font-medium text-gray-700 text-sm">Tags</h4>
									<div className="flex flex-wrap gap-2">
										{selected.insight_tags?.map((tag: any) => (
											<StyledTag key={tag.tag} name={tag.tag} style={tag.style} frequency={tag.frequency} />
										))}
									</div>
								</div>
							)}
							<div className="flex items-center justify-end">
								{selected.emotional_response && <EmotionBadge emotion_string={selected.emotional_response} muted />}
							</div>
						</div>
						<DialogFooter className="!flex !flex-row !justify-start !items-start">
							<EntityInteractionPanel entityType="insight" entityId={selected.id} />
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
