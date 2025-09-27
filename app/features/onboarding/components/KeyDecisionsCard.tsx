import { AlertCircle, ArrowRight, CheckCircle, ChevronDown, Lightbulb, XCircle } from "lucide-react"
import { useState } from "react"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Collapsible, CollapsibleContent } from "~/components/ui/collapsible"
import type { DecisionQuestionNode, ResearchQuestionNode } from "~/features/research/components/ResearchAnswers"

export interface DecoratedResearchQuestion extends ResearchQuestionNode {
	decisionText: string | null
}

interface QuestionAnalysis {
	question_type: "decision" | "research"
	question_id: string
	summary: string
	confidence: number
	next_steps: string | null
	goal_achievement_summary: string | null
}

interface KeyDecisionsCardProps {
	decisionSummaries: DecisionQuestionNode[]
	topResearchQuestions: DecoratedResearchQuestion[]
	analysisResults?: QuestionAnalysis[]
}

export function KeyDecisionsCard({
	decisionSummaries,
	topResearchQuestions,
	analysisResults = [],
}: KeyDecisionsCardProps) {
	const [expandedDecision, setExpandedDecision] = useState<string | null>(null)

	const getDirectionIcon = (confidence: number) => {
		if (confidence >= 0.8) return <CheckCircle className="h-4 w-4 text-success" />
		if (confidence >= 0.5) return <AlertCircle className="h-4 w-4 text-warning" />
		return <XCircle className="h-4 w-4 text-destructive" />
	}

	const getDirectionLabel = (confidence: number) => {
		if (confidence >= 0.8) return "High Confidence"
		if (confidence >= 0.5) return "Medium Confidence"
		return "Low Confidence"
	}

	const getConfidenceColor = (confidence: number) => {
		if (confidence >= 0.8) return "text-success"
		if (confidence >= 0.5) return "text-warning"
		return "text-destructive"
	}

	// Create analysis map for quick lookup keyed by question type to avoid collisions
	const analysisMap = new Map(
		analysisResults.map((analysis) => [`${analysis.question_type}:${analysis.question_id}`, analysis])
	)
	return (
		<div>
			<div className="mb-3 text-foreground text-sm">Key Decisions</div>
			<div className="space-y-3 border-gray-200 border-l-2 pl-4 dark:border-gray-700">
				{decisionSummaries.length === 0 ? (
					<p className="text-muted-foreground text-sm">Pending</p>
				) : (
					decisionSummaries.map((decision) => {
						const analysisResult = analysisMap.get(`decision:${decision.id}`)
						const analysis = {
							summary: analysisResult?.summary ?? decision.analysis?.summary ?? null,
							next_steps: analysisResult?.next_steps ?? decision.analysis?.next_steps ?? null,
							goal_achievement_summary:
								analysisResult?.goal_achievement_summary ?? decision.analysis?.goal_achievement_summary ?? null,
							confidence: analysisResult?.confidence ?? decision.analysis?.confidence ?? null,
						}
						const isExpanded = expandedDecision === decision.id
						const confidence = analysis.confidence ?? 0

						return (
							<Card key={decision.id} className="transition-all">
								<CardHeader className="pb-3">
									<div className="flex items-start justify-between">
										<div className="flex flex-1 items-start gap-3">
											{getDirectionIcon(confidence)}
											<div className="flex-1">
												<CardTitle className="pr-4 text-base">{decision.text}</CardTitle>
												<p className="mt-1 text-muted-foreground text-sm">
													{analysis.summary || analysis.goal_achievement_summary ||
														`${decision.metrics.answered_answer_count ?? 0} answered · ${decision.metrics.open_answer_count ?? 0} open`}
												</p>
											</div>
										</div>

										<div className="flex flex-col items-end gap-2">
											<Badge variant="secondary" className={`text-xs ${getConfidenceColor(confidence)}`}>
												{getDirectionLabel(confidence)}
											</Badge>
											{decision.research_questions.length > 0 && (
												<Button
													variant="ghost"
													size="sm"
													className="text-xs hover:bg-muted"
													onClick={() => setExpandedDecision(isExpanded ? null : decision.id)}
												>
													({Math.min(decision.research_questions.length, 4)})
													<ChevronDown
														className={`ml-1 h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
													/>
												</Button>
											)}
										</div>
									</div>
								</CardHeader>

											{decision.research_questions.length > 0 && (
												<Collapsible open={isExpanded}>
										<CollapsibleContent>
											<div className="mx-6 border-border border-t" />
											<CardContent className="space-y-4 pt-4">
												<div>
													<p className="mb-3 font-medium text-sm">Research Question Learnings</p>
													<div className="space-y-3">
														{decision.research_questions.slice(0, 3).map((rq) => {
															const rqAnalysisResult = analysisMap.get(`research:${rq.id}`)
															const rqAnalysis = {
																summary: rqAnalysisResult?.summary ?? rq.analysis?.summary ?? null,
																next_steps: rqAnalysisResult?.next_steps ?? rq.analysis?.next_steps ?? null,
																confidence: rqAnalysisResult?.confidence ?? rq.analysis?.confidence ?? null,
															}
															return (
																<div
																	key={rq.id}
																	className="group cursor-pointer rounded-lg border border-border bg-muted/50 p-3 transition-colors hover:bg-muted/70"
																>
																	<div className="flex items-start justify-between">
																		<div className="flex-1">
																			<p className="mb-1 font-medium text-foreground text-sm">{rq.text}</p>
																			<p className="text-muted-foreground text-sm">
																				{rqAnalysis.summary || `${rq.metrics.answered_answer_count ?? 0} answered`}
																			</p>
																	</div>
																		<ArrowRight className="mt-0.5 ml-2 h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
																	</div>
																</div>
															)
														})}
													</div>
												</div>
												{analysis.next_steps && (
													<div>
														<p className="mb-2 font-medium text-sm">Next Steps</p>
														<p className="text-muted-foreground text-sm">{analysis.next_steps}</p>
													</div>
												)}
											</CardContent>
										</CollapsibleContent>
									</Collapsible>
								)}
							</Card>
						)
					})
				)}

				{topResearchQuestions.length > 0 && (
					<div className="mt-4">
						<div className="mb-2 flex items-center gap-2 text-muted-foreground/50 text-xs">
							<Lightbulb className="h-4 w-4" /> Supporting Research Questions
						</div>
						<div className="space-y-2">
							{topResearchQuestions.map((rq) => (
								<div
									key={`supporting-rq-${rq.id}`}
									className="rounded-lg border border-green-200 bg-green-50/50 p-2 dark:border-green-800 dark:bg-green-950/10"
								>
									<div className="flex items-start gap-2">
										<CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600" />
										<div className="flex-1">
											<p className="font-medium text-foreground text-xs">{rq.text}</p>
											{rq.decisionText && (
												<p className="text-[11px] text-muted-foreground">Supports: {rq.decisionText}</p>
											)}
											<p className="mt-1 text-[11px] text-muted-foreground">
												{rq.metrics.answered_answer_count ?? 0} answered · {rq.metrics.open_answer_count ?? 0} open ·{" "}
												{rq.metrics.evidence_count ?? 0} evidence
											</p>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
