import { AlertCircle, CheckCircle, Lightbulb, XCircle } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
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
						const confidence = analysis.confidence ?? 0
						const answeredCount = decision.metrics.answered_answer_count ?? 0
						const openCount = decision.metrics.open_answer_count ?? 0
						const researchInsights = decision.research_questions.map((rq) => {
							const rqAnalysisResult = analysisMap.get(`research:${rq.id}`)
							return {
								id: rq.id,
								text: rq.text,
								summary: rqAnalysisResult?.summary ?? rq.analysis?.summary ?? null,
								next_steps: rqAnalysisResult?.next_steps ?? rq.analysis?.next_steps ?? null,
								confidence: rqAnalysisResult?.confidence ?? rq.analysis?.confidence ?? null,
								metrics: rq.metrics,
							}
						})

						return (
							<Card key={decision.id} className="transition-all">
								<CardHeader className="space-y-2 pb-0">
									<div className="flex items-start justify-between gap-3">
										<div className="flex flex-1 items-start gap-3">
											{getDirectionIcon(confidence)}
											<div className="flex-1">
												<CardTitle className="pr-4 text-base">{decision.text}</CardTitle>
												{analysis.summary ? (
													<p className="mt-1 text-muted-foreground text-sm">{analysis.summary}</p>
												) : (
													<p className="mt-1 text-muted-foreground text-sm">
														{answeredCount} answered · {openCount} open
													</p>
												)}
											</div>
										</div>
										<Badge variant="secondary" className={`text-xs ${getConfidenceColor(confidence)}`}>
											{getDirectionLabel(confidence)}
										</Badge>
									</div>
									<div className="text-muted-foreground text-xs">
										{decision.metrics.research_question_count ?? 0} research questions · {answeredCount} answered ·{" "}
										{openCount} open ·{decision.metrics.evidence_count ?? 0} evidence
									</div>
								</CardHeader>
								<CardContent className="space-y-4 pt-4">
									{analysis.goal_achievement_summary && (
										<div className="rounded-md bg-muted/40 p-3 text-muted-foreground text-sm">
											{analysis.goal_achievement_summary}
										</div>
									)}

									{researchInsights.length > 0 && (
										<div>
											{/* <p className="mb-2 font-medium text-sm">Research Question Learnings</p> */}
											<div className="space-y-3">
												{researchInsights.map((rq) => (
													<div key={rq.id} className="rounded-lg border border-border bg-muted/40 p-3">
														<div className="flex items-start justify-between gap-3">
															<div className="flex-1 space-y-1">
																<p className="font-medium text-foreground text-sm">{rq.text}</p>
																{rq.summary && <p className="text-muted-foreground text-sm">{rq.summary}</p>}
																{rq.next_steps && (
																	<p className="text-muted-foreground text-xs">
																		<span className="font-medium">Next steps:</span> {rq.next_steps}
																	</p>
																)}
															</div>
															<div className="flex flex-col items-end gap-1 text-muted-foreground text-xs">
																<span>{rq.metrics.answered_answer_count ?? 0} answered</span>
																<span>{rq.metrics.open_answer_count ?? 0} open</span>
																<span>{rq.metrics.evidence_count ?? 0} evidence</span>
															</div>
														</div>
													</div>
												))}
											</div>
										</div>
									)}

									{analysis.next_steps && (
										<div>
											<p className="mb-1 font-medium text-sm">Recommended Next Step</p>
											<p className="text-muted-foreground text-sm">{analysis.next_steps}</p>
										</div>
									)}
								</CardContent>
							</Card>
						)
					})
				)}

				{topResearchQuestions.length > 0 && (
					<div className="mt-4">
						<div className="mb-2 flex items-center gap-2 text-muted-foreground/50 text-xs">
							<Lightbulb className="h-4 w-4" /> Additional Research Questions
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
