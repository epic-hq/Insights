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
						<div className="font-light text-muted-foreground text-xs">Theme</div>
						<div className="border-b pb-3 font-semibold text-lg">{insight.name}</div>
					</div>
					<div className="flex items-center gap-2">
						{insight.category && <Badge variant="secondary">{insight.category}</Badge>}
						{insight.journey_stage && <Badge variant="outline">{insight.journey_stage}</Badge>}
						{(insight as any).evidence_count > 0 && (
							<Link to={routes.evidence.index() + `?theme_id=${insight.id}`}>
								<Badge variant="outline" className="gap-1.5 hover:bg-accent cursor-pointer">
									<Quote className="h-3.5 w-3.5" />
									{(insight as any).evidence_count} evidence
								</Badge>
							</Link>
						)}
					</div>
				</div>

				<div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
					{insight.pain && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Pain Point</h4>
							<p className="text-foreground text-sm leading-relaxed">{insight.pain}</p>
						</div>
					)}

					{insight.jtbd && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Job To Be Done</h4>
							<p className="text-foreground text-sm leading-relaxed">{insight.jtbd}</p>
						</div>
					)}

					{insight.desired_outcome && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Desired Outcome</h4>
							<p className="text-foreground text-sm leading-relaxed">{insight.desired_outcome}</p>
						</div>
					)}

					{insight.motivation && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Motivation</h4>
							<p className="text-foreground text-sm leading-relaxed">{insight.motivation}</p>
						</div>
					)}

					{insight.emotional_response && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Emotional Response</h4>
							<div className="flex items-center gap-2">
								<EmotionBadge emotion={insight.emotional_response} />
							</div>
						</div>
					)}

					{insight.statement && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Summary</h4>
							<p className="text-foreground text-sm leading-relaxed">{insight.statement}</p>
						</div>
					)}

					{insight.synonyms && insight.synonyms.length > 0 && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Synonyms</h4>
							<div className="flex flex-wrap gap-2">
								{insight.synonyms.map((synonym: string, idx: number) => (
									<Badge key={idx} variant="secondary" className="text-xs">
										{synonym}
									</Badge>
								))}
							</div>
						</div>
					)}

					{insight.anti_examples && insight.anti_examples.length > 0 && (
						<div className="space-y-2">
							<h4 className="font-medium text-muted-foreground text-sm">Anti-Examples</h4>
							<div className="flex flex-wrap gap-2">
								{insight.anti_examples.map((example: string, idx: number) => (
									<Badge key={idx} variant="outline" className="text-xs">
										{example}
									</Badge>
								))}
							</div>
						</div>
					)}

					{insight.insight_tags && insight.insight_tags.length > 0 && (
						<div className="space-y-3">
							<h4 className="font-medium text-muted-foreground text-sm">Tags</h4>
							<div className="flex flex-wrap gap-2">
								{insight.insight_tags?.map((tag: any, idx: number) => {
									const tagName = tag?.tags?.tag || tag?.tag || null
									if (!tagName) return null
									return (
										<StyledTag key={`${tagName}-${idx}`} name={tagName} style={tag.style} frequency={tag.frequency} />
									)
								})}
							</div>
						</div>
					)}

					{insight.persona_insights && insight.persona_insights.length > 0 && (
						<div className="space-y-3">
							<h4 className="font-medium text-muted-foreground text-sm">Personas</h4>
							<div className="flex flex-wrap gap-2">
								{insight.persona_insights.map((pi: any, idx: number) => {
									const personaName = pi?.personas?.name
									if (!personaName) return null
									return (
										<Badge key={idx} variant="default" className="text-xs">
											{personaName}
										</Badge>
									)
								})}
							</div>
						</div>
					)}

					{((insight as any).people?.length > 0 || (insight as any).organizations?.length > 0) && (
						<div className="space-y-3">
							<h4 className="font-medium text-muted-foreground text-sm">Coverage</h4>

							{(insight as any).organizations?.length > 0 && (
								<div className="space-y-2">
									<div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Organizations</div>
									<div className="flex flex-wrap gap-2">
										{(insight as any).organizations.map((org: any, idx: number) => (
											<Link key={idx} to={routes.evidence.index() + `?theme_id=${insight.id}`}>
												<Badge variant="secondary" className="gap-1.5 hover:bg-secondary/80 cursor-pointer">
													{org.name}
													<span className="text-[10px] opacity-70">({org.count})</span>
												</Badge>
											</Link>
										))}
									</div>
								</div>
							)}

							{(insight as any).people?.length > 0 && (
								<div className="space-y-2">
									<div className="font-medium text-xs uppercase tracking-wide text-muted-foreground">People</div>
									<div className="flex flex-wrap gap-2">
										{(insight as any).people.slice(0, 10).map((person: any, idx: number) => (
											<Link key={idx} to={routes.people.detail(person.id)}>
												<Badge variant="outline" className="gap-1.5 hover:bg-accent cursor-pointer">
													{person.name}
													{person.role && <span className="text-[10px] opacity-70">({person.role})</span>}
												</Badge>
											</Link>
										))}
										{(insight as any).people.length > 10 && (
											<Link to={routes.evidence.index() + `?theme_id=${insight.id}`}>
												<Badge variant="outline" className="hover:bg-accent cursor-pointer">
													+{(insight as any).people.length - 10} more
												</Badge>
											</Link>
										)}
									</div>
								</div>
							)}
						</div>
					)}
				</div>

				<EntityInteractionPanel entityType="insight" entityId={insight.id} />
			</CardContent>
		</Card>
	)
}
