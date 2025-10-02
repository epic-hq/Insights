import { CheckCircle, MessageCircleQuestionIcon } from "lucide-react"
import type { ResearchAnswerNode } from "~/features/research/components/ResearchAnswers"

interface InterviewAnalysisCardProps {
	answeredAnswers: ResearchAnswerNode[]
	openAnswers: ResearchAnswerNode[]
}

export function InterviewAnalysisCard({ answeredAnswers, openAnswers }: InterviewAnalysisCardProps) {
	if (answeredAnswers.length === 0 && openAnswers.length === 0) {
		return null
	}

	return (
		<div>
			<div className="mb-3 text-muted-foreground/50 text-sm">Interview Analysis</div>
			<div className="space-y-4">
				{answeredAnswers.length > 0 && (
					<div>
						<h4 className="mb-2 font-medium text-green-700 text-sm dark:text-green-400">
							Answered ({answeredAnswers.length})
						</h4>
						<div className="space-y-2">
							{answeredAnswers.slice(0, 3).map((answer) => (
								<div
									key={`answered-${answer.id}`}
									className="rounded-lg border border-green-200 bg-green-50/50 p-2 dark:border-green-800 dark:bg-green-950/10"
								>
									<div className="flex items-start gap-2">
										<CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-600" />
										<div className="flex-1">
											<p className="font-medium text-foreground text-xs">{answer.question_text}</p>
											{answer.answer_text && (
												<p className="mt-1 line-clamp-2 text-muted-foreground text-xs">{answer.answer_text}</p>
											)}
										</div>
									</div>
								</div>
							))}
							{answeredAnswers.length > 3 && (
								<p className="text-muted-foreground text-xs">+{answeredAnswers.length - 3} more questions answered</p>
							)}
						</div>
					</div>
				)}

				{openAnswers.length > 0 && (
					<div>
						<h4 className="mb-2 font-medium text-amber-700 text-sm dark:text-amber-400">
							Unanswered ({openAnswers.length})
						</h4>
						<div className="space-y-2">
							{openAnswers.slice(0, 3).map((answer, index) => (
								<div
									key={`open-${answer.id}-${index}`}
									className="rounded-lg border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-900 dark:bg-amber-950/10"
								>
									<div className="flex items-start gap-2">
										<MessageCircleQuestionIcon className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-600" />
										<div className="flex-1">
											<p className="font-medium text-foreground text-xs">{answer.question_text}</p>
											<p className="text-[11px] text-muted-foreground">Next interview: capture an answer</p>
										</div>
									</div>
								</div>
							))}
							{openAnswers.length > 3 && (
								<p className="text-muted-foreground text-xs">+{openAnswers.length - 3} more questions need answers</p>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
