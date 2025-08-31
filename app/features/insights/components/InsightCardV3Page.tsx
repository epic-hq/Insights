import { Quote } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel"
import { StyledTag } from "~/components/TagDisplay"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { EmotionBadge } from "~/components/ui/emotion-badge"
import { useCurrentProject } from "~/contexts/current-project-context"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { Insight } from "~/types"

interface InsightCardV3Props {
	insight: Insight
}

export function InsightCardV3Page({ insight, extended }: InsightCardV3Props) {
	const [_selected, _setSelected] = useState<Insight | null>(null)
	const _projectId = insight.project_id
	const { accountId, projectPath } = useCurrentProject()
	const routes = useProjectRoutes(projectPath || "")

	return (
		<Card className="mx-4 my-8 max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden sm:mx-auto sm:w-full">
			<CardContent>
				<div className="space-y-3 pb-4">
					<div className="space-y-2">
						<div className="font-light text-muted-foreground text-xs">{insight.category}</div>
						<div className="border-b pb-3 font-semibold text-lg">{insight.pain}</div>
					</div>
				</div>

				<div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
					{insight.journey_stage && (
						<Badge variant="outline" className="text-xs">
							{insight.journey_stage}
						</Badge>
					)}

					{(insight.details || insight.evidence) && (
						<div className="grid grid-cols-1 gap-6 ">
							{insight.details && (
								<div className="space-y-2">
									<h4 className="font-medium text-foreground text-sm">Details</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">{insight.details}</p>
								</div>
							)}
							{insight.evidence && (
								<div className="space-y-2">
									<h4 className="font-medium text-foreground text-sm">Evidence</h4>
									<div className="flex items-center gap-2 rounded-lg bg-blue-400/20 p-3">
										<Quote className="h-4 w-4 " />
										<p className="text-muted-foreground text-sm leading-relaxed">{insight.evidence}</p>
									</div>
								</div>
							)}
						</div>
					)}

					{insight.desired_outcome && (
						<div className="space-y-2">
							<h4 className="font-medium text-foreground text-sm">Desired Outcome</h4>
							<p className="text-muted-foreground text-sm leading-relaxed">{insight.desired_outcome}</p>
						</div>
					)}

					{insight.linked_themes && insight.linked_themes.length > 0 && (
						<div className="space-y-3">
							<h4 className="font-medium text-gray-700 text-sm">Linked Themes</h4>
							<div className="flex flex-wrap gap-2">
								{insight.linked_themes.map((theme: any) => (
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

					{insight.insight_tags && (
						<div className="space-y-3">
							<h4 className="font-medium text-foreground text-sm">Tags</h4>
							<div className="flex flex-wrap gap-2">
								{insight.insight_tags?.map((tag: any) => (
									<StyledTag key={tag.tag} name={tag.tags.tag} style={tag.style} frequency={tag.frequency} />
								))}
							</div>
						</div>
					)}

					{insight.emotional_response && (
						<div className="flex items-center justify-end pt-2">
							<EmotionBadge emotion_string={insight.emotional_response} muted />
						</div>
					)}
				</div>

				<EntityInteractionPanel entityType="insight" entityId={insight.id} />
			</CardContent>
		</Card>
	)
}
