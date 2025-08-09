import consola from "consola"
import { Plus, Search } from "lucide-react"
import { useState } from "react"
import type { LoaderFunctionArgs, MetaFunction } from "react-router"
import { useLoaderData } from "react-router"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { EmotionBadge, EmotionsMap } from "~/components/ui/emotion-badge"
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

	// emotion emoji/category logic now handled by EmotionBadge

	const filtered = insights.filter(
		(insight: Insight) =>
			insight.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			insight.details?.toLowerCase().includes(searchQuery.toLowerCase())
	)

	return (
		<div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-blue-50 p-4">
			<div className="mb-4 flex items-center rounded-full bg-white/70 px-3 py-2 shadow-inner">
				<Search className="mr-2 h-5 w-5 text-gray-500" />
				<Input placeholder="Search insights…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
			</div>

			{filtered.length === 0 ? (
				<div className="py-12 text-center text-gray-500">
					<p className="mb-2 text-4xl">🔍</p>
					<p className="font-medium">No insights found</p>
					{searchQuery && <p className="mt-1 text-sm">Try adjusting your search</p>}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{filtered.map((insight) => (
						<Card
							key={insight.id}
							className={`hover:-translate-y-0.5 cursor-pointer rounded-xl bg-white shadow-sm transition-transform hover:shadow-md ${
								insight.emotional_response
									? (
											() => {
												const mainEmotion = Object.keys(EmotionsMap).find(
													(key) => key.toLowerCase() === insight.emotional_response?.toLowerCase()
												) as keyof typeof EmotionsMap | undefined
												return mainEmotion && EmotionsMap[mainEmotion]?.color?.bg
													? `${EmotionsMap[mainEmotion].color.bg} border-2`
													: "border-gray-200"
											}
										)()
									: "border-gray-200"
							}`}
							onClick={() => setSelected(insight)}
						>
							<CardContent className="flex flex-col space-y-1 p-4">
								<div className="mb-2 flex items-center space-x-2">
									{insight.pain && <span className="text-semibold">{insight.pain}</span>}
								</div>
								<h3 className="font-semibold text-gray-900">{insight.name || "Untitled Insight"}</h3>
								<div className="mb-2 flex justify-end space-x-2">
									{insight.emotional_response && (
										<EmotionBadge emotion_string={insight.emotional_response} muted={true} />
									)}
								</div>
								{/* {insight.desired_outcome && (
									<p className="font-medium text-blue-600 text-sm">{insight.desired_outcome}</p>
								)} */}
								{/* emotion term now shown in badge */}
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<Button
				className="fixed right-6 bottom-6 h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 text-white shadow-xl hover:shadow-2xl focus:outline-none active:scale-95"
				onClick={() => {}}
			>
				<Plus className="h-6 w-6 text-white" />
			</Button>

			{selected && (
				<Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
					<DialogContent className="mx-auto max-w-md rounded-xl border bg-white p-6 shadow-lg max-[90vh]:max-h-[90vh]">
						<DialogHeader>
							<div className="mb-2 flex items-center space-x-3">
								{selected.emotional_response && <EmotionBadge emotion_string={selected.emotional_response} />}
								<DialogTitle className="text-left font-bold text-xl">{selected.name || "Insight Details"}</DialogTitle>
							</div>
						</DialogHeader>
						<div className="space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
								<div className="flex flex-wrap items-center gap-3 text-md text-slate-800">
									{selected.pain && <span className="rounded px-2 py-1 text-semibold">{selected.pain}</span>}
									{selected.category && (
										<Badge variant="outline" className="text-sm">
											{selected.category}
										</Badge>
									)}
									{/* {selected.impact && (
										<span className="rounded bg-gray-100 px-2 py-1">Impact: {selected.impact}/10</span>
									)} */}
								</div>
							</div>

							{selected.details && (
								<div className="rounded-lg bg-gray-50 p-3">
									<h4 className="mb-1 font-medium text-gray-700 text-sm">Details</h4>
									<p className="text-base text-gray-700">{selected.details}</p>
								</div>
							)}

							{selected.desired_outcome && (
								<div className="rounded-lg bg-blue-50 p-3">
									<h4 className="mb-1 font-medium text-blue-700 text-sm">Desired Outcome</h4>
									<p className="text-base text-blue-700">{selected.desired_outcome}</p>
								</div>
							)}

							{selected.evidence && (
								<div className="rounded-lg bg-yellow-50 p-3">
									<h4 className="mb-1 font-medium text-sm text-yellow-700">Evidence</h4>
									<p className="text-base text-yellow-800">{selected.evidence}</p>
								</div>
							)}

							{selected.jtbd && (
								<div className="rounded-lg bg-green-50 p-3">
									<h4 className="mb-1 font-medium text-green-700 text-sm">Job to be Done</h4>
									<p className="text-base text-green-800">{selected.jtbd}</p>
								</div>
							)}
						</div>
					</DialogContent>
				</Dialog>
			)}
		</div>
	)
}
