import { Building2, Flame, MessageSquare, Quote, Target, TrendingUp, Users } from "lucide-react"
import { useCallback } from "react"
import { Link, useFetcher } from "react-router-dom"
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel"
import { StyledTag } from "~/components/TagDisplay"
import { Badge } from "~/components/ui/badge"
import { EmotionBadge } from "~/components/ui/emotion-badge"
import InlineEdit from "~/components/ui/inline-edit"
import { ResourceShareMenu } from "~/features/sharing/components/ResourceShareMenu"
import { useProjectRoutes } from "~/hooks/useProjectRoutes"
import type { Insight } from "~/types"
import type { InsightEvidence } from "../pages/insight-detail"
import { EvidenceGroupedByInterview } from "./EvidenceGroup"
import { InsightActions } from "./InsightActions"
import { SemanticEvidenceSection } from "./SemanticEvidenceSection"

interface InsightCardV3Props {
	insight: Insight
	evidence?: InsightEvidence[]
	projectPath?: string
	accountId?: string
	extended?: boolean
}

export function InsightCardV3Page({
	insight,
	evidence = [],
	projectPath: propProjectPath,
	accountId,
	extended,
}: InsightCardV3Props) {
	const routes = useProjectRoutes(propProjectPath || "")
	const shareableName = insight.name || insight.statement || "Insight"
	const updateFetcher = useFetcher()

	// Handler to update insight fields via API
	const handleFieldUpdate = useCallback(
		(field: string, value: string) => {
			if (!propProjectPath) return
			updateFetcher.submit(
				{
					table: "themes",
					id: insight.id,
					field,
					value,
				},
				{
					method: "post",
					action: `${propProjectPath}/insights/api/update-field`,
					encType: "application/json",
				}
			)
		},
		[propProjectPath, insight.id, updateFetcher]
	)

	return (
		<div className="mx-auto max-w-4xl px-4 py-8 sm:px-0">
			{/* Header Section */}
			<div className="mb-6 space-y-4">
				<div className="flex flex-wrap items-start gap-4">
					<div className="min-w-0 flex-1 space-y-3">
						<div className="font-medium text-muted-foreground text-sm uppercase tracking-wide">Insight Theme</div>
						<h1 className="font-bold text-3xl tracking-tight">{insight.name}</h1>
						{/* Desired Outcome - prominent placement */}
						<div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900/30 dark:bg-blue-950/10">
							<TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
							Desired Outcome:
							<div className="min-w-0 flex-1">
								<InlineEdit
									value={insight.desired_outcome || ""}
									onSubmit={(value) => handleFieldUpdate("desired_outcome", value)}
									placeholder="Click to add desired outcome..."
									multiline
									textClassName="text-foreground text-sm leading-relaxed"
									showEditButton
								/>
							</div>
						</div>
						{insight.statement && <p className="text-foreground text-lg leading-relaxed">{insight.statement}</p>}
					</div>
					{propProjectPath && accountId ? (
						<div className="flex shrink-0 items-center gap-2">
							<InsightActions insight={insight} projectPath={propProjectPath} showLabel={true} />
							<ResourceShareMenu
								projectPath={propProjectPath}
								accountId={accountId}
								resourceId={insight.id}
								resourceName={shareableName}
								resourceType="insight"
							/>
						</div>
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

			<div className="space-y-6">
				{/* Pain & JTBD - Compact side by side */}
				<div className="grid gap-4 md:grid-cols-2">
					<div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/50 p-3 dark:border-red-900/30 dark:bg-red-950/10">
						<Flame className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
						<div className="min-w-0 flex-1">
							<div className="mb-1 font-medium text-muted-foreground text-xs">Pain Point</div>
							<InlineEdit
								value={insight.pain || ""}
								onSubmit={(value) => handleFieldUpdate("pain", value)}
								placeholder="Click to add pain point..."
								multiline
								textClassName="text-foreground text-sm leading-relaxed"
								showEditButton
							/>
						</div>
					</div>

					<div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50/50 p-3 dark:border-green-900/30 dark:bg-green-950/10">
						<Target className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
						<div className="min-w-0 flex-1">
							<div className="mb-1 font-medium text-muted-foreground text-xs">Job To Be Done</div>
							<InlineEdit
								value={insight.jtbd || ""}
								onSubmit={(value) => handleFieldUpdate("jtbd", value)}
								placeholder="Click to add job to be done..."
								multiline
								textClassName="text-foreground text-sm leading-relaxed"
								showEditButton
							/>
						</div>
					</div>
				</div>

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
									<div className="font-medium text-muted-foreground text-sm uppercase tracking-wide">Organizations</div>
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

			{/* Comments Section */}
			<div className="mt-8 space-y-4">
				<div className="flex items-center gap-2">
					<MessageSquare className="h-5 w-5 text-muted-foreground" />
					<h4 className="font-semibold text-base text-foreground">Comments</h4>
				</div>
				<EntityInteractionPanel entityType="insight" entityId={insight.id} defaultOpen={true} />
			</div>
		</div>
	)
}
