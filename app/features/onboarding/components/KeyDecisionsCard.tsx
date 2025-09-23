import { CheckCircle, Lightbulb } from "lucide-react"
import type {
	DecisionQuestionNode,
	ResearchQuestionNode,
} from "~/features/research/components/ResearchAnswers"

export interface DecoratedResearchQuestion extends ResearchQuestionNode {
	decisionText: string | null
}

interface KeyDecisionsCardProps {
	decisionSummaries: DecisionQuestionNode[]
	topResearchQuestions: DecoratedResearchQuestion[]
}

export function KeyDecisionsCard({ decisionSummaries, topResearchQuestions }: KeyDecisionsCardProps) {
	return (
		<div>
			<div className="mb-3 text-foreground text-sm">Key Decisions</div>
			<div className="space-y-3 border-gray-200 border-l-2 pl-4 dark:border-gray-700">
				{decisionSummaries.length === 0 ? (
					<p className="text-muted-foreground text-sm">No decision questions yet. Generate a research plan to get started.</p>
				) : (
					decisionSummaries.map((decision) => (
						<div key={decision.id} className="rounded-lg border border-border bg-card/50 p-3">
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="font-medium text-foreground text-sm">{decision.text}</p>
									<p className="text-muted-foreground text-xs">
										{decision.metrics.answered_answer_count ?? 0} answered · {decision.metrics.open_answer_count ?? 0} open
									</p>
								</div>
								<div className="rounded-full border border-border px-2 py-0.5 text-muted-foreground text-[11px]">
									{decision.research_questions.length} research question{decision.research_questions.length === 1 ? "" : "s"}
								</div>
							</div>
							{decision.research_questions.length > 0 && (
								<div className="mt-2 space-y-1">
									{decision.research_questions.slice(0, 2).map((rq) => (
										<div key={rq.id} className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
											<span className="line-clamp-2">{rq.text}</span>
											<span className="whitespace-nowrap">
												{rq.metrics.answered_answer_count ?? 0} answered
											</span>
										</div>
									))}
									{decision.research_questions.length > 2 && (
										<p className="text-muted-foreground text-[11px]">
											+{decision.research_questions.length - 2} more linked questions
										</p>
									)}
								</div>
							)}
						</div>
					))
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
												<p className="text-muted-foreground text-[11px]">Supports: {rq.decisionText}</p>
											)}
											<p className="mt-1 text-muted-foreground text-[11px]">
												{rq.metrics.answered_answer_count ?? 0} answered · {rq.metrics.open_answer_count ?? 0} open · {rq.metrics.evidence_count ?? 0} evidence
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
