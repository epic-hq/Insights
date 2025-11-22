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
					<h3 className="mb-2 font-semibold text-foreground">{insight.name || "Untitled Theme"}</h3>
					{(insight as any).statement && (
						<p className="mb-4 line-clamp-4 text-muted-foreground text-sm">{(insight as any).statement}</p>
					)}
					<div className="flex flex-wrap items-center justify-between">
						<div className="flex items-center space-x-2">
							{insight.persona_insights && insight.persona_insights.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{insight.persona_insights.slice(0, 2).map((pi: any) => (
										<Badge key={pi.personas?.id} variant="outline" className="text-xs">
											{pi.personas?.name}
										</Badge>
									))}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>

			{selected && (
				<Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
					<DialogContent className="mx-4 my-8 max-h-[90vh] w-full max-w-5xl overflow-hidden sm:mx-auto lg:max-w-6xl">
						<DialogHeader className="space-y-3 pb-4">
							<DialogTitle className="space-y-2">
								<div className="border-b pb-3 font-semibold text-lg">{selected.name || "Untitled Theme"}</div>
							</DialogTitle>
						</DialogHeader>

						<div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
							{(selected as any).statement && (
								<div className="space-y-2">
									<h4 className="font-medium text-foreground text-sm">Statement</h4>
									<p className="text-muted-foreground text-sm leading-relaxed">{(selected as any).statement}</p>
								</div>
							)}

							{((selected as any).inclusion_criteria || (selected as any).exclusion_criteria) && (
								<div className="grid grid-cols-1 gap-4">
									{(selected as any).inclusion_criteria && (
										<div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
											<h4 className="font-medium text-green-900 text-sm dark:text-green-100">
												Inclusion Criteria
											</h4>
											<p className="text-green-700 text-sm dark:text-green-300">
												{(selected as any).inclusion_criteria}
											</p>
										</div>
									)}
									{(selected as any).exclusion_criteria && (
										<div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
											<h4 className="font-medium text-red-900 text-sm dark:text-red-100">Exclusion Criteria</h4>
											<p className="text-red-700 text-sm dark:text-red-300">
												{(selected as any).exclusion_criteria}
											</p>
										</div>
									)}
								</div>
							)}

							{selected.linked_themes && selected.linked_themes.length > 0 && (
								<div className="space-y-3">
									<h4 className="font-medium text-gray-700 text-sm">Related Themes</h4>
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

							{selected.insight_tags && selected.insight_tags.length > 0 && (
								<div className="space-y-3">
									<h4 className="font-medium text-foreground text-sm">Tags</h4>
									<div className="flex flex-wrap gap-2">
										{selected.insight_tags?.map((tag: any, idx: number) => {
											const tagName = tag?.tags?.tag || tag?.tag || null
											if (!tagName) return null
											return (
												<StyledTag
													key={`${tagName}-${idx}`}
													name={tagName}
													style={tag.style}
													frequency={tag.frequency}
												/>
											)
										})}
									</div>
								</div>
							)}
						</div>

						<DialogFooter className="mt-6 w-full flex-row flex-wrap items-start justify-start gap-4 border-t pt-4">
							<EntityInteractionPanel entityType="insight" entityId={selected.id} />
						</DialogFooter>
					</DialogContent>
				</Dialog>
			)}
		</>
	)
}
