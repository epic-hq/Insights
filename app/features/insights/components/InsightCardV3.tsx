import { Quote } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel"
import { StyledTag } from "~/components/TagDisplay"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog"
import { EmotionBadge } from "~/components/ui/emotion-badge"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { Insight } from "~/types"

interface InsightCardV3Props {
	insight: Insight
}

export function InsightCardV3({ insight, extended }: InsightCardV3Props) {
	const [selected, setSelected] = useState<Insight | null>(null)
	const _projectId = insight.project_id
	const { accountId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	return (
		<>
			<Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => setSelected(insight)}>
				<CardContent className="p-4">
					<div className="pt-0 font-light text-muted-foreground text-xs">Category: {insight.category}</div>
					<h3 className="mb-2 font-semibold text-foreground">{insight.pain || "Untitled"}</h3>
					{insight.details && <p className="mb-4 line-clamp-4 text-muted-foreground text-sm">{insight.details}</p>}
					<div className="flex flex-wrap items-center justify-between">
						<div className="flex items-center space-x-2">
							{insight.journey_stage && (
								<Badge variant="outline" className="text-xs">
									{insight.journey_stage} stage
								</Badge>
							)}
						</div>
						{insight.emotional_response && <EmotionBadge emotion_string={insight.emotional_response} muted />}
					</div>
				</CardContent>
			</Card>

			{selected && (
				<Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
					<DialogContent className="mx-4 my-8 max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden sm:mx-auto sm:w-full">
						<DialogHeader className="space-y-3 pb-4">
							<DialogTitle className="space-y-2">
								<div className="font-light text-muted-foreground text-xs">{selected.name}</div>
								<div className="border-b pb-3 font-semibold text-lg">{selected.pain}</div>
							</DialogTitle>
						</DialogHeader>

						<div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
							{selected.category && (
								<Badge variant="outline" className="text-xs">
									{selected.category}
								</Badge>
							)}

							{(selected.details || selected.evidence) && (
								<div className="grid grid-cols-1 gap-6">
									{selected.details && (
										<div className="space-y-2">
											<h4 className="font-medium text-foreground text-sm">Details</h4>
											<p className="text-muted-foreground text-sm leading-relaxed">{selected.details}</p>
										</div>
									)}
									{selected.evidence && (
										<div className="space-y-2">
											<h4 className="font-medium text-foreground text-sm">Evidence</h4>
											<div className="flex items-center gap-2 rounded-lg bg-blue-400/20 p-3">
												<Quote className="h-4 w-4" />
												<p className="text-muted-foreground text-sm leading-relaxed">{selected.evidence}</p>
											</div>
										</div>
									)}
								</div>
							)}

							{selected.desired_outcome && (
								<div className="space-y-2">
									<h4 className="font-medium text-foreground text-sm">Desired Outcome</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">{selected.desired_outcome}</p>
								</div>
							)}

							{selected.linked_themes && selected.linked_themes.length > 0 && (
								<div className="space-y-3">
									<h4 className="font-medium text-gray-700 text-sm">Linked Themes</h4>
									<div className="flex flex-wrap gap-2">
										{selected.linked_themes.map((theme: any) => (
											<Link key={theme.id} to={routes.themes.detail(theme.id)}>
												<Badge variant="secondary" className="text-xs">
													{theme.name}
												</Badge>
											</Link>
										))}
									</div>
								</div>
							)}
							{/* {selected.jtbd && (
								<div className="space-y-2">
									<h4 className="font-medium text-foreground text-sm">Job to be Done</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">{selected.jtbd}</p>
								</div>
							)} */}

							{selected.insight_tags && (
								<div className="space-y-3">
									<h4 className="font-medium text-foreground text-sm">Tags</h4>
									<div className="flex flex-wrap gap-2">
										{selected.insight_tags?.map((tag: any) => (
											<StyledTag key={tag.tag} name={tag.tag} style={tag.style} frequency={tag.frequency} />
										))}
									</div>
								</div>
							)}

							{selected.emotional_response && (
								<div className="flex items-center justify-end pt-2">
									<EmotionBadge emotion_string={selected.emotional_response} muted />
								</div>
							)}
						</div>

						<DialogFooter className="mt-6 flex-row items-start justify-start border-t pt-4">
							<EntityInteractionPanel entityType="insight" entityId={selected.id} />
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</>
	)
}
