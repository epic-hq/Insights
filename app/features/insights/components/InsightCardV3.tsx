import { Quote } from "lucide-react";
import type { CSSProperties } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { EntityInteractionPanel } from "~/components/EntityInteractionPanel";
import { StyledTag } from "~/components/TagDisplay";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { EmotionBadge } from "~/components/ui/emotion-badge";
import { useCurrentProject } from "~/contexts/current-project-context";
import { RelatedThemes } from "~/features/insights/components/RelatedThemes";
import { useProjectRoutes } from "~/hooks/useProjectRoutes";
import type { Insight } from "~/types";

type PersonaInsightView = {
	personas?: {
		id?: string | null;
		name?: string | null;
	} | null;
};

type LinkedThemeView = {
	id: string;
	name?: string | null;
};

type InsightTagView = {
	tag?: string | null;
	style?: CSSProperties | null;
	frequency?: number | null;
	tags?: {
		tag?: string | null;
	} | null;
};

type InsightCardView = Insight & {
	category?: string | null;
	desired_outcome?: string | null;
	emotional_response?: string | null;
	evidence_count?: number | null;
	exclusion_criteria?: string | null;
	inclusion_criteria?: string | null;
	insight_tags?: InsightTagView[] | null;
	jtbd?: string | null;
	linked_themes?: LinkedThemeView[] | null;
	motivation?: string | null;
	pain?: string | null;
	persona_insights?: PersonaInsightView[] | null;
	statement?: string | null;
};

interface InsightCardV3Props {
	insight: Insight;
}

export function InsightCardV3({ insight }: InsightCardV3Props) {
	const insightView = insight as InsightCardView;
	const [selected, setSelected] = useState<InsightCardView | null>(null);
	const { projectPath } = useCurrentProject();
	const routes = useProjectRoutes(projectPath || "");

	return (
		<>
			<Card
				className="cursor-pointer transition-shadow hover:shadow-md"
				onClick={() => setSelected(insightView)}
				surface="elevated"
			>
				<CardContent className="p-4">
					<div className="mb-2 flex items-start justify-between gap-2">
						<h3 className="font-semibold text-foreground">{insightView.name || "Untitled Theme"}</h3>
						{(insightView.evidence_count ?? 0) > 0 && (
							<Badge variant="outline" className="gap-1 text-xs">
								<Quote className="h-3 w-3" />
								{insightView.evidence_count}
							</Badge>
						)}
					</div>

					<div className="mb-3 flex flex-wrap gap-1.5">
						{insightView.category && (
							<Badge variant="secondary" className="text-xs">
								{insightView.category}
							</Badge>
						)}
						{insightView.emotional_response && <EmotionBadge emotion_string={insightView.emotional_response} />}
					</div>

					{insightView.statement && <p className="mb-3 line-clamp-3 text-muted-foreground text-sm">{insightView.statement}</p>}

					{insightView.pain && <p className="mb-3 line-clamp-2 text-muted-foreground text-xs italic">Pain: {insightView.pain}</p>}

					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center space-x-2">
							{insightView.persona_insights && insightView.persona_insights.length > 0 && (
								<div className="flex flex-wrap gap-1">
									{insightView.persona_insights.slice(0, 2).map((pi) => (
										<Badge key={pi.personas?.id} variant="outline" className="text-xs">
											{pi.personas?.name}
										</Badge>
									))}
									{insightView.persona_insights.length > 2 && (
										<Badge variant="outline" className="text-xs">
											+{insightView.persona_insights.length - 2}
										</Badge>
									)}
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
								<div className="flex flex-wrap gap-2">
									{selected.category && <Badge variant="secondary">{selected.category}</Badge>}
									{selected.emotional_response && <EmotionBadge emotion_string={selected.emotional_response} />}
									{(selected.evidence_count ?? 0) > 0 && (
										<Badge variant="outline" className="gap-1.5">
											<Quote className="h-3.5 w-3.5" />
											{selected.evidence_count} evidence
										</Badge>
									)}
								</div>
							</DialogTitle>
						</DialogHeader>

						<div className="max-h-[60vh] space-y-6 overflow-y-auto pr-2">
							{selected.pain && (
								<div className="space-y-2">
									<h4 className="font-medium text-muted-foreground text-sm">Pain Point</h4>
									<p className="text-foreground text-sm leading-relaxed">{selected.pain}</p>
								</div>
							)}

							{selected.jtbd && (
								<div className="space-y-2">
									<h4 className="font-medium text-muted-foreground text-sm">Job To Be Done</h4>
									<p className="text-foreground text-sm leading-relaxed">{selected.jtbd}</p>
								</div>
							)}

							{selected.desired_outcome && (
								<div className="space-y-2">
									<h4 className="font-medium text-muted-foreground text-sm">Desired Outcome</h4>
									<p className="text-foreground text-sm leading-relaxed">{selected.desired_outcome}</p>
								</div>
							)}

							{selected.motivation && (
								<div className="space-y-2">
									<h4 className="font-medium text-muted-foreground text-sm">Motivation</h4>
									<p className="text-foreground text-sm leading-relaxed">{selected.motivation}</p>
								</div>
							)}

							{selected.statement && (
								<div className="space-y-2">
									<h4 className="font-medium text-muted-foreground text-sm">Summary</h4>
									<p className="text-foreground text-sm leading-relaxed">{selected.statement}</p>
								</div>
							)}

							{(selected.inclusion_criteria || selected.exclusion_criteria) && (
								<div className="grid grid-cols-1 gap-4">
									{selected.inclusion_criteria && (
										<div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
											<h4 className="font-medium text-green-900 text-sm dark:text-green-100">Inclusion Criteria</h4>
											<p className="text-green-700 text-sm dark:text-green-300">{selected.inclusion_criteria}</p>
										</div>
									)}
									{selected.exclusion_criteria && (
										<div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
											<h4 className="font-medium text-red-900 text-sm dark:text-red-100">Exclusion Criteria</h4>
											<p className="text-red-700 text-sm dark:text-red-300">{selected.exclusion_criteria}</p>
										</div>
									)}
								</div>
							)}

							{/* Semantic Related Themes */}
							{selected.project_id && projectPath && (
								<RelatedThemes
									themeId={selected.id}
									projectId={selected.project_id}
									projectPath={projectPath}
									limit={5}
								/>
							)}

							{/* Manually linked themes (legacy) */}
							{selected.linked_themes && selected.linked_themes.length > 0 && (
								<div className="space-y-3">
									<h4 className="font-medium text-gray-700 text-sm">Linked Themes</h4>
									<div className="flex flex-wrap gap-2">
										{selected.linked_themes.map((theme) => (
											<Link key={theme.id} to={routes.insights.detail(theme.id)}>
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
											{selected.insight_tags?.map((tag, idx) => {
												const tagName = tag?.tags?.tag || tag?.tag || null;
												if (!tagName) return null;
											return (
												<StyledTag
													key={`${tagName}-${idx}`}
													name={tagName}
													style={tag.style ?? {}}
													frequency={tag.frequency ?? undefined}
												/>
											);
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
	);
}
