import { Building2, Flame, Quote, Target, TrendingUp, Users } from "lucide-react"
import { Link } from "react-router-dom"
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel"
import { StyledTag } from "~/components/TagDisplay"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent } from "~/components/ui/card"
import { EmotionBadge } from "~/components/ui/emotion-badge"
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { Insight } from "~/types"
import type { InsightEvidence } from "../pages/insight-detail"
import { EvidenceGroupedByInterview } from "./EvidenceGroup"
import { SemanticEvidenceSection } from "./SemanticEvidenceSection"

interface InsightCardV3Props {
	insight: Insight
	evidence?: InsightEvidence[]
	projectPath?: string
	extended?: boolean
}

export function InsightCardV3Page({ insight, evidence = [], projectPath: propProjectPath, extended }: InsightCardV3Props) {
        const routes = useProjectRoutes(propProjectPath || "")
        const shareableName = insight.name || insight.statement || "Insight"

        return (
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-0">
                        {/* Header Section */}
                        <div className="mb-8 space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                        <div className="space-y-3">
                                                <div className="font-medium text-muted-foreground text-sm uppercase tracking-wide">Insight Theme</div>
                                                <h1 className="font-bold text-3xl tracking-tight">{insight.name}</h1>
                                                {insight.statement && <p className="text-foreground text-lg leading-relaxed">{insight.statement}</p>}
                                        </div>
                                        {propProjectPath ? (
                                                <ResourceShareMenu
                                                        projectPath={propProjectPath}
                                                        resourceId={insight.id}
                                                        resourceName={shareableName}
                                                        resourceType="insight"
                                                />
                                        ) : null}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                        {insight.category && (
                                                <Badge variant="secondary" className="px-3 py-1">
                                                        {insight.category}
						</Badge>
					)}
					{insight.journey_stage && (
						<Badge variant="outline" className="px-3 py-1">
							{insight.journey_stage}
						</Badge>
					)}
				</div>
			</div>

			<div className="space-y-8">
					{/* Pain & Gain - Side by Side */}
					{(insight.pain || insight.jtbd) && (
						<div className="grid gap-6 md:grid-cols-2">
							{insight.pain && (
								<Card className="border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/10">
									<CardContent className="space-y-3 p-6">
										<div className="flex items-center gap-2">
											<div className="rounded-full bg-red-100 p-2 dark:bg-red-900/20">
												<Flame className="h-4 w-4 text-red-600 dark:text-red-400" />
											</div>
											<h3 className="font-semibold text-sm">Pain Point</h3>
										</div>
										<p className="text-foreground text-sm leading-relaxed">{insight.pain}</p>
									</CardContent>
								</Card>
							)}

							{insight.jtbd && (
								<Card className="border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/10">
									<CardContent className="space-y-3 p-6">
										<div className="flex items-center gap-2">
											<div className="rounded-full bg-green-100 p-2 dark:bg-green-900/20">
												<Target className="h-4 w-4 text-green-600 dark:text-green-400" />
											</div>
											<h3 className="font-semibold text-sm">Job To Be Done</h3>
										</div>
										<p className="text-foreground text-sm leading-relaxed">{insight.jtbd}</p>
									</CardContent>
								</Card>
							)}
						</div>
					)}

					{/* Desired Outcome */}
					{insight.desired_outcome && (
						<Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/30 dark:bg-blue-950/10">
							<CardContent className="space-y-3 p-6">
								<div className="flex items-center gap-2">
									<div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/20">
										<TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
									</div>
									<h3 className="font-semibold text-sm">Desired Outcome</h3>
								</div>
								<p className="text-foreground text-sm leading-relaxed">{insight.desired_outcome}</p>
							</CardContent>
						</Card>
					)}

					{/* Motivation */}
					{insight.motivation && (
						<div className="space-y-3">
							<h4 className="font-semibold text-foreground text-sm">Motivation</h4>
							<p className="text-muted-foreground text-sm leading-relaxed">{insight.motivation}</p>
						</div>
					)}

					{/* Emotional Response */}
					{insight.emotional_response && (
						<div className="space-y-3">
							<h4 className="font-semibold text-foreground text-sm">Emotional Response</h4>
							<div className="flex items-center gap-2">
								<EmotionBadge emotion_string={insight.emotional_response} />
							</div>
						</div>
					)}

					{/* Personas */}
					{insight.persona_insights && insight.persona_insights.length > 0 && (
						<div className="space-y-3">
							<h4 className="font-semibold text-foreground text-sm">Personas</h4>
							<div className="flex flex-wrap gap-2">
								{insight.persona_insights.map((pi: any, idx: number) => {
									const personaName = pi?.personas?.name
									if (!personaName) return null
									return (
										<Badge key={idx} variant="default" className="px-3 py-1">
											{personaName}
										</Badge>
									)
								})}
							</div>
						</div>
					)}

					{/* Synonyms */}
					{insight.synonyms && insight.synonyms.length > 0 && (
						<div className="space-y-3">
							<h4 className="font-semibold text-muted-foreground text-sm">Synonyms</h4>
							<div className="flex flex-wrap gap-2">
								{insight.synonyms.map((synonym: string, idx: number) => (
									<Badge key={idx} variant="secondary" className="text-xs">
										{synonym}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Tags */}
					{insight.insight_tags && insight.insight_tags.length > 0 && (
						<div className="space-y-3">
							<h4 className="font-semibold text-foreground text-sm">Tags</h4>
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

				{/* Evidence Section - Grouped by Interview */}
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<Quote className="h-5 w-5 text-muted-foreground" />
						<h4 className="font-semibold text-base text-foreground">Supporting Evidence</h4>
					</div>

					<EvidenceGroupedByInterview evidence={evidence} projectPath={propProjectPath || ""} />
				</div>

				{/* Semantic Related Evidence Section */}
				<SemanticEvidenceSection insightId={insight.id} projectPath={propProjectPath || ""} />

				{/* Organizations & People Section */}
				{((insight as any).organizations?.length > 0 || (insight as any).people?.length > 0) && (
					<div className="space-y-6 rounded-lg border bg-muted/30 p-6">
						{(insight as any).organizations?.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<Building2 className="h-4 w-4 text-muted-foreground" />
									<div className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
										Organizations
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									{(insight as any).organizations.map((org: any, idx: number) => (
										<Link key={idx} to={`${routes.evidence.index()}?theme_id=${insight.id}`}>
											<Badge variant="secondary" className="cursor-pointer gap-1.5 px-3 py-1 hover:bg-secondary/80">
												{org.name}
												<span className="text-[10px] opacity-70">({org.count})</span>
											</Badge>
										</Link>
									))}
								</div>
							</div>
						)}

						{(insight as any).people?.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center gap-2">
									<Users className="h-4 w-4 text-muted-foreground" />
									<div className="font-medium text-muted-foreground text-sm uppercase tracking-wide">People</div>
								</div>
								<div className="flex flex-wrap gap-2">
									{(insight as any).people.slice(0, 10).map((person: any, idx: number) => (
										<Link key={idx} to={routes.people.detail(person.id)}>
											<Badge variant="outline" className="cursor-pointer gap-1.5 px-3 py-1 hover:bg-accent">
												{person.name}
												{person.role && <span className="text-[10px] opacity-70">({person.role})</span>}
											</Badge>
										</Link>
									))}
									{(insight as any).people.length > 10 && (
										<Link to={`${routes.evidence.index()}?theme_id=${insight.id}`}>
											<Badge variant="outline" className="cursor-pointer px-3 py-1 hover:bg-accent">
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

			<div className="mt-6">
				<EntityInteractionPanel entityType="insight" entityId={insight.id} />
			</div>
		</div>
	)
}
